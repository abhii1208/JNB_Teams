/**
 * Chat Page Component
 * Main chat interface with thread list, message pane, and composer
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  Box,
  Paper,
  Drawer,
  useMediaQuery,
  useTheme,
  Snackbar,
  Alert,
  Typography,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import ChatThreadList from './ChatThreadList';
import ChatMessagePane from './ChatMessagePane';
import ChatComposer from './ChatComposer';
import {
  CreateDmDialog,
  CreateGroupDialog,
  CreateChannelDialog,
  ManageMembersDialog,
  RenameGroupDialog,
} from './ChatDialogs';
import useChatWebSocket from './useChatWebSocket';
import {
  getChatThreads,
  getChatThread,
  getChatMessages,
  sendChatMessage,
  createDmThread,
  createGroupThread,
  createChannelThread,
  updateChatThread,
  addThreadMembers,
  removeThreadMember,
  markThreadRead,
  getChatUnreadCount,
  sendChatReply,
  pinChatMessage,
  unpinChatMessage,
} from '../../apiClient';

const THREAD_LIST_WIDTH = 320;

function ChatPage({ workspace, user }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  
  // Dialog states
  const [createDmOpen, setCreateDmOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [renameGroupOpen, setRenameGroupOpen] = useState(false);
  
  // Mobile drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(!isMobile);

  // Refs
  const typingTimeoutsRef = useRef({});
  const fetchThreadsRef = useRef(null);
  const fetchThreadDetailsRef = useRef(null);

  // Check if chat is available
  const isPersonalWorkspace = useMemo(() => {
    if (!workspace) return true;
    return workspace.is_personal || 
      (workspace.name === 'Personal' && workspace.created_by === user?.id);
  }, [workspace, user]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((data) => {
    switch (data.type) {
      case 'message_created': {
        console.log('WebSocket: Received message_created', data);
        
        // Force immediate updates for better real-time experience
        flushSync(() => {
          // Add message if it's for the current thread
          if (data.thread_id === selectedThread?.id) {
            console.log('Adding message to current thread:', data.message.id);
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === data.message.id)) {
                console.log('Message already exists, skipping');
                return prev;
              }
              console.log('Adding new message to messages array');
              return [...prev, data.message];
            });
          }
          
          // Update thread list (last message, unread count)
          setThreads(prev => prev.map(t => {
            if (t.id === data.thread_id) {
              return {
                ...t,
                last_message: data.message,
                unread_count: t.id === selectedThread?.id ? 0 : (t.unread_count || 0) + 1,
                updated_at: data.message.created_at,
              };
            }
            return t;
          }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
        });

        // Update total unread count
        if (data.thread_id !== selectedThread?.id) {
          setUnreadCount(prev => prev + 1);
        }
        break;
      }

      case 'thread_created': {
        setThreads(prev => [data.thread, ...prev]);
        break;
      }

      case 'thread_updated': {
        setThreads(prev => prev.map(t => 
          t.id === data.thread_id ? { ...t, ...data.thread } : t
        ));
        if (selectedThread?.id === data.thread_id) {
          setSelectedThread(prev => ({ ...prev, ...data.thread }));
        }
        break;
      }

      case 'member_added':
      case 'member_removed': {
        // Refresh thread details
        if (selectedThread?.id === data.thread_id) {
          fetchThreadDetailsRef.current?.(data.thread_id);
        }
        break;
      }

      case 'added_to_thread': {
        // Refresh threads list
        fetchThreadsRef.current?.();
        break;
      }

      case 'removed_from_thread': {
        // Remove thread from list
        setThreads(prev => prev.filter(t => t.id !== data.thread_id));
        if (selectedThread?.id === data.thread_id) {
          setSelectedThread(null);
          setMessages([]);
        }
        break;
      }

      case 'user_typing': {
        // Add to typing users (if not current user)
        if (data.thread_id === selectedThread?.id && data.user_id !== user?.id) {
          setTypingUsers(prev => {
            if (prev.some(u => u.user_id === data.user_id)) return prev;
            const member = selectedThread?.members?.find(m => m.user_id === data.user_id);
            return [...prev, member || { user_id: data.user_id }];
          });

          // Clear after timeout
          if (typingTimeoutsRef.current[data.user_id]) {
            clearTimeout(typingTimeoutsRef.current[data.user_id]);
          }
          typingTimeoutsRef.current[data.user_id] = setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.user_id !== data.user_id));
          }, 3000);
        }
        break;
      }

      case 'user_stopped_typing': {
        if (data.thread_id === selectedThread?.id) {
          setTypingUsers(prev => prev.filter(u => u.user_id !== data.user_id));
          if (typingTimeoutsRef.current[data.user_id]) {
            clearTimeout(typingTimeoutsRef.current[data.user_id]);
          }
        }
        break;
      }

      case 'read_updated': {
        // Could update read receipts UI here
        break;
      }

      default:
        break;
    }
  }, [selectedThread, user]);

  // WebSocket connection
  const {
    isConnected,
    subscribeThread,
    unsubscribeThread,
    sendTyping,
  } = useChatWebSocket(
    isPersonalWorkspace ? null : workspace?.id,
    handleWebSocketMessage
  );

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    if (!workspace?.id || isPersonalWorkspace) return;

    setLoadingThreads(true);
    try {
      const response = await getChatThreads(workspace.id);
      setThreads(response.data);
    } catch (err) {
      console.error('Failed to fetch threads:', err);
      setError('Failed to load conversations');
    } finally {
      setLoadingThreads(false);
    }
  }, [workspace?.id, isPersonalWorkspace]);

  // Fetch thread details
  const fetchThreadDetails = useCallback(async (threadId) => {
    try {
      const response = await getChatThread(workspace.id, threadId);
      const thread = response.data;
      if (thread) {
        setSelectedThread(thread);
        setThreads(prev => prev.map(t => t.id === threadId ? thread : t));
      }
    } catch (err) {
      console.error('Failed to fetch thread details:', err);
    }
  }, [workspace?.id]);

  // Keep refs in sync with latest function versions
  useEffect(() => {
    fetchThreadsRef.current = fetchThreads;
    fetchThreadDetailsRef.current = fetchThreadDetails;
  }, [fetchThreads, fetchThreadDetails]);

  // Fetch messages for a thread
  const fetchMessages = useCallback(async (threadId, before = null) => {
    if (!workspace?.id || !threadId) return;

    if (before) {
      setLoadingMoreMessages(true);
    } else {
      setLoadingMessages(true);
      setMessages([]);
    }

    try {
      const response = await getChatMessages(workspace.id, threadId, { 
        limit: 50,
        before 
      });
      
      if (before) {
        setMessages(prev => [...response.data.messages, ...prev]);
      } else {
        setMessages(response.data.messages);
      }
      setHasMoreMessages(response.data.has_more);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoadingMessages(false);
      setLoadingMoreMessages(false);
    }
  }, [workspace?.id]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!workspace?.id || isPersonalWorkspace) return;

    try {
      const response = await getChatUnreadCount(workspace.id);
      setUnreadCount(response.data.unread_count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, [workspace?.id, isPersonalWorkspace]);

  // Initial load
  useEffect(() => {
    fetchThreads();
    fetchUnreadCount();
  }, [fetchThreads, fetchUnreadCount]);

  // Load messages when thread changes
  useEffect(() => {
    if (selectedThread?.id) {
      fetchMessages(selectedThread.id);
      subscribeThread(selectedThread.id);

      // Mark thread as read
      markThreadRead(workspace?.id, selectedThread.id).then(() => {
        // Update local unread count
        setThreads(prev => prev.map(t => 
          t.id === selectedThread.id ? { ...t, unread_count: 0 } : t
        ));
        fetchUnreadCount();
      }).catch(console.error);

      return () => {
        unsubscribeThread(selectedThread.id);
      };
    }
  }, [selectedThread?.id, workspace?.id, fetchMessages, subscribeThread, unsubscribeThread, fetchUnreadCount]);

  // Handle thread selection
  const handleSelectThread = (thread) => {
    setSelectedThread(thread);
    setTypingUsers([]);
    fetchThreadDetails(thread.id);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  // Handle send message
  const handleSendMessage = async (content, attachmentIds = []) => {
    if (!workspace?.id || !selectedThread?.id) return;

    try {
      console.log('Sending message to thread:', selectedThread.id, 'with attachments:', attachmentIds);
      const response = await sendChatMessage(workspace.id, selectedThread.id, content, attachmentIds);
      console.log('Message sent successfully:', response.data.id);
      
      // Don't add optimistically - let WebSocket handle it for consistency
      // The WebSocket will receive message_created event and update UI
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    }
  };

  // Handle typing indicator
  const handleTyping = (isTyping) => {
    if (selectedThread?.id) {
      sendTyping(selectedThread.id, isTyping);
    }
  };

  // Handle load more messages
  const handleLoadMore = () => {
    if (messages.length > 0 && hasMoreMessages && !loadingMoreMessages) {
      fetchMessages(selectedThread.id, messages[0].id);
    }
  };

  // Create DM
  const handleCreateDm = async (userId) => {
    try {
      const response = await createDmThread(workspace.id, userId);
      const thread = response.data.thread;
      
      if (response.data.created) {
        setThreads(prev => [thread, ...prev]);
      }
      
      setSelectedThread(thread);
      if (isMobile) {
        setMobileDrawerOpen(false);
      }
    } catch (error) {
      console.error('Failed to create DM:', error);
      setError('Failed to create conversation. Please try again.');
      throw error; // Re-throw for dialog error handling
    }
  };

  // Create Group
  const handleCreateGroup = async (name, memberIds) => {
    try {
      const response = await createGroupThread(workspace.id, name, memberIds);
      const thread = response.data;
      
      setThreads(prev => [thread, ...prev]);
      setSelectedThread(thread);
      if (isMobile) {
        setMobileDrawerOpen(false);
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      setError('Failed to create group chat. Please try again.');
      throw error; // Re-throw for dialog error handling
    }
  };

  const handleCreateChannel = async (payload) => {
    try {
      const response = await createChannelThread(workspace.id, payload);
      const thread = response.data;
      setThreads((prev) => [thread, ...prev]);
      setSelectedThread(thread);
      if (isMobile) {
        setMobileDrawerOpen(false);
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
      setError('Failed to create channel. Please try again.');
      throw error;
    }
  };

  // Update thread (rename)
  const handleRenameGroup = async (name) => {
    if (!selectedThread?.id) return;
    await updateChatThread(workspace.id, selectedThread.id, { name });
    
    setSelectedThread(prev => ({ ...prev, name }));
    setThreads(prev => prev.map(t => 
      t.id === selectedThread.id ? { ...t, name } : t
    ));
  };

  // Add members to thread
  const handleAddMembers = async (userIds) => {
    if (!selectedThread?.id) return;
    await addThreadMembers(workspace.id, selectedThread.id, userIds);
    fetchThreadDetails(selectedThread.id);
  };

  // Remove member from thread
  const handleRemoveMember = async (userId) => {
    if (!selectedThread?.id) return;
    await removeThreadMember(workspace.id, selectedThread.id, userId);
    fetchThreadDetails(selectedThread.id);
  };

  // Leave thread
  const handleLeaveThread = async () => {
    if (!selectedThread?.id) return;
    await removeThreadMember(workspace.id, selectedThread.id, user.id);
    setSelectedThread(null);
    setMessages([]);
    fetchThreads();
  };

  // Handle mention click
  const handleMentionClick = (type, id) => {
    // Could navigate to the mentioned entity
    console.log('Mention clicked:', type, id);
  };

  const handleReplyToMessage = async (messageId, content) => {
    if (!workspace?.id || !selectedThread?.id) return;
    await sendChatReply(workspace.id, selectedThread.id, content, messageId);
  };

  const handlePinToggle = async (message) => {
    if (!workspace?.id || !selectedThread?.id) return;
    if (message.pinned_at) {
      await unpinChatMessage(workspace.id, selectedThread.id, message.id);
    } else {
      await pinChatMessage(workspace.id, selectedThread.id, message.id);
    }
    fetchThreadDetails(selectedThread.id);
    fetchMessages(selectedThread.id);
  };

  // If personal workspace, show message
  if (isPersonalWorkspace) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          p: 4,
          textAlign: 'center',
        }}
      >
        <ChatIcon sx={{ fontSize: 64, color: 'grey.400' }} />
        <Typography variant="h5" color="text.secondary">
          Chat not available
        </Typography>
        <Typography color="text.secondary">
          Workspace Chat is only available for team workspaces, not personal workspaces.
        </Typography>
      </Box>
    );
  }

  const threadListContent = (
    <ChatThreadList
      threads={threads}
      selectedThreadId={selectedThread?.id}
      onSelectThread={handleSelectThread}
      onCreateDm={() => setCreateDmOpen(true)}
      onCreateGroup={() => setCreateGroupOpen(true)}
      currentUserId={user?.id}
      loading={loadingThreads}
      onCreateChannel={() => setCreateChannelOpen(true)}
    />
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', minHeight: 0 }}>
      {/* Thread List - Desktop */}
      {!isMobile && (
        <Paper
          elevation={0}
          sx={{
            width: THREAD_LIST_WIDTH,
            borderRight: 1,
            borderColor: 'divider',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {threadListContent}
        </Paper>
      )}

      {/* Thread List - Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: THREAD_LIST_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          {threadListContent}
        </Drawer>
      )}

      {/* Message Pane */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ChatMessagePane
          thread={selectedThread}
          messages={messages}
          currentUserId={user?.id}
          loading={loadingMessages}
          loadingMore={loadingMoreMessages}
          hasMoreMessages={hasMoreMessages}
          onLoadMore={handleLoadMore}
          onMentionClick={handleMentionClick}
          typingUsers={typingUsers}
          onBack={() => setMobileDrawerOpen(true)}
          onManageMembers={() => setManageMembersOpen(true)}
          onRenameGroup={() => setRenameGroupOpen(true)}
          onLeaveThread={handleLeaveThread}
          onReplyToMessage={handleReplyToMessage}
          onPinToggle={handlePinToggle}
          isMobile={isMobile}
        />

        {/* Composer */}
        {selectedThread && (
          <ChatComposer
            workspaceId={workspace?.id}
            threadId={selectedThread.id}
            onSend={handleSendMessage}
            onTyping={handleTyping}
            disabled={!isConnected}
          />
        )}
      </Box>

      {/* Dialogs */}
      <CreateDmDialog
        open={createDmOpen}
        onClose={() => setCreateDmOpen(false)}
        onCreateDm={handleCreateDm}
        workspaceId={workspace?.id}
        currentUserId={user?.id}
      />

      <CreateGroupDialog
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreateGroup={handleCreateGroup}
        workspaceId={workspace?.id}
        currentUserId={user?.id}
      />

      <CreateChannelDialog
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        onCreateChannel={handleCreateChannel}
      />

      <ManageMembersDialog
        open={manageMembersOpen}
        onClose={() => setManageMembersOpen(false)}
        thread={selectedThread}
        workspaceId={workspace?.id}
        currentUserId={user?.id}
        onAddMembers={handleAddMembers}
        onRemoveMember={handleRemoveMember}
      />

      <RenameGroupDialog
        open={renameGroupOpen}
        onClose={() => setRenameGroupOpen(false)}
        thread={selectedThread}
        onRename={handleRenameGroup}
      />

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ChatPage;
