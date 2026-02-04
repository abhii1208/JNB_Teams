/**
 * WebSocket Chat Server
 * Handles real-time messaging for workspace chat
 */
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Store active connections: Map<userId, Set<WebSocket>>
const userConnections = new Map();

// Store user's workspace subscriptions: Map<userId, Set<workspaceId>>
const userWorkspaces = new Map();

// Store thread subscriptions: Map<threadId, Set<userId>>
const threadSubscribers = new Map();

/**
 * Verify JWT token from connection
 */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.userId;
  } catch (err) {
    return null;
  }
}

/**
 * Check if user is a member of the workspace
 */
async function isWorkspaceMember(workspaceId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Check if user is a member of the thread
 */
async function isThreadMember(threadId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM chat_thread_members WHERE thread_id = $1 AND user_id = $2`,
    [threadId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Get all thread members for a thread
 */
async function getThreadMembers(threadId) {
  const result = await pool.query(
    `SELECT user_id FROM chat_thread_members WHERE thread_id = $1`,
    [threadId]
  );
  return result.rows.map(r => r.user_id);
}

/**
 * Get workspace for a thread
 */
async function getThreadWorkspace(threadId) {
  const result = await pool.query(
    `SELECT workspace_id FROM chat_threads WHERE id = $1`,
    [threadId]
  );
  return result.rows[0]?.workspace_id;
}

/**
 * Send message to a specific user
 */
function sendToUser(userId, message) {
  const connections = userConnections.get(userId);
  console.log('📤 sendToUser - userId:', userId, 'connections:', connections?.size || 0, 'message type:', message.type);
  if (connections) {
    const payload = JSON.stringify(message);
    connections.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        console.log('📤 Sending to WebSocket connection, readyState:', ws.readyState);
        ws.send(payload);
      }
    });
  }
}

/**
 * Send message to all members of a thread
 */
function sendToThread(threadId, message, excludeUserId = null) {
  const subscribers = threadSubscribers.get(threadId);
  if (subscribers) {
    subscribers.forEach(userId => {
      if (userId !== excludeUserId) {
        sendToUser(userId, message);
      }
    });
  }
}

/**
 * Send message to all workspace members
 */
async function sendToWorkspace(workspaceId, message, excludeUserId = null) {
  try {
    const result = await pool.query(
      `SELECT user_id FROM workspace_members WHERE workspace_id = $1`,
      [workspaceId]
    );
    
    result.rows.forEach(({ user_id }) => {
      if (user_id !== excludeUserId) {
        sendToUser(user_id, message);
      }
    });
  } catch (err) {
    console.error('Error sending to workspace:', err);
  }
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(ws, userId, data) {
  try {
    const message = JSON.parse(data);
    const { type, payload } = message;

    switch (type) {
      // Subscribe to a workspace's chat
      case 'subscribe_workspace': {
        const { workspace_id } = payload;
        if (!(await isWorkspaceMember(workspace_id, userId))) {
          ws.send(JSON.stringify({ type: 'error', error: 'Not a workspace member' }));
          return;
        }

        // Track workspace subscription
        if (!userWorkspaces.has(userId)) {
          userWorkspaces.set(userId, new Set());
        }
        userWorkspaces.get(userId).add(workspace_id);

        ws.send(JSON.stringify({ type: 'subscribed_workspace', workspace_id }));
        break;
      }

      // Subscribe to a specific thread
      case 'subscribe_thread': {
        const { thread_id } = payload;
        if (!(await isThreadMember(thread_id, userId))) {
          ws.send(JSON.stringify({ type: 'error', error: 'Not a thread member' }));
          return;
        }

        // Track thread subscription
        if (!threadSubscribers.has(thread_id)) {
          threadSubscribers.set(thread_id, new Set());
        }
        threadSubscribers.get(thread_id).add(userId);

        ws.send(JSON.stringify({ type: 'subscribed_thread', thread_id }));
        break;
      }

      // Unsubscribe from a thread
      case 'unsubscribe_thread': {
        const { thread_id } = payload;
        const subscribers = threadSubscribers.get(thread_id);
        if (subscribers) {
          subscribers.delete(userId);
          if (subscribers.size === 0) {
            threadSubscribers.delete(thread_id);
          }
        }
        ws.send(JSON.stringify({ type: 'unsubscribed_thread', thread_id }));
        break;
      }

      // Send a message
      case 'send_message': {
        const { thread_id, content } = payload;
        
        if (!(await isThreadMember(thread_id, userId))) {
          ws.send(JSON.stringify({ type: 'error', error: 'Not a thread member' }));
          return;
        }

        if (!content || !content.trim()) {
          ws.send(JSON.stringify({ type: 'error', error: 'Message content required' }));
          return;
        }

        // Parse mentions
        const mentionRegex = /@\[(user|project|task):(\d+):([^\]]+)\]/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
          mentions.push({
            type: match[1],
            id: parseInt(match[2], 10),
            display: match[3]
          });
        }

        // Insert message
        const result = await pool.query(
          `INSERT INTO chat_messages (thread_id, sender_id, content, mentions)
           VALUES ($1, $2, $3, $4)
           RETURNING id, thread_id, sender_id, content, mentions, created_at`,
          [thread_id, userId, content.trim(), JSON.stringify(mentions)]
        );

        const newMessage = result.rows[0];

        // Get sender info
        const senderResult = await pool.query(
          `SELECT username, first_name, last_name FROM users WHERE id = $1`,
          [userId]
        );
        const sender = senderResult.rows[0];
        newMessage.sender_username = sender.username;
        newMessage.sender_first_name = sender.first_name;
        newMessage.sender_last_name = sender.last_name;

        // Update sender's last_read
        await pool.query(
          `UPDATE chat_thread_members 
           SET last_read_at = CURRENT_TIMESTAMP, last_read_message_id = $1
           WHERE thread_id = $2 AND user_id = $3`,
          [newMessage.id, thread_id, userId]
        );

        // Broadcast to all thread members
        const threadMembers = await getThreadMembers(thread_id);
        threadMembers.forEach(memberId => {
          sendToUser(memberId, {
            type: 'message_created',
            thread_id,
            message: newMessage
          });
        });

        break;
      }

      // Mark thread as read
      case 'mark_read': {
        const { thread_id, message_id } = payload;
        
        if (!(await isThreadMember(thread_id, userId))) {
          return;
        }

        if (message_id) {
          await pool.query(
            `UPDATE chat_thread_members 
             SET last_read_at = CURRENT_TIMESTAMP, last_read_message_id = $1
             WHERE thread_id = $2 AND user_id = $3
               AND (last_read_message_id IS NULL OR last_read_message_id < $1)`,
            [message_id, thread_id, userId]
          );
        } else {
          await pool.query(
            `UPDATE chat_thread_members 
             SET last_read_at = CURRENT_TIMESTAMP, 
                 last_read_message_id = (SELECT MAX(id) FROM chat_messages WHERE thread_id = $1)
             WHERE thread_id = $1 AND user_id = $2`,
            [thread_id, userId]
          );
        }

        // Notify other subscribers about read status update
        sendToThread(thread_id, {
          type: 'read_updated',
          thread_id,
          user_id: userId,
          message_id
        }, userId);

        break;
      }

      // Typing indicator
      case 'typing_start': {
        const { thread_id } = payload;
        if (!(await isThreadMember(thread_id, userId))) return;
        
        sendToThread(thread_id, {
          type: 'user_typing',
          thread_id,
          user_id: userId
        }, userId);
        break;
      }

      case 'typing_stop': {
        const { thread_id } = payload;
        if (!(await isThreadMember(thread_id, userId))) return;
        
        sendToThread(thread_id, {
          type: 'user_stopped_typing',
          thread_id,
          user_id: userId
        }, userId);
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${type}` }));
    }
  } catch (err) {
    console.error('WebSocket message handling error:', err);
    ws.send(JSON.stringify({ type: 'error', error: 'Internal server error' }));
  }
}

