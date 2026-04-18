/**
 * NotificationsPage Component
 * Displays notifications with real-time updates, proper IST timezone, and dynamic navigation
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Tab,
  Tabs,
  Typography,
  Avatar,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import TaskIcon from '@mui/icons-material/Assignment';
import CommentIcon from '@mui/icons-material/Comment';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import WarningIcon from '@mui/icons-material/Warning';
import ChatIcon from '@mui/icons-material/Chat';
import SettingsIcon from '@mui/icons-material/Settings';
import ApprovalIcon from '@mui/icons-material/ThumbUpAlt';
import BusinessIcon from '@mui/icons-material/Business';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from '../../apiClient';

const notificationIcons = {
  task_created: <TaskIcon />,
  task_assigned: <TaskIcon />,
  task_collaborator_added: <PersonAddIcon />,
  task_unassigned: <TaskIcon />,
  task_due_changed: <TaskIcon />,
  task_mentioned: <CommentIcon />,
  task_attachment: <TaskIcon />,
  task_comment: <CommentIcon />,
  task_completed: <TaskIcon />,
  task_status_changed: <TaskIcon />,
  task_liked: <TaskIcon />,
  completion_liked: <TaskIcon />,
  comment_liked: <CommentIcon />,
  attachment_liked: <TaskIcon />,
  dependency_changed: <TaskIcon />,
  chat_message: <ChatIcon />,
  chat_group_message: <ChatIcon />,
  chat_mentioned: <ChatIcon />,
  project_settings: <SettingsIcon />,
  project_member: <PersonAddIcon />,
  client_added: <BusinessIcon />,
  client_changed: <BusinessIcon />,
  approval_requested: <ApprovalIcon />,
  approval_approved: <ApprovalIcon />,
  approval_rejected: <ApprovalIcon />,
  deadline: <WarningIcon />,
  task: <TaskIcon />,
  comment: <CommentIcon />,
  member: <PersonAddIcon />,
  Task: <TaskIcon />,
  Approval: <ApprovalIcon />,
  Project: <SettingsIcon />,
  Chat: <ChatIcon />,
};

const notificationColors = {
  task_created: '#0f766e',
  task_assigned: '#0284c7',
  task_collaborator_added: '#0f766e',
  task_unassigned: '#dc2626',
  task_due_changed: '#ea580c',
  task_mentioned: '#7c3aed',
  task_attachment: '#0284c7',
  task_comment: '#7c3aed',
  task_completed: '#16a34a',
  task_status_changed: '#0f766e',
  task_liked: '#ec4899',
  completion_liked: '#ec4899',
  comment_liked: '#ec4899',
  attachment_liked: '#ec4899',
  dependency_changed: '#0284c7',
  chat_message: '#6366f1',
  chat_group_message: '#6366f1',
  chat_mentioned: '#7c3aed',
  project_settings: '#f59e0b',
  project_member: '#16a34a',
  client_added: '#0891b2',
  client_changed: '#0891b2',
  approval_requested: '#f59e0b',
  approval_approved: '#16a34a',
  approval_rejected: '#dc2626',
  deadline: '#ea580c',
  task: '#0284c7',
  comment: '#7c3aed',
  member: '#16a34a',
  Task: '#0284c7',
  Approval: '#f59e0b',
  Project: '#f59e0b',
  Chat: '#6366f1',
};

/**
 * Format timestamp in IST (Indian Standard Time - UTC+5:30)
 * Format: DD-MMM-YY HH:MM AM/PM
 * 
 * Backend now sends timestamps with 'Z' suffix (UTC) via db.js type parser.
 * This function converts UTC to IST for display.
 */
function formatTimestampIST(timestamp) {
  if (!timestamp) return '';
  
  try {
    // Parse the timestamp - backend sends ISO format with 'Z' suffix
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', timestamp);
      return '';
    }
    
    // Use Intl.DateTimeFormat for reliable IST formatting
    const formatter = new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
    
    const parts = formatter.formatToParts(date);
    const getPart = (type) => parts.find(p => p.type === type)?.value || '';
    
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const dayPeriod = getPart('dayPeriod').toUpperCase();
    
    // Format: DD-MMM-YY HH:MM AM/PM
    return `${day}-${month}-${year} ${hour}:${minute} ${dayPeriod}`;
  } catch (err) {
    console.error('Error formatting timestamp:', err);
    return '';
  }
}

