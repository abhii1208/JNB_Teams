/**
 * NotificationToast Component
 * Shows a toast/snackbar for new notifications that auto-dismisses
 */
import React from 'react';
import { Snackbar, Alert, Box, Typography, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseIcon from '@mui/icons-material/Close';
import TaskIcon from '@mui/icons-material/Assignment';
import CommentIcon from '@mui/icons-material/Comment';
import ChatIcon from '@mui/icons-material/Chat';
import SettingsIcon from '@mui/icons-material/Settings';
import ApprovalIcon from '@mui/icons-material/ThumbUpAlt';
import BusinessIcon from '@mui/icons-material/Business';
import NotificationsIcon from '@mui/icons-material/Notifications';

const notificationIcons = {
  task_created: <TaskIcon fontSize="small" />,
  task_assigned: <TaskIcon fontSize="small" />,
  task_collaborator_added: <TaskIcon fontSize="small" />,
  task_unassigned: <TaskIcon fontSize="small" />,
  task_due_changed: <TaskIcon fontSize="small" />,
  task_mentioned: <CommentIcon fontSize="small" />,
  task_attachment: <TaskIcon fontSize="small" />,
  task_comment: <CommentIcon fontSize="small" />,
  task_completed: <TaskIcon fontSize="small" />,
  task_status_changed: <TaskIcon fontSize="small" />,
  chat_message: <ChatIcon fontSize="small" />,
  chat_group_message: <ChatIcon fontSize="small" />,
  chat_mentioned: <ChatIcon fontSize="small" />,
  project_settings: <SettingsIcon fontSize="small" />,
  approval_requested: <ApprovalIcon fontSize="small" />,
  approval_approved: <ApprovalIcon fontSize="small" />,
  approval_rejected: <ApprovalIcon fontSize="small" />,
  client_added: <BusinessIcon fontSize="small" />,
  client_changed: <BusinessIcon fontSize="small" />,
  Task: <TaskIcon fontSize="small" />,
  Approval: <ApprovalIcon fontSize="small" />,
  Project: <SettingsIcon fontSize="small" />,
  Chat: <ChatIcon fontSize="small" />,
};

const getIcon = (type) => notificationIcons[type] || <NotificationsIcon fontSize="small" />;

const getSeverity = (type) => {
  if (!type) return 'info';
  const t = type.toLowerCase();
  if (t.includes('approved') || t.includes('completed') || t.includes('assigned') || t.includes('created')) return 'success';
  if (t.includes('rejected') || t.includes('unassigned')) return 'error';
  if (t.includes('due') || t.includes('deadline')) return 'warning';
  return 'info';
};

function NotificationToast({ notification, onClose, onClick, autoHideDuration = 4000 }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  if (!notification) return null;

  const handleClick = () => {
    if (onClick) {
      onClick(notification);
    }
    onClose();
  };

  return (
    <Snackbar
      open={!!notification}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: isMobile ? 'bottom' : 'top', horizontal: isMobile ? 'center' : 'right' }}
      sx={{ mt: isMobile ? 0 : 8, mb: isMobile ? 12 : 0 }}
    >
      <Alert
        severity={getSeverity(notification.type)}
        icon={getIcon(notification.type)}
        action={
          <IconButton size="small" color="inherit" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        sx={{
          width: '100%',
          maxWidth: 400,
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.95,
          },
        }}
        onClick={handleClick}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {notification.title}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.8rem' }}>
            {notification.message?.length > 80 
              ? notification.message.substring(0, 80) + '...' 
              : notification.message}
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );
}

export default NotificationToast;
