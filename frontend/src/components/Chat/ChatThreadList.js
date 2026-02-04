/**
 * Chat Thread List Component
 * Shows all chat threads with unread badges and last message preview
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  AvatarGroup,
  Badge,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  Skeleton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import { formatInTimeZone } from 'date-fns-tz';

function getInitials(firstName, lastName, username) {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (username) return username[0].toUpperCase();
  return '?';
}

function getDisplayName(member) {
  if (member.first_name && member.last_name) {
    return `${member.first_name} ${member.last_name}`;
  }
  return member.username || 'Unknown';
}

function ThreadListItem({ thread, currentUserId, isSelected, onClick }) {
  const isDm = thread.type === 'dm';
  
  // For DMs, get the other user
  const otherMember = useMemo(() => {
    if (!isDm || !thread.members) return null;
    return thread.members.find(m => m.user_id !== currentUserId);
  }, [isDm, thread.members, currentUserId]);

  const displayName = useMemo(() => {
    if (isDm && otherMember) {
      return getDisplayName(otherMember);
    }
    return thread.name || 'Group Chat';
  }, [isDm, otherMember, thread.name]);

  const lastMessagePreview = useMemo(() => {
    if (!thread.last_message) return 'No messages yet';
    const content = thread.last_message.content || '';
    // Strip mention markup for preview
    const cleanContent = content.replace(/@\[(user|project|task):\d+:([^\]]+)\]/g, '@$2');
    return cleanContent.length > 50 ? cleanContent.substring(0, 50) + '...' : cleanContent;
  }, [thread.last_message]);

  const timeAgo = useMemo(() => {
    if (!thread.last_message?.created_at) return '';
    try {
      const messageDate = new Date(thread.last_message.created_at);
      const now = new Date();
      
      // Calculate time difference
      const diffInMs = now.getTime() - messageDate.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      
      if (diffInMinutes < 1) return 'now';
      if (diffInMinutes < 60) return `${diffInMinutes}m`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d`;
      
      // For older messages, show the actual date in IST
      return formatInTimeZone(messageDate, 'Asia/Kolkata', 'MMM d');
    } catch {
      return '';
    }
  }, [thread.last_message]);

  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={isSelected}
        onClick={onClick}
        sx={{
          borderRadius: 2,
          mx: 1,
          '&.Mui-selected': {
            backgroundColor: 'primary.light',
            '&:hover': {
              backgroundColor: 'primary.light',
            },
          },
        }}
      >
        <ListItemAvatar>
          <Badge
            badgeContent={thread.unread_count || 0}
            color="error"
            max={99}
            invisible={!thread.unread_count}
          >
            {isDm && otherMember ? (
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                {getInitials(otherMember.first_name, otherMember.last_name, otherMember.username)}
              </Avatar>
            ) : (
              <AvatarGroup max={2} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 12 } }}>
                {(thread.members || []).slice(0, 3).map((m, i) => (
                  <Avatar key={`${thread.id}-member-${m.user_id || i}`} sx={{ bgcolor: `hsl(${(m.user_id || i) * 40}, 60%, 50%)`, width: 40, height: 40 }}>
                    {getInitials(m.first_name, m.last_name, m.username)}
                  </Avatar>
                ))}
              </AvatarGroup>
            )}
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: thread.unread_count ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {displayName}
              </Typography>
              {timeAgo && (
                <Typography variant="caption" color="text.secondary">
                  {timeAgo}
                </Typography>
              )}
            </Box>
          }
          secondary={
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: thread.unread_count ? 500 : 400,
              }}
            >
              {lastMessagePreview}
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );
}

function ChatThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  onCreateDm,
  onCreateGroup,
  currentUserId,
  loading,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter(thread => {
      // Search by thread name
      if (thread.name?.toLowerCase().includes(query)) return true;
      // Search by member names
      if (thread.members?.some(m => 
        m.username?.toLowerCase().includes(query) ||
        m.first_name?.toLowerCase().includes(query) ||
        m.last_name?.toLowerCase().includes(query)
      )) return true;
      return false;
    });
  }, [threads, searchQuery]);

  const dmThreads = useMemo(() => 
    filteredThreads.filter(t => t.type === 'dm'), 
    [filteredThreads]
  );

  const groupThreads = useMemo(() => 
    filteredThreads.filter(t => t.type === 'group'), 
    [filteredThreads]
  );

  const handleCreateClick = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleCreateDm = () => {
    handleMenuClose();
    onCreateDm();
  };

  const handleCreateGroup = () => {
    handleMenuClose();
    onCreateGroup();
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="80%" />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Messages
          </Typography>
          <Tooltip title="New conversation">
            <IconButton onClick={handleCreateClick} color="primary" size="small">
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <TextField
          size="small"
          fullWidth
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backgroundColor: 'grey.100',
            },
          }}
        />
      </Box>

      {/* Thread List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredThreads.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Start a new conversation to begin chatting
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 1 }}>
            {/* Direct Messages */}
            {dmThreads.length > 0 && (
              <>
                <ListItem sx={{ py: 0.5, px: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    DIRECT MESSAGES
                  </Typography>
                </ListItem>
                {dmThreads.map(thread => (
                  <ThreadListItem
                    key={thread.id}
                    thread={thread}
                    currentUserId={currentUserId}
                    isSelected={selectedThreadId === thread.id}
                    onClick={() => onSelectThread(thread)}
                  />
                ))}
              </>
            )}

            {/* Group Chats */}
            {groupThreads.length > 0 && (
              <>
                {dmThreads.length > 0 && <Divider sx={{ my: 1 }} />}
                <ListItem sx={{ py: 0.5, px: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    GROUP CHATS
                  </Typography>
                </ListItem>
                {groupThreads.map(thread => (
                  <ThreadListItem
                    key={thread.id}
                    thread={thread}
                    currentUserId={currentUserId}
                    isSelected={selectedThreadId === thread.id}
                    onClick={() => onSelectThread(thread)}
                  />
                ))}
              </>
            )}
          </List>
        )}
      </Box>

      {/* Create Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleCreateDm}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>New Direct Message</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCreateGroup}>
          <ListItemIcon>
            <GroupIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>New Group Chat</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default ChatThreadList;