function NotificationsPage({ onNavigate, notifications: externalNotifications, onRefresh }) {
  const [activeTab, setActiveTab] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getNotifications();
      setNotifications(response.data || []);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [onRefresh]);

  // Seed from external notifications for responsiveness, then fetch the latest from API.
  useEffect(() => {
    if (externalNotifications) {
      setNotifications(externalNotifications);
    }
    fetchNotifications();
  }, [externalNotifications, fetchNotifications]);

  // Auto-refresh every 10 seconds for real-time feel.
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const filteredNotifications = notifications
    // Filter out invalid notifications - must have id AND (title with content OR message with content)
    .filter(notif => {
      if (!notif || !notif.id) return false;
      const hasTitle = notif.title && notif.title.trim && notif.title.trim().length > 0;
      const hasMessage = notif.message && notif.message.trim && notif.message.trim().length > 0;
      return hasTitle || hasMessage;
    })
    .filter(notif => {
      if (activeTab === 0) return !notif.read;
      if (activeTab === 1) return notif.read;
      return true;
    });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  /**
   * Handle notification click with dynamic navigation
   */
  const handleNotificationClick = async (notification) => {
    // Mark as read when clicked
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    if (!onNavigate) return;

    const type = notification.type?.toLowerCase() || '';

    // Priority 1: Use action_url if available
    if (notification.action_url) {
      const url = notification.action_url;
      
      if (url.startsWith('/tasks/')) {
        const taskId = parseInt(url.split('/tasks/')[1]);
        onNavigate('tasks', { projectId: notification.project_id, taskId });
      } else if (url.startsWith('/chat/')) {
        const threadId = parseInt(url.split('/chat/')[1]);
        onNavigate('chat', { threadId });
      } else if (url.startsWith('/projects/')) {
        const projectId = parseInt(url.split('/projects/')[1]);
        onNavigate('projects', { projectId });
      } else if (url.startsWith('/clients/')) {
        const clientId = parseInt(url.split('/clients/')[1]);
        onNavigate('clients', { clientId });
      } else if (url.startsWith('/approvals')) {
        onNavigate('approvals', { projectId: notification.project_id });
      }
      return;
    }

    // Priority 2: Navigate based on notification type
    if (type.includes('approval')) {
      // All approval notifications go to approvals page
      onNavigate('approvals', { projectId: notification.project_id });
    } else if (type.includes('task') || notification.task_id) {
      // Task-related notifications go to tasks page
      onNavigate('tasks', { 
        projectId: notification.project_id, 
        taskId: notification.task_id 
      });
    } else if (type.includes('chat') || notification.chat_thread_id) {
      // Chat notifications go to chat page
      onNavigate('chat', { threadId: notification.chat_thread_id });
    } else if (type.includes('client') || notification.client_id) {
      // Client notifications go to clients page
      onNavigate('clients', { clientId: notification.client_id });
    } else if (type.includes('project') || notification.project_id) {
      // Project notifications go to projects page
      onNavigate('projects', { projectId: notification.project_id });
    }
  };

  const getNotificationIcon = (type) => {
    return notificationIcons[type] || <NotificationsIcon />;
  };

  const getNotificationColor = (type) => {
    return notificationColors[type] || '#64748b';
  };

  if (loading && notifications.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Notifications
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {unreadCount > 0 && (
            <Button
              startIcon={<DoneAllIcon />}
              onClick={handleMarkAllAsRead}
              variant="outlined"
              size="small"
              sx={{
                textTransform: 'none',
                borderRadius: 2,
              }}
            >
              Mark all as read
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            minWidth: 100,
          },
        }}
      >
        <Tab label={`Unread (${unreadCount})`} />
        <Tab label="Read" />
        <Tab label="All" />
      </Tabs>

      {/* Notifications List */}
      <Card elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
        <List sx={{ p: 0 }}>
          {filteredNotifications.length === 0 ? (
            <ListItem sx={{ py: 6 }}>
              <ListItemText
                primary={
                  <Typography variant="body1" color="text.secondary" align="center">
                    {activeTab === 0 ? 'No unread notifications' : 
                     activeTab === 1 ? 'No read notifications' : 'No notifications'}
                  </Typography>
                }
              />
            </ListItem>
          ) : (
            filteredNotifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItemButton
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    backgroundColor: !notification.read ? 'rgba(15, 118, 110, 0.03)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(148, 163, 184, 0.08)',
                    },
                    py: 1.5,
                  }}
                >
                  <ListItemIcon>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: `${getNotificationColor(notification.type)}15`,
                        color: getNotificationColor(notification.type),
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" component="span" sx={{ fontWeight: !notification.read ? 700 : 600 }}>
                          {notification.title || 'Notification'}
                        </Typography>
                        {!notification.read && (
                          <Box
                            component="span"
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: '#0f766e',
                              flexShrink: 0,
                              display: 'inline-block',
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                        <Typography variant="body2" component="span" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          {notification.message || 'No details available'}
                        </Typography>
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          {notification.project_name && (
                            <Chip
                              label={notification.project_name}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                backgroundColor: 'rgba(148, 163, 184, 0.1)',
                              }}
                            />
                          )}
                          {notification.task_name && (
                            <Chip
                              label={notification.task_name}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6',
                              }}
                            />
                          )}
                          {notification.sender_name && (
                            <Typography variant="caption" component="span" color="text.secondary">
                              from {notification.sender_name}
                            </Typography>
                          )}
                          {notification.created_at && (
                            <Typography variant="caption" component="span" color="text.secondary">
                              {formatTimestampIST(notification.created_at)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                    {!notification.read && (
                      <IconButton
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                        size="small"
                        sx={{ color: 'text.secondary' }}
                        title="Mark as read"
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      onClick={(e) => handleDelete(notification.id, e)}
                      size="small"
                      sx={{ color: 'text.secondary' }}
                      title="Delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItemButton>
                {index < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </Card>
    </Box>
  );
}

export default NotificationsPage;
