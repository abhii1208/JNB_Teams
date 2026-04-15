const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { chatBroadcast } = require('../chatWebSocket');
const notificationService = require('../services/notificationService');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if workspace is personal (no chat allowed)
 */
async function isPersonalWorkspace(workspaceId, userId) {
  const result = await pool.query(
    `SELECT w.name, w.created_by 
     FROM workspaces w 
     WHERE w.id = $1`,
    [workspaceId]
  );
  if (result.rows.length === 0) return true;
  const ws = result.rows[0];
  return ws.name === 'Personal' && ws.created_by === userId;
}

/**
 * Check if user is a workspace member
 */
async function isWorkspaceMember(workspaceId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Check if user is a thread member
 */
async function isThreadMember(threadId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM chat_thread_members WHERE thread_id = $1 AND user_id = $2`,
    [threadId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Check if user is a thread admin (creator or admin role)
 */
async function isThreadAdmin(threadId, userId) {
  const result = await pool.query(
    `SELECT ctm.role, ct.created_by 
     FROM chat_thread_members ctm
     JOIN chat_threads ct ON ct.id = ctm.thread_id
     WHERE ctm.thread_id = $1 AND ctm.user_id = $2`,
    [threadId, userId]
  );
  if (result.rows.length === 0) return false;
  return result.rows[0].role === 'admin' || result.rows[0].created_by === userId;
}

/**
 * Get existing DM thread between two users in a workspace
 */
async function getExistingDmThread(workspaceId, user1Id, user2Id) {
  const result = await pool.query(
    `SELECT ct.id
     FROM chat_threads ct
     JOIN chat_thread_members m1 ON m1.thread_id = ct.id AND m1.user_id = $2
     JOIN chat_thread_members m2 ON m2.thread_id = ct.id AND m2.user_id = $3
     WHERE ct.workspace_id = $1 AND ct.type = 'dm'
     LIMIT 1`,
    [workspaceId, user1Id, user2Id]
  );
  return result.rows[0]?.id || null;
}

/**
 * Validate that all user IDs are workspace members
 */
async function validateWorkspaceMembers(workspaceId, userIds) {
  const result = await pool.query(
    `SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = ANY($2::int[])`,
    [workspaceId, userIds]
  );
  return result.rows.map(r => r.user_id);
}

/**
 * Parse mentions from message content
 * Format: @[type:id:display] e.g. @[user:123:John Doe] @[project:456:Website] @[task:789:Fix bug]
 */
function parseMentions(content) {
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
  return mentions;
}

function isManagerRole(role) {
  return ['Owner', 'Admin', 'ProjectAdmin'].includes(role);
}

async function getWorkspaceRole(workspaceId, userId) {
  const result = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return result.rows[0]?.role || null;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Middleware: Validate workspace access and non-personal
 */
async function validateWorkspaceAccess(req, res, next) {
  const workspaceId = parseInt(req.params.workspaceId || req.body.workspace_id, 10);
  if (!workspaceId || isNaN(workspaceId)) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    // Check personal workspace
    if (await isPersonalWorkspace(workspaceId, req.userId)) {
      return res.status(403).json({ error: 'Chat is not available for personal workspaces' });
    }

    // Check membership
    if (!(await isWorkspaceMember(workspaceId, req.userId))) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    req.workspaceId = workspaceId;
    next();
  } catch (err) {
    console.error('Workspace access validation error:', err);
    res.status(500).json({ error: 'Failed to validate workspace access' });
  }
}

/**
 * Middleware: Validate thread membership
 */
async function validateThreadMember(req, res, next) {
  const threadId = parseInt(req.params.threadId, 10);
  if (!threadId || isNaN(threadId)) {
    return res.status(400).json({ error: 'thread_id is required' });
  }

  try {
    if (!(await isThreadMember(threadId, req.userId))) {
      return res.status(403).json({ error: 'Not a member of this thread' });
    }

    req.threadId = threadId;
    next();
  } catch (err) {
    console.error('Thread member validation error:', err);
    res.status(500).json({ error: 'Failed to validate thread access' });
  }
}

// =============================================================================
// ROUTES: THREADS
// =============================================================================

/**
 * GET /api/chat/:workspaceId/threads
 * Get all threads the user is a member of in this workspace
 */
router.get('/:workspaceId/threads', validateWorkspaceAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        ct.id,
        ct.type,
        ct.name,
        ct.description,
        ct.intro_text,
        ct.visibility,
        ct.created_by,
        ct.created_at,
        ct.updated_at,
        ctm.last_read_at,
        ctm.last_read_message_id,
        -- Get unread count
        (
          SELECT COUNT(*)::int 
          FROM chat_messages cm 
          WHERE cm.thread_id = ct.id 
            AND (ctm.last_read_message_id IS NULL OR cm.id > ctm.last_read_message_id)
        ) AS unread_count,
        -- Get last message preview
        (
          SELECT json_build_object(
            'id', cm.id,
            'content', LEFT(cm.content, 100),
            'sender_id', cm.sender_id,
            'created_at', cm.created_at
          )
          FROM chat_messages cm
          WHERE cm.thread_id = ct.id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) AS last_message,
        -- Get all members
        (
          SELECT json_agg(json_build_object(
            'user_id', u.id,
            'username', u.username,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'role', tm.role
          ) ORDER BY tm.joined_at)
          FROM chat_thread_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE tm.thread_id = ct.id
        ) AS members
      FROM chat_threads ct
      JOIN chat_thread_members ctm ON ctm.thread_id = ct.id AND ctm.user_id = $2
      WHERE ct.workspace_id = $1
      ORDER BY ct.updated_at DESC`,
      [req.workspaceId, req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get threads error:', err);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

/**
 * GET /api/chat/:workspaceId/threads/:threadId
 * Get single thread details
 */
router.get('/:workspaceId/threads/:threadId', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        ct.id,
        ct.type,
        ct.name,
        ct.description,
        ct.intro_text,
        ct.visibility,
        ct.workspace_id,
        ct.created_by,
        ct.created_at,
        ct.updated_at,
        (
          SELECT json_agg(json_build_object(
            'user_id', u.id,
            'username', u.username,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'role', tm.role,
            'joined_at', tm.joined_at
          ) ORDER BY tm.joined_at)
          FROM chat_thread_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE tm.thread_id = ct.id
        ) AS members,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', cm.id,
            'content', cm.content,
            'sender_id', cm.sender_id,
            'created_at', cm.created_at
          ) ORDER BY cm.pinned_at DESC), '[]'::json)
          FROM chat_messages cm
          WHERE cm.thread_id = ct.id AND cm.pinned_at IS NOT NULL
        ) AS pinned_messages
      FROM chat_threads ct
      WHERE ct.id = $1`,
      [req.threadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get thread details error:', err);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

/**
 * POST /api/chat/:workspaceId/threads/dm
 * Create or get existing DM thread with another user
 */
router.post('/:workspaceId/threads/dm', validateWorkspaceAccess, async (req, res) => {
  const { user_id: targetUserId } = req.body;
  
  if (!targetUserId) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  if (targetUserId === req.userId) {
    return res.status(400).json({ error: 'Cannot create DM with yourself' });
  }

  const client = await pool.connect();
  try {
    // Validate target user is workspace member
    const validMembers = await validateWorkspaceMembers(req.workspaceId, [targetUserId]);
    if (validMembers.length === 0) {
      return res.status(400).json({ error: 'Target user is not a workspace member' });
    }

    // Check for existing DM
    const existingThreadId = await getExistingDmThread(req.workspaceId, req.userId, targetUserId);
    if (existingThreadId) {
      // Return existing thread
      const threadResult = await client.query(
        `SELECT ct.*, 
          (SELECT json_agg(json_build_object(
            'user_id', u.id,
            'username', u.username,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'role', tm.role
          ))
          FROM chat_thread_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE tm.thread_id = ct.id) AS members
        FROM chat_threads ct WHERE ct.id = $1`,
        [existingThreadId]
      );
      return res.json({ thread: threadResult.rows[0], created: false });
    }

    // Create new DM thread
    await client.query('BEGIN');

    const threadResult = await client.query(
      `INSERT INTO chat_threads (workspace_id, type, created_by)
       VALUES ($1, 'dm', $2)
       RETURNING *`,
      [req.workspaceId, req.userId]
    );
    const thread = threadResult.rows[0];

    // Add both members
    await client.query(
      `INSERT INTO chat_thread_members (thread_id, user_id, role)
       VALUES ($1, $2, 'member'), ($1, $3, 'member')`,
      [thread.id, req.userId, targetUserId]
    );

    await client.query('COMMIT');

    // Fetch complete thread with members
    const fullThread = await client.query(
      `SELECT ct.*, 
        (SELECT json_agg(json_build_object(
          'user_id', u.id,
          'username', u.username,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'role', tm.role
        ))
        FROM chat_thread_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.thread_id = ct.id) AS members
      FROM chat_threads ct WHERE ct.id = $1`,
      [thread.id]
    );

    res.status(201).json({ thread: fullThread.rows[0], created: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create DM thread error:', err);
    res.status(500).json({ error: 'Failed to create DM thread' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/chat/:workspaceId/threads/group
 * Create a new group chat
 */
router.post('/:workspaceId/threads/group', validateWorkspaceAccess, async (req, res) => {
  const { name, member_ids = [], description = '', intro_text = '' } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  // Ensure at least 2 other members (3 total including creator)
  const uniqueMemberIds = [...new Set(member_ids.filter(id => id !== req.userId))];
  if (uniqueMemberIds.length < 2) {
    return res.status(400).json({ error: 'Group chat requires at least 3 members' });
  }

  const client = await pool.connect();
  try {
    // Validate all members are in workspace
    const validMembers = await validateWorkspaceMembers(req.workspaceId, uniqueMemberIds);
    if (validMembers.length !== uniqueMemberIds.length) {
      return res.status(400).json({ error: 'Some users are not workspace members' });
    }

    await client.query('BEGIN');

    // Create group thread
    const threadResult = await client.query(
      `INSERT INTO chat_threads (workspace_id, type, name, description, intro_text, created_by)
       VALUES ($1, 'group', $2, $3, $4, $5)
       RETURNING *`,
      [req.workspaceId, name.trim(), description || null, intro_text || null, req.userId]
    );
    const thread = threadResult.rows[0];

    // Add creator as admin
    await client.query(
      `INSERT INTO chat_thread_members (thread_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [thread.id, req.userId]
    );

    // Add other members
    if (uniqueMemberIds.length > 0) {
      const memberValues = uniqueMemberIds.map((_, i) => `($1, $${i + 2}, 'member')`).join(', ');
      await client.query(
        `INSERT INTO chat_thread_members (thread_id, user_id, role) VALUES ${memberValues}`,
        [thread.id, ...uniqueMemberIds]
      );
    }

    await client.query('COMMIT');

    // Fetch complete thread
    const fullThread = await client.query(
      `SELECT ct.*, 
        (SELECT json_agg(json_build_object(
          'user_id', u.id,
          'username', u.username,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'role', tm.role
        ))
        FROM chat_thread_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.thread_id = ct.id) AS members
      FROM chat_threads ct WHERE ct.id = $1`,
      [thread.id]
    );

    res.status(201).json(fullThread.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create group thread error:', err);
    res.status(500).json({ error: 'Failed to create group thread' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/chat/:workspaceId/threads/channel
 * Create a channel thread scoped to workspace or management visibility
 */
router.post('/:workspaceId/threads/channel', validateWorkspaceAccess, async (req, res) => {
  const { name, description = '', intro_text = '', visibility = 'workspace' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Channel name is required' });
  }

  if (!['workspace', 'management'].includes(visibility)) {
    return res.status(400).json({ error: 'Visibility must be workspace or management' });
  }

  const workspaceRole = await getWorkspaceRole(req.workspaceId, req.userId);
  if (!isManagerRole(workspaceRole)) {
    return res.status(403).json({ error: 'Only managers and admins can create channels' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const threadResult = await client.query(
      `INSERT INTO chat_threads (workspace_id, type, name, description, intro_text, visibility, created_by)
       VALUES ($1, 'channel', $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.workspaceId, name.trim(), description || null, intro_text || null, visibility, req.userId]
    );
    const thread = threadResult.rows[0];

    const membersResult = await client.query(
      visibility === 'management'
        ? `SELECT user_id FROM workspace_members
           WHERE workspace_id = $1 AND role IN ('Owner', 'Admin', 'ProjectAdmin')`
        : `SELECT user_id FROM workspace_members WHERE workspace_id = $1`,
      [req.workspaceId]
    );

    const memberIds = [...new Set(membersResult.rows.map((row) => row.user_id))];
    for (const memberId of memberIds) {
      await client.query(
        `INSERT INTO chat_thread_members (thread_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (thread_id, user_id) DO NOTHING`,
        [thread.id, memberId, memberId === req.userId ? 'admin' : 'member']
      );
    }

    await client.query('COMMIT');

    const fullThread = await client.query(
      `SELECT ct.*,
        (SELECT json_agg(json_build_object(
          'user_id', u.id,
          'username', u.username,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'role', tm.role
        ) ORDER BY tm.joined_at)
        FROM chat_thread_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.thread_id = ct.id) AS members
      FROM chat_threads ct WHERE ct.id = $1`,
      [thread.id]
    );

    res.status(201).json(fullThread.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create channel thread error:', err);
    res.status(500).json({ error: 'Failed to create channel' });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/chat/:workspaceId/threads/:threadId
 * Update group thread (rename, etc.) - Only admins/creators
 */
router.patch('/:workspaceId/threads/:threadId', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  const { name, description, intro_text } = req.body;

  try {
    // Check thread type and permissions
    const threadResult = await pool.query(
      `SELECT type, created_by FROM chat_threads WHERE id = $1`,
      [req.threadId]
    );
    
    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const thread = threadResult.rows[0];
    if (thread.type === 'dm') {
      return res.status(400).json({ error: 'Cannot update DM threads' });
    }

    if (!(await isThreadAdmin(req.threadId, req.userId))) {
      return res.status(403).json({ error: 'Only thread admins can update the thread' });
    }

    const result = await pool.query(
      `UPDATE chat_threads
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           intro_text = COALESCE($3, intro_text),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name?.trim() || null, description ?? null, intro_text ?? null, req.threadId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update thread error:', err);
    res.status(500).json({ error: 'Failed to update thread' });
  }
});

// =============================================================================
// ROUTES: THREAD MEMBERS
// =============================================================================

/**
 * POST /api/chat/:workspaceId/threads/:threadId/members
 * Add members to a group thread
 */
router.post('/:workspaceId/threads/:threadId/members', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  const { user_ids = [] } = req.body;

  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: 'user_ids array is required' });
  }

  const client = await pool.connect();
  try {
    // Check thread type and permissions
    const threadResult = await client.query(
      `SELECT type FROM chat_threads WHERE id = $1`,
      [req.threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (threadResult.rows[0].type === 'dm') {
      return res.status(400).json({ error: 'Cannot add members to DM threads' });
    }

    if (!(await isThreadAdmin(req.threadId, req.userId))) {
      return res.status(403).json({ error: 'Only thread admins can add members' });
    }

    // Validate users are workspace members
    const validMembers = await validateWorkspaceMembers(req.workspaceId, user_ids);
    if (validMembers.length === 0) {
      return res.status(400).json({ error: 'No valid workspace members provided' });
    }

    // Add members (ignore duplicates)
    await client.query('BEGIN');
    
    for (const userId of validMembers) {
      await client.query(
        `INSERT INTO chat_thread_members (thread_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (thread_id, user_id) DO NOTHING`,
        [req.threadId, userId]
      );
    }

    await client.query('COMMIT');

    // Return updated member list
    const membersResult = await client.query(
      `SELECT u.id AS user_id, u.username, u.first_name, u.last_name, tm.role, tm.joined_at
       FROM chat_thread_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.thread_id = $1
       ORDER BY tm.joined_at`,
      [req.threadId]
    );

    res.json({ members: membersResult.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add thread members error:', err);
    res.status(500).json({ error: 'Failed to add members' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/chat/:workspaceId/threads/:threadId/members/:userId
 * Remove a member from a group thread
 */
router.delete('/:workspaceId/threads/:threadId/members/:userId', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);

  try {
    // Check thread type
    const threadResult = await pool.query(
      `SELECT type, created_by FROM chat_threads WHERE id = $1`,
      [req.threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (threadResult.rows[0].type === 'dm') {
      return res.status(400).json({ error: 'Cannot remove members from DM threads' });
    }

    // Can't remove the creator
    if (targetUserId === threadResult.rows[0].created_by) {
      return res.status(400).json({ error: 'Cannot remove the thread creator' });
    }

    // Only admins can remove others; anyone can remove themselves
    if (targetUserId !== req.userId && !(await isThreadAdmin(req.threadId, req.userId))) {
      return res.status(403).json({ error: 'Only thread admins can remove other members' });
    }

    await pool.query(
      `DELETE FROM chat_thread_members WHERE thread_id = $1 AND user_id = $2`,
      [req.threadId, targetUserId]
    );

    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Remove thread member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// =============================================================================
// ROUTES: MESSAGES
// =============================================================================

/**
 * GET /api/chat/:workspaceId/threads/:threadId/messages
 * Get messages with pagination
 */
router.get('/:workspaceId/threads/:threadId/messages', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const before = req.query.before ? parseInt(req.query.before, 10) : null;

  try {
    let query = `
      SELECT 
        cm.id,
        cm.thread_id,
        cm.sender_id,
        cm.content,
        cm.mentions,
        cm.parent_message_id,
        cm.pinned_at,
        cm.created_at,
        parent.content AS parent_message_content,
        u.username AS sender_username,
        u.first_name AS sender_first_name,
        u.last_name AS sender_last_name,
        (
          SELECT COUNT(*)::int
          FROM chat_messages child
          WHERE child.parent_message_id = cm.id
        ) AS reply_count
      FROM chat_messages cm
      LEFT JOIN chat_messages parent ON parent.id = cm.parent_message_id
      JOIN users u ON u.id = cm.sender_id
      WHERE cm.thread_id = $1
    `;
    const params = [req.threadId];

    if (before) {
      query += ` AND cm.id < $2`;
      params.push(before);
    }

    query += ` ORDER BY cm.created_at DESC, cm.id DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    // Fetch attachments for all messages in one query
    const messageIds = result.rows.map(m => m.id);
    let attachmentsMap = {};
    
    if (messageIds.length > 0) {
      const attachmentsResult = await pool.query(
        `SELECT id, entity_id, original_name, file_size, mime_type
         FROM attachments 
         WHERE entity_type = 'chat_message' 
           AND entity_id = ANY($1::int[]) 
           AND deleted_at IS NULL`,
        [messageIds]
      );
      
      // Group attachments by message ID
      attachmentsResult.rows.forEach(att => {
        if (!attachmentsMap[att.entity_id]) {
          attachmentsMap[att.entity_id] = [];
        }
        attachmentsMap[att.entity_id].push({
          id: att.id,
          original_name: att.original_name,
          file_size: att.file_size,
          mime_type: att.mime_type
        });
      });
    }

    // Add attachments to each message
    const messages = result.rows.map(msg => ({
      ...msg,
      attachments: attachmentsMap[msg.id] || []
    }));

    // Reverse to get chronological order
    res.json({
      messages: messages.reverse(),
      has_more: result.rows.length === limit
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/chat/:workspaceId/threads/:threadId/messages
 * Send a new message
 */
router.post('/:workspaceId/threads/:threadId/messages', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  const { content, attachmentIds, parent_message_id } = req.body;

  // Allow message with content, attachments, or both
  if ((!content || !content.trim()) && (!attachmentIds || attachmentIds.length === 0)) {
    return res.status(400).json({ error: 'Message content or attachments are required' });
  }

  if (content && content.length > 10000) {
    return res.status(400).json({ error: 'Message too long (max 10000 characters)' });
  }

  try {
    // Parse mentions from content
    const mentions = content ? parseMentions(content) : [];

    const result = await pool.query(
      `INSERT INTO chat_messages (thread_id, sender_id, content, mentions, parent_message_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, thread_id, sender_id, content, mentions, parent_message_id, pinned_at, created_at`,
      [req.threadId, req.userId, content ? content.trim() : '', JSON.stringify(mentions), parent_message_id || null]
    );

    const message = result.rows[0];

    // If attachments were uploaded, update their entity_id to this message
    if (attachmentIds && attachmentIds.length > 0) {
      await pool.query(
        `UPDATE attachments 
         SET entity_id = $1 
         WHERE id = ANY($2::int[]) 
           AND entity_type = 'chat_message' 
           AND uploaded_by = $3`,
        [message.id, attachmentIds, req.userId]
      );

      // Fetch the attachments for this message
      const attachmentsResult = await pool.query(
        `SELECT id, original_name, file_size, mime_type
         FROM attachments 
         WHERE entity_type = 'chat_message' 
           AND entity_id = $1 
           AND deleted_at IS NULL`,
        [message.id]
      );
      message.attachments = attachmentsResult.rows;
    } else {
      message.attachments = [];
    }

    // Get sender info
    const senderResult = await pool.query(
      `SELECT username, first_name, last_name FROM users WHERE id = $1`,
      [req.userId]
    );
    
    const sender = senderResult.rows[0];
    message.sender_username = sender.username;
    message.sender_first_name = sender.first_name;
    message.sender_last_name = sender.last_name;

    // Update sender's last_read to this message
    await pool.query(
      `UPDATE chat_thread_members 
       SET last_read_at = CURRENT_TIMESTAMP, last_read_message_id = $1
       WHERE thread_id = $2 AND user_id = $3`,
      [message.id, req.threadId, req.userId]
    );

    // Broadcast message to all thread members via WebSocket
    await chatBroadcast.messageCreated(req.threadId, message);
    
    // Send notifications for chat messages
    try {
      // Get thread info
      const threadResult = await pool.query(
        `SELECT ct.type, ct.name, ct.workspace_id
         FROM chat_threads ct
         WHERE ct.id = $1`,
        [req.threadId]
      );
      const thread = threadResult.rows[0];
      
      // Get thread members (excluding sender)
      const membersResult = await pool.query(
        `SELECT user_id FROM chat_thread_members WHERE thread_id = $1 AND user_id != $2`,
        [req.threadId, req.userId]
      );
      const memberIds = membersResult.rows.map(r => r.user_id);
      
      if (thread.type === 'dm') {
        // Direct message notification
        for (const memberId of memberIds) {
          await notificationService.notifyChatMessage({
            threadId: req.threadId,
            senderId: req.userId,
            receiverId: memberId,
            messagePreview: content || '[Attachment]',
            workspaceId: thread.workspace_id,
          });
        }
      } else if (thread.type === 'group' || thread.type === 'channel') {
        // Group message notification
        await notificationService.notifyChatGroupMessage({
          threadId: req.threadId,
          threadName: thread.name,
          senderId: req.userId,
          memberIds,
          messagePreview: content || '[Attachment]',
          workspaceId: thread.workspace_id,
        });
      }
      
      // Notify users who were @mentioned
      if (mentions && mentions.length > 0) {
        const userMentions = mentions.filter(m => m.type === 'user');
        for (const mention of userMentions) {
          await notificationService.notifyChatMentioned({
            threadId: req.threadId,
            threadName: thread.name,
            senderId: req.userId,
            mentionedUserId: mention.id,
            messagePreview: content || '[Attachment]',
            workspaceId: thread.workspace_id,
          });
        }
      }
    } catch (notifErr) {
      console.error('Failed to send chat notifications:', notifErr);
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.put('/:workspaceId/threads/:threadId/messages/:messageId/pin', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  try {
    if (!(await isThreadAdmin(req.threadId, req.userId))) {
      return res.status(403).json({ error: 'Only thread admins can pin messages' });
    }

    const result = await pool.query(
      `UPDATE chat_messages
       SET pinned_at = CURRENT_TIMESTAMP, pinned_by = $1
       WHERE id = $2 AND thread_id = $3
       RETURNING id, thread_id, pinned_at`,
      [req.userId, req.params.messageId, req.threadId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Pin message error:', err);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

router.delete('/:workspaceId/threads/:threadId/messages/:messageId/pin', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  try {
    if (!(await isThreadAdmin(req.threadId, req.userId))) {
      return res.status(403).json({ error: 'Only thread admins can unpin messages' });
    }

    const result = await pool.query(
      `UPDATE chat_messages
       SET pinned_at = NULL, pinned_by = NULL
       WHERE id = $1 AND thread_id = $2
       RETURNING id, thread_id`,
      [req.params.messageId, req.threadId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Unpin message error:', err);
    res.status(500).json({ error: 'Failed to unpin message' });
  }
});

// =============================================================================
// ROUTES: READ TRACKING
// =============================================================================

/**
 * PUT /api/chat/:workspaceId/threads/:threadId/read
 * Mark thread as read up to a specific message
 */
router.put('/:workspaceId/threads/:threadId/read', validateWorkspaceAccess, validateThreadMember, async (req, res) => {
  const { message_id } = req.body;

  try {
    let updateQuery;
    let params;

    if (message_id) {
      // Mark read up to specific message
      updateQuery = `
        UPDATE chat_thread_members 
        SET last_read_at = CURRENT_TIMESTAMP, last_read_message_id = $1
        WHERE thread_id = $2 AND user_id = $3
          AND (last_read_message_id IS NULL OR last_read_message_id < $1)
      `;
      params = [message_id, req.threadId, req.userId];
    } else {
      // Mark all as read (get latest message)
      updateQuery = `
        UPDATE chat_thread_members 
        SET last_read_at = CURRENT_TIMESTAMP, 
            last_read_message_id = (SELECT MAX(id) FROM chat_messages WHERE thread_id = $1)
        WHERE thread_id = $1 AND user_id = $2
      `;
      params = [req.threadId, req.userId];
    }

    await pool.query(updateQuery, params);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * GET /api/chat/:workspaceId/unread-count
 * Get total unread message count across all threads
 */
router.get('/:workspaceId/unread-count', validateWorkspaceAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(
        (SELECT COUNT(*)::int 
         FROM chat_messages cm 
         WHERE cm.thread_id = ct.id 
           AND (ctm.last_read_message_id IS NULL OR cm.id > ctm.last_read_message_id))
      ), 0)::int AS total_unread
      FROM chat_threads ct
      JOIN chat_thread_members ctm ON ctm.thread_id = ct.id AND ctm.user_id = $2
      WHERE ct.workspace_id = $1`,
      [req.workspaceId, req.userId]
    );

    res.json({ unread_count: result.rows[0]?.total_unread || 0 });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// =============================================================================
// ROUTES: SEARCH & MENTIONS
// =============================================================================

/**
 * GET /api/chat/:workspaceId/search
 * Search threads by name or participant
 */
router.get('/:workspaceId/search', validateWorkspaceAccess, async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  const searchTerm = `%${q.trim().toLowerCase()}%`;

  try {
    const result = await pool.query(
      `SELECT DISTINCT ct.id, ct.type, ct.name, ct.updated_at
       FROM chat_threads ct
       JOIN chat_thread_members ctm ON ctm.thread_id = ct.id AND ctm.user_id = $2
       LEFT JOIN chat_thread_members other_members ON other_members.thread_id = ct.id
       LEFT JOIN users u ON u.id = other_members.user_id
       WHERE ct.workspace_id = $1
         AND (
           LOWER(ct.name) LIKE $3
           OR LOWER(u.username) LIKE $3
           OR LOWER(u.first_name) LIKE $3
           OR LOWER(u.last_name) LIKE $3
         )
       ORDER BY ct.updated_at DESC
       LIMIT 20`,
      [req.workspaceId, req.userId, searchTerm]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Search threads error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/chat/:workspaceId/mentionables
 * Get list of mentionable entities (users, projects, tasks) for autocomplete
 */
router.get('/:workspaceId/mentionables', validateWorkspaceAccess, async (req, res) => {
  const { type, q } = req.query;
  const searchTerm = q ? `%${q.trim().toLowerCase()}%` : '%';

  try {
    const results = { users: [], projects: [], tasks: [] };

    // Get users
    if (!type || type === 'user') {
      const usersResult = await pool.query(
        `SELECT u.id, u.username, u.first_name, u.last_name
         FROM users u
         JOIN workspace_members wm ON wm.user_id = u.id
         WHERE wm.workspace_id = $1
           AND (
             LOWER(u.username) LIKE $2
             OR LOWER(u.first_name) LIKE $2
             OR LOWER(u.last_name) LIKE $2
           )
         ORDER BY u.first_name, u.last_name
         LIMIT 10`,
        [req.workspaceId, searchTerm]
      );
      results.users = usersResult.rows.map(u => ({
        id: u.id,
        type: 'user',
        display: u.first_name && u.last_name 
          ? `${u.first_name} ${u.last_name}` 
          : u.username,
        username: u.username
      }));
    }

    // Get projects
    if (!type || type === 'project') {
      const projectsResult = await pool.query(
        `SELECT p.id, p.name
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE p.workspace_id = $1
           AND pm.user_id = $2
           AND LOWER(p.name) LIKE $3
         ORDER BY p.name
         LIMIT 10`,
        [req.workspaceId, req.userId, searchTerm]
      );
      results.projects = projectsResult.rows.map(p => ({
        id: p.id,
        type: 'project',
        display: p.name
      }));
    }

    // Get tasks
    if (!type || type === 'task') {
      const tasksResult = await pool.query(
        `SELECT t.id, t.name, p.name AS project_name
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         JOIN project_members pm ON pm.project_id = p.id
         WHERE p.workspace_id = $1
           AND pm.user_id = $2
           AND LOWER(t.name) LIKE $3
         ORDER BY t.updated_at DESC
         LIMIT 10`,
        [req.workspaceId, req.userId, searchTerm]
      );
      results.tasks = tasksResult.rows.map(t => ({
        id: t.id,
        type: 'task',
        display: t.name,
        project: t.project_name
      }));
    }

    res.json(results);
  } catch (err) {
    console.error('Get mentionables error:', err);
    res.status(500).json({ error: 'Failed to fetch mentionables' });
  }
});

module.exports = router;
