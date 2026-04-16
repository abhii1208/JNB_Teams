/**
 * Chat Message Pane Component
 * Displays messages with auto-scroll and message composer
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Paper,
  Chip,
  Skeleton,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  AvatarGroup,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText as MuiListItemText,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import { formatInTimeZone } from 'date-fns-tz';
import { downloadAttachment } from '../../apiClient';

// Helper function to get file icon based on MIME type
function getAttachmentIcon(mimeType) {
  if (!mimeType) return <InsertDriveFileIcon fontSize="small" />;
  if (mimeType.startsWith('image/')) return <ImageIcon fontSize="small" />;
  if (mimeType === 'application/pdf') return <PictureAsPdfIcon fontSize="small" />;
  return <InsertDriveFileIcon fontSize="small" />;
}

// Helper function to format file size
function formatAttachmentSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Component to display attachments in a message
function MessageAttachments({ attachments, isOwn }) {
  if (!attachments || attachments.length === 0) return null;

  const handleDownload = async (attachment) => {
    try {
      const response = await downloadAttachment(attachment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.original_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download attachment:', err);
    }
  };

  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {attachments.map((attachment) => (
        <Box
          key={attachment.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 0.75,
            borderRadius: 1,
            backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: isOwn ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
            },
          }}
          onClick={() => handleDownload(attachment)}
        >
          <Box sx={{ color: isOwn ? 'inherit' : 'text.secondary' }}>
            {getAttachmentIcon(attachment.mime_type)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 500 }}>
              {attachment.original_name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7, fontSize: '0.65rem' }}>
              {formatAttachmentSize(attachment.file_size)}
            </Typography>
          </Box>
          <Tooltip title="Download">
            <DownloadIcon fontSize="small" sx={{ opacity: 0.7 }} />
          </Tooltip>
        </Box>
      ))}
    </Box>
  );
}

function getInitials(firstName, lastName, username) {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (username) return username[0].toUpperCase();
  return '?';
}

function getDisplayName(member) {
  if (!member) return 'Unknown';
  if (member.first_name && member.last_name) {
    return `${member.first_name} ${member.last_name}`;
  }
  if (member.sender_first_name && member.sender_last_name) {
    return `${member.sender_first_name} ${member.sender_last_name}`;
  }
  return member.username || member.sender_username || 'Unknown';
}

// IST timezone constant
const IST_TIMEZONE = 'Asia/Kolkata';

function formatMessageDate(date) {
  const d = new Date(date);
  const now = new Date();
  
  // Check if it's today/yesterday in IST
  const istDate = formatInTimeZone(d, IST_TIMEZONE, 'yyyy-MM-dd');
  const todayIST = formatInTimeZone(now, IST_TIMEZONE, 'yyyy-MM-dd');
  const yesterdayIST = formatInTimeZone(new Date(now.getTime() - 24 * 60 * 60 * 1000), IST_TIMEZONE, 'yyyy-MM-dd');
  
  if (istDate === todayIST) {
    return formatInTimeZone(d, IST_TIMEZONE, 'h:mm a');
  }
  if (istDate === yesterdayIST) {
    return `Yesterday ${formatInTimeZone(d, IST_TIMEZONE, 'h:mm a')}`;
  }
  return formatInTimeZone(d, IST_TIMEZONE, 'MMM d, h:mm a');
}

function formatDateHeader(date) {
  const d = new Date(date);
  const now = new Date();
  
  // Check if it's today/yesterday in IST
  const istDate = formatInTimeZone(d, IST_TIMEZONE, 'yyyy-MM-dd');
  const todayIST = formatInTimeZone(now, IST_TIMEZONE, 'yyyy-MM-dd');
  const yesterdayIST = formatInTimeZone(new Date(now.getTime() - 24 * 60 * 60 * 1000), IST_TIMEZONE, 'yyyy-MM-dd');
  
  if (istDate === todayIST) return 'Today';
  if (istDate === yesterdayIST) return 'Yesterday';
  return formatInTimeZone(d, IST_TIMEZONE, 'MMMM d, yyyy');
}

// Render message content with mentions highlighted
function MessageContent({ content, onMentionClick }) {
  const theme = useTheme();
  
  const parts = useMemo(() => {
    const mentionRegex = /@\[(user|project|task):(\d+):([^\]]+)\]/g;
    const result = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }
      // Add mention
      result.push({
        type: 'mention',
        mentionType: match[1],
        id: parseInt(match[2], 10),
        display: match[3]
      });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      result.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    return result;
  }, [content]);

  const getMentionColor = (type) => {
    switch (type) {
      case 'user': return theme.palette.primary.main;
      case 'project': return theme.palette.secondary.main;
      case 'task': return theme.palette.info.main;
      default: return theme.palette.primary.main;
    }
  };

  const getMentionIcon = (type) => {
    switch (type) {
      case 'user': return '@';
      case 'project': return '#';
      case 'task': return '✓';
      default: return '@';
    }
  };

  return (
    <Typography
      variant="body2"
      component="div"
      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
    >
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.content}</span>;
        }
        return (
          <Chip
            key={i}
            label={`${getMentionIcon(part.mentionType)}${part.display}`}
            size="small"
            onClick={() => onMentionClick?.(part.mentionType, part.id)}
            sx={{
              height: 20,
              fontSize: '0.8rem',
              backgroundColor: `${getMentionColor(part.mentionType)}20`,
              color: getMentionColor(part.mentionType),
              cursor: 'pointer',
              mx: 0.25,
              '&:hover': {
                backgroundColor: `${getMentionColor(part.mentionType)}30`,
              },
            }}
          />
        );
      })}
    </Typography>
  );
}

function MessageBubble({ message, isOwn, isFirstInGroup, showAvatar, onMentionClick, onReply, onPinToggle, canPin }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 1,
        mb: isFirstInGroup ? 0.5 : 1.5,
      }}
    >
      {/* Avatar */}
      <Box sx={{ width: 32, flexShrink: 0 }}>
        {showAvatar && !isOwn && (
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.875rem',
              bgcolor: `hsl(${(message.sender_id || 0) * 40}, 60%, 50%)`,
            }}
          >
            {getInitials(message.sender_first_name, message.sender_last_name, message.sender_username)}
          </Avatar>
        )}
      </Box>

      {/* Message */}
      <Box sx={{ maxWidth: '70%' }}>
        {/* Sender name for first message in group */}
        {showAvatar && !isOwn && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 1, mb: 0.25, display: 'block' }}
          >
            {getDisplayName(message)}
          </Typography>
        )}
        
        <Paper
          elevation={0}
          sx={{
            px: 1.5,
            py: 1,
            borderRadius: 2,
            backgroundColor: isOwn ? 'primary.main' : 'grey.100',
            color: isOwn ? 'primary.contrastText' : 'text.primary',
            borderTopLeftRadius: !isOwn && !showAvatar ? 4 : undefined,
            borderTopRightRadius: isOwn && !showAvatar ? 4 : undefined,
          }}
        >
          {message.parent_message_content ? (
            <Paper variant="outlined" sx={{ p: 0.75, mb: 0.75, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" noWrap>
                Replying to: {message.parent_message_content}
              </Typography>
            </Paper>
          ) : null}
          {message.content && (
            <MessageContent content={message.content} onMentionClick={onMentionClick} />
          )}
          {/* Display attachments if any */}
          <MessageAttachments attachments={message.attachments} isOwn={isOwn} />
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
            <Button size="small" onClick={() => onReply?.(message)} sx={{ minWidth: 0, px: 0.75 }}>Reply</Button>
            {canPin ? (
              <Button size="small" onClick={() => onPinToggle?.(message)} sx={{ minWidth: 0, px: 0.75 }}>
                {message.pinned_at ? 'Unpin' : 'Pin'}
              </Button>
            ) : null}
          </Box>
        </Paper>

        {/* Timestamp */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            textAlign: isOwn ? 'right' : 'left',
            mt: 0.25,
            mx: 1,
            fontSize: '0.7rem',
          }}
        >
          {formatMessageDate(message.created_at)}
        </Typography>
      </Box>
    </Box>
  );
}

