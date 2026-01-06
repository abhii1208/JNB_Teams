import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Typography,
  Avatar,
  IconButton,
  Divider,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TaskIcon from '@mui/icons-material/Assignment';
import CommentIcon from '@mui/icons-material/Comment';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import WarningIcon from '@mui/icons-material/Warning';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '../../apiClient';

// Mock notifications data
const mockNotifications = [
  {
    id: 1,
    type: 'task',
    title: 'Task assigned to you',
    message: 'Sarah Miller assigned you to "Complete API Integration"',
    project: 'Website Redesign',
    timestamp: '2026-01-05T14:30:00',
    read: false,
    actionable: true,
  },
  {
    id: 2,
    type: 'comment',
    title: 'New comment on your task',
    message: 'Alex Kim commented on "Review Database Schema"',
    project: 'Website Redesign',
    timestamp: '2026-01-05T12:15:00',
    read: false,
    actionable: true,
  },
  {
    id: 3,
    type: 'member',
    title: 'Added to project',
    message: 'You were added to "Marketing Campaign Q1" by John Doe',
    project: 'Marketing Campaign Q1',
    timestamp: '2026-01-05T10:45:00',
    read: false,
    actionable: false,
  },
  {
    id: 4,
    type: 'deadline',
    title: 'Deadline approaching',
    message: 'Task "Mobile Testing Phase" is due in 2 days',
    project: 'Mobile App v2',
    timestamp: '2026-01-04T16:20:00',
    read: true,
    actionable: true,
  },
  {
    id: 5,
    type: 'task',
    title: 'Task status changed',
    message: 'Patricia Lee marked "API Documentation" as completed',
    project: 'Website Redesign',
    timestamp: '2026-01-04T14:10:00',
    read: true,
    actionable: false,
  },
  {
    id: 6,
    type: 'comment',
    title: 'Mentioned in comment',
    message: 'Mike Roberts mentioned you in a comment on "Design Review"',
    project: 'Product Design',
    timestamp: '2026-01-04T11:30:00',
    read: true,
    actionable: true,
  },
  {
    id: 7,
    type: 'member',
    title: 'Role updated',
    message: 'Your role in "Engineering Team" was changed to Admin',
    project: null,
    timestamp: '2026-01-03T15:45:00',
    read: true,
    actionable: false,
  },
  {
    id: 8,
    type: 'deadline',
    title: 'Task overdue',
    message: 'Task "Update Documentation" is now overdue',
    project: 'Website Redesign',
    timestamp: '2026-01-03T13:20:00',
    read: true,
    actionable: true,
  },
];

const notificationIcons = {
  task: <TaskIcon />,
  comment: <CommentIcon />,
  member: <PersonAddIcon />,
  deadline: <WarningIcon />,
};

const notificationColors = {
  task: '#0284c7',
  comment: '#7c3aed',
  member: '#16a34a',
  deadline: '#ea580c',
};

function NotificationsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [notifications, setNotifications] = useState(mockNotifications);

  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 0) return !notif.read; // Unread
    if (activeTab === 1) return notif.read; // Read
    return true; // All
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Notifications
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Stay updated on your projects and tasks
          </Typography>
        </Box>
        {unreadCount > 0 && (
          <Button
            startIcon={<DoneAllIcon />}
            onClick={handleMarkAllAsRead}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            Mark all as read
          </Button>
        )}
      </Box>

      {/* Stats */}
      <Card
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 2,
          backgroundColor: unreadCount > 0 ? 'rgba(15, 118, 110, 0.05)' : 'transparent',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NotificationsIcon sx={{ color: '#0f766e', fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f766e' }}>
              {unreadCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unread notifications
            </Typography>
          </Box>
        </Box>
      </Card>

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
            <ListItem sx={{ py: 8 }}>
              <ListItemText
                primary={
                  <Typography variant="body2" color="text.secondary" align="center">
                    No notifications found
                  </Typography>
                }
              />
            </ListItem>
          ) : (
            filteredNotifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    backgroundColor: !notification.read ? 'rgba(15, 118, 110, 0.03)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(148, 163, 184, 0.05)',
                    },
                  }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {!notification.read && (
                        <IconButton
                          edge="end"
                          onClick={() => handleMarkAsRead(notification.id)}
                          size="small"
                          sx={{ color: 'text.secondary' }}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        edge="end"
                        onClick={() => handleDelete(notification.id)}
                        size="small"
                        sx={{ color: 'text.secondary' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemIcon>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: `${notificationColors[notification.type]}15`,
                        color: notificationColors[notification.type],
                      }}
                    >
                      {notificationIcons[notification.type]}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {notification.title}
                        </Typography>
                        {!notification.read && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: '#0f766e',
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {notification.message}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          {notification.project && (
                            <Chip
                              label={notification.project}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                backgroundColor: 'rgba(148, 163, 184, 0.1)',
                              }}
                            />
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {formatTimestamp(notification.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
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