/**
 * Clean up when a connection closes
 */
function handleDisconnect(ws, userId) {
  // Remove from user connections
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      userConnections.delete(userId);
      
      // Clean up thread subscriptions for this user
      threadSubscribers.forEach((subscribers, threadId) => {
        subscribers.delete(userId);
        if (subscribers.size === 0) {
          threadSubscribers.delete(threadId);
        }
      });

      // Clean up workspace subscriptions
      userWorkspaces.delete(userId);
    }
  }
}

/**
 * Initialize WebSocket server attached to HTTP server
 */
function initializeChatWebSocket(server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/chat'
  });

  wss.on('connection', (ws, req) => {
    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    const userId = verifyToken(token);
    if (!userId) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    // Store connection
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(ws);

    // Send connection confirmation
    ws.send(JSON.stringify({ type: 'connected', user_id: userId }));

    // Handle messages
    ws.on('message', (data) => {
      handleMessage(ws, userId, data.toString());
    });

    // Handle disconnect
    ws.on('close', () => {
      handleDisconnect(ws, userId);
    });

    // Handle errors
    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      handleDisconnect(ws, userId);
    });

    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  console.log('✅ Chat WebSocket server initialized on /ws/chat');
  return wss;
}

/**
 * Broadcast functions for use by REST API
 */
const chatBroadcast = {
  // Broadcast new message to thread members
  async messageCreated(threadId, message) {
    const members = await getThreadMembers(threadId);
    members.forEach(userId => {
      sendToUser(userId, {
        type: 'message_created',
        thread_id: threadId,
        message
      });
    });
  },

  // Broadcast thread update (rename, etc.)
  async threadUpdated(threadId, thread) {
    const members = await getThreadMembers(threadId);
    members.forEach(userId => {
      sendToUser(userId, {
        type: 'thread_updated',
        thread_id: threadId,
        thread
      });
    });
  },

  // Broadcast member added to thread
  async memberAdded(threadId, member) {
    const members = await getThreadMembers(threadId);
    members.forEach(userId => {
      sendToUser(userId, {
        type: 'member_added',
        thread_id: threadId,
        member
      });
    });
    
    // Also notify the new member
    sendToUser(member.user_id, {
      type: 'added_to_thread',
      thread_id: threadId
    });
  },

  // Broadcast member removed from thread
  async memberRemoved(threadId, removedUserId) {
    const members = await getThreadMembers(threadId);
    members.forEach(userId => {
      sendToUser(userId, {
        type: 'member_removed',
        thread_id: threadId,
        user_id: removedUserId
      });
    });

    // Notify the removed user
    sendToUser(removedUserId, {
      type: 'removed_from_thread',
      thread_id: threadId
    });
  },

  // Broadcast new thread created (to all members)
  async threadCreated(thread) {
    const members = await getThreadMembers(thread.id);
    members.forEach(userId => {
      sendToUser(userId, {
        type: 'thread_created',
        thread
      });
    });
  },

  // Broadcast notification to a specific user
  notificationToUser(userId, notification) {
    console.log('📤 chatBroadcast.notificationToUser - sending to user:', userId, 'notification id:', notification.id);
    sendToUser(userId, {
      type: 'notification',
      payload: notification
    });
  }
};

module.exports = { 
  initializeChatWebSocket,
  chatBroadcast
};