function DateSeparator({ date }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
      <Divider sx={{ flex: 1 }} />
      <Chip
        label={formatDateHeader(date)}
        size="small"
        sx={{ mx: 2, fontSize: '0.75rem' }}
      />
      <Divider sx={{ flex: 1 }} />
    </Box>
  );
}

function TypingIndicator({ typingUsers }) {
  if (!typingUsers || typingUsers.length === 0) return null;

  const names = typingUsers.map(u => getDisplayName(u)).join(', ');
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {[0, 1, 2].map(i => (
          <Box
            key={i}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'grey.400',
              animation: 'typing 1.4s infinite',
              animationDelay: `${i * 0.2}s`,
              '@keyframes typing': {
                '0%, 60%, 100%': { transform: 'translateY(0)' },
                '30%': { transform: 'translateY(-4px)' },
              },
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {names} {typingUsers.length === 1 ? 'is' : 'are'} typing...
      </Typography>
    </Box>
  );
}

// Thread Info Modal Component
function ThreadInfoModal({ open, onClose, thread }) {
  if (!thread) return null;

  const isGroup = thread.type === 'group' || thread.type === 'channel';
  const createdDate = new Date(thread.created_at);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar>
            {isGroup ? (
              thread.name?.[0]?.toUpperCase() || 'G'
            ) : (
              getInitials(
                thread.members?.[0]?.first_name,
                thread.members?.[0]?.last_name,
                thread.members?.[0]?.username
              )
            )}
          </Avatar>
          <Box>
            <Typography variant="h6">
              {isGroup ? thread.name : 'Direct Message'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created {formatInTimeZone(createdDate, IST_TIMEZONE, 'PPP p')}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box mb={3}>
          <Typography variant="subtitle1" gutterBottom>
            Members ({thread.members?.length || 0})
          </Typography>
          <List>
            {thread.members?.map((member) => (
              <ListItem key={member.user_id}>
                <ListItemAvatar>
                  <Avatar>
                    {getInitials(member.first_name, member.last_name, member.username)}
                  </Avatar>
                </ListItemAvatar>
                <MuiListItemText
                  primary={getDisplayName(member)}
                  secondary={`@${member.username || 'unknown'}`}
                />
                {member.role === 'admin' && (
                  <Chip label="Admin" size="small" color="primary" />
                )}
              </ListItem>
            ))}
          </List>
        </Box>
        
        {isGroup && thread.description && (
          <Box mb={2}>
            <Typography variant="subtitle1" gutterBottom>
              Description
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {thread.description}
            </Typography>
          </Box>
        )}
        
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Thread Statistics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Thread ID: {thread.id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Type: {isGroup ? 'Group Chat' : 'Direct Message'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Created: {formatInTimeZone(createdDate, IST_TIMEZONE, 'PPP p')}
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function ChatMessagePane({
  thread,
  messages,
  currentUserId,
  loading,
  loadingMore,
  hasMoreMessages,
  onLoadMore,
  onMentionClick,
  typingUsers,
  onBack,
  onManageMembers,
  onRenameGroup,
  onLeaveThread,
  onReplyToMessage,
  onPinToggle,
  isMobile,
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [threadInfoOpen, setThreadInfoOpen] = useState(false);

  const isGroup = thread?.type === 'group';
  const isAdmin = useMemo(() => {
    if (!thread?.members) return false;
    const member = thread.members.find(m => m.user_id === currentUserId);
    return member?.role === 'admin' || thread.created_by === currentUserId;
  }, [thread, currentUserId]);

  // Get display name for thread header
  const threadDisplayName = useMemo(() => {
    if (!thread) return '';
    if (isGroup) return thread.name || 'Group Chat';
    const otherMember = thread.members?.find(m => m.user_id !== currentUserId);
    return otherMember ? getDisplayName(otherMember) : 'Direct Message';
  }, [thread, isGroup, currentUserId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
    setShowScrollButton(!isNearBottom);

    // Load more when scrolled to top
    if (scrollTop < 50 && hasMoreMessages && !loadingMore) {
      onLoadMore?.();
    }
  }, [hasMoreMessages, loadingMore, onLoadMore]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  };

  // Group messages by date and consecutive sender
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;
    let currentSenderId = null;

    messages.forEach((msg, index) => {
      const msgDate = new Date(msg.created_at);
      const dateKey = formatInTimeZone(msgDate, IST_TIMEZONE, 'yyyy-MM-dd');

      // Add date separator if new day
      if (dateKey !== currentDate) {
        groups.push({ type: 'date', date: msg.created_at, key: `date-${dateKey}` });
        currentDate = dateKey;
        currentSenderId = null;
      }

      // Check if this is first message from this sender in sequence
      const isFirstInGroup = msg.sender_id !== currentSenderId;
      currentSenderId = msg.sender_id;

      // Check if next message is from same sender (for avatar display)
      const nextMsg = messages[index + 1];
      const isLastInGroup = !nextMsg || 
        nextMsg.sender_id !== msg.sender_id ||
        formatInTimeZone(new Date(nextMsg.created_at), IST_TIMEZONE, 'yyyy-MM-dd') !== dateKey;

      groups.push({
        type: 'message',
        message: msg,
        isFirstInGroup,
        showAvatar: isLastInGroup,
        key: `msg-${msg.id}-${index}`, // Add index to ensure uniqueness
      });
    });

    return groups;
  }, [messages]);

  if (!thread) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          color: 'text.secondary',
        }}
      >
        <Typography variant="h6">Select a conversation</Typography>
        <Typography variant="body2">
          Choose a conversation from the list or start a new one
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {isMobile && (
          <IconButton onClick={onBack} edge="start">
            <ArrowBackIcon />
          </IconButton>
        )}
        
        {isGroup ? (
          <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: 12 } }}>
            {thread.members?.slice(0, 3).map((m) => (
              <Avatar
                key={m.user_id}
                sx={{ bgcolor: `hsl(${(m.user_id || 0) * 40}, 60%, 50%)` }}
              >
                {getInitials(m.first_name, m.last_name, m.username)}
              </Avatar>
            ))}
          </AvatarGroup>
        ) : (
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {thread.members?.find(m => m.user_id !== currentUserId) &&
              getInitials(
                thread.members.find(m => m.user_id !== currentUserId).first_name,
                thread.members.find(m => m.user_id !== currentUserId).last_name,
                thread.members.find(m => m.user_id !== currentUserId).username
              )}
          </Avatar>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {threadDisplayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {thread.type === 'channel' ? `Channel • ${thread.visibility || 'workspace'}` : isGroup ? `${thread.members?.length || 0} members` : 'Direct message'}
          </Typography>
        </Box>

        <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
      </Box>

      {/* Messages */}
      <Box
        ref={messagesContainerRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 2,
          py: 1,
          position: 'relative',
        }}
      >
        {/* Load more indicator */}
        {loadingMore && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {loading ? (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Box key={i} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Skeleton variant="circular" width={32} height={32} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="30%" />
                  <Skeleton variant="rounded" width="60%" height={40} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : groupedMessages.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Typography color="text.secondary">No messages yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Start the conversation!
            </Typography>
          </Box>
        ) : (
          <>
            {(thread.intro_text || thread.description) ? (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {thread.type === 'channel' ? 'Channel Introduction' : 'Conversation Intro'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {thread.intro_text || thread.description}
                </Typography>
              </Paper>
            ) : null}

            {(thread.pinned_messages || []).length > 0 ? (
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Pinned Messages</Typography>
                {(thread.pinned_messages || []).slice(0, 3).map((item) => (
                  <Typography key={item.id} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    • {item.content}
                  </Typography>
                ))}
              </Paper>
            ) : null}

            {groupedMessages.map((item) => {
              if (item.type === 'date') {
                return <DateSeparator key={item.key} date={item.date} />;
              }
              return (
                <MessageBubble
                  key={item.key}
                  message={item.message}
                  isOwn={item.message.sender_id === currentUserId}
                  isFirstInGroup={item.isFirstInGroup}
                  showAvatar={item.showAvatar}
                  onMentionClick={onMentionClick}
                  onReply={(message) => {
                    const replyText = window.prompt(`Reply to "${message.content || 'message'}"`);
                    if (replyText?.trim()) {
                      onReplyToMessage?.(message.id, replyText.trim());
                    }
                  }}
                  onPinToggle={onPinToggle}
                  canPin={isAdmin}
                />
              );
            })}
          </>
        )}

        {/* Typing indicator */}
        <TypingIndicator typingUsers={typingUsers} />

        <div ref={messagesEndRef} />
      </Box>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Tooltip title="Scroll to bottom">
          <IconButton
            onClick={scrollToBottom}
            sx={{
              position: 'absolute',
              bottom: 100,
              right: 24,
              backgroundColor: 'background.paper',
              boxShadow: 2,
              '&:hover': { backgroundColor: 'grey.100' },
            }}
          >
            <KeyboardArrowDownIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Thread menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); setThreadInfoOpen(true); }}>
          <ListItemIcon><InfoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Thread Info</ListItemText>
        </MenuItem>
        {isGroup && isAdmin && (
          <>
            <MenuItem onClick={() => { setMenuAnchor(null); onRenameGroup?.(); }}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Rename Group</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); onManageMembers?.(); }}>
              <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Manage Members</ListItemText>
            </MenuItem>
          </>
        )}
        {isGroup && !isAdmin && (
          <MenuItem onClick={() => { setMenuAnchor(null); onLeaveThread?.(); }}>
            <ListItemIcon><PersonRemoveIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Leave Group</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Thread Info Modal */}
      <ThreadInfoModal 
        open={threadInfoOpen}
        onClose={() => setThreadInfoOpen(false)}
        thread={thread}
      />
    </Box>
  );
}

export default ChatMessagePane;
