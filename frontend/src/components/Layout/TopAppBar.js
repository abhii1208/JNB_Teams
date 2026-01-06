import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Breadcrumbs,
  Link,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { getNotificationCount, createWorkspace } from '../../apiClient';

function TopAppBar({ user, currentWorkspace, workspaces = [], onWorkspaceChange, onLogout, currentPage, selectedProject, onNavigate }) {
  const [profileAnchorEl, setProfileAnchorEl] = useState(null);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState(null);
  const [activityAnchorEl, setActivityAnchorEl] = useState(null);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch notification count
  useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const response = await getNotificationCount();
        setNotificationCount(response.data.count);
      } catch (error) {
        console.error('Failed to fetch notification count:', error);
      }
    };
    
    fetchNotificationCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleProfileClick = (event) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setProfileAnchorEl(null);
  };

  const handleNotificationsClick = (event) => {
    setNotificationsAnchorEl(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchorEl(null);
  };

  const handleWorkspaceSelect = (workspace) => {
    onWorkspaceChange(workspace);
    handleProfileClose();
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    try {
      const response = await createWorkspace(newWorkspaceName);
      onWorkspaceChange(response.data);
      setCreateWorkspaceOpen(false);
      setNewWorkspaceName('');
      handleProfileClose();
    } catch (error) {
      console.error('Failed to create workspace:', error);
      alert('Failed to create workspace. Please try again.');
    }
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: '#fff',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: 64, px: 3 }}>
          {/* Left: Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.5px',
              }}
            >
              JNB Teams
            </Typography>
            <Chip
              label="Beta"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: 'rgba(15, 118, 110, 0.1)',
                color: '#0f766e',
              }}
            />
          </Box>

          {/* Right: Workspace + Activity + Notifications + Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Workspace Name */}
            <Chip
              icon={<WorkspacesIcon sx={{ fontSize: '1rem' }} />}
              label={currentWorkspace?.name || 'Workspace'}
              sx={{
                mr: 1,
                height: 32,
                fontWeight: 600,
                backgroundColor: 'rgba(15, 118, 110, 0.08)',
                color: '#0f766e',
                border: '1px solid rgba(15, 118, 110, 0.2)',
                '&:hover': {
                  backgroundColor: 'rgba(15, 118, 110, 0.12)',
                },
              }}
            />

            {/* Activity */}
            <IconButton
              onClick={() => onNavigate('activity')}
              sx={{
                color: 'text.secondary',
                '&:hover': { backgroundColor: 'rgba(148, 163, 184, 0.1)' },
              }}
            >
              <TimelineIcon />
            </IconButton>

            {/* Notifications */}
            <IconButton
              onClick={() => onNavigate('notifications')}
              sx={{
                color: 'text.secondary',
                '&:hover': { backgroundColor: 'rgba(148, 163, 184, 0.1)' },
              }}
            >
              <Badge badgeContent={notificationCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            {/* Profile Icon */}
            <IconButton
              onClick={handleProfileClick}
              sx={{
                ml: 1,
                '&:hover': { backgroundColor: 'rgba(148, 163, 184, 0.1)' },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: '#0f766e',
                  width: 36,
                  height: 36,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                {user?.avatar || user?.first_name?.charAt(0) || user?.firstName?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Profile & Workspace Menu */}
      <Menu
        anchorEl={profileAnchorEl}
        open={Boolean(profileAnchorEl)}
        onClose={handleProfileClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 320,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.15)',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info */}
        <Box sx={{ px: 2, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Avatar
              sx={{
                bgcolor: '#0f766e',
                width: 48,
                height: 48,
                fontWeight: 600,
              }}
            >
              {user?.first_name?.[0] || user?.firstName?.[0] || 'U'}{user?.last_name?.[0] || user?.lastName?.[0] || ''}
            </Avatar>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'User')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Workspace Selection */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              WORKSPACES
            </Typography>
            {(user?.license_type === 'licensed_user' || user?.license_type === 'licensed_admin') && (
              <IconButton
                size="small"
                onClick={() => setCreateWorkspaceOpen(true)}
                sx={{
                  width: 24,
                  height: 24,
                  color: '#0f766e',
                  '&:hover': { backgroundColor: 'rgba(15, 118, 110, 0.1)' },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          <List disablePadding>
            {workspaces.map((workspace) => (
              <ListItemButton
                key={workspace.id}
                onClick={() => handleWorkspaceSelect(workspace)}
                selected={currentWorkspace?.id === workspace.id}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(15, 118, 110, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(15, 118, 110, 0.15)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1,
                      backgroundColor: `${workspace.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <WorkspacesIcon sx={{ fontSize: 16, color: workspace.color }} />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={workspace.name}
                  secondary={workspace.role}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: currentWorkspace?.id === workspace.id ? 600 : 400,
                  }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
                {currentWorkspace?.id === workspace.id && (
                  <CheckIcon sx={{ fontSize: 18, color: '#0f766e' }} />
                )}
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Divider />

        {/* Menu Options */}
        <MenuItem onClick={onLogout} sx={{ py: 1.5, color: 'error.main' }}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Log out</ListItemText>
        </MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationsAnchorEl}
        open={Boolean(notificationsAnchorEl)}
        onClose={handleNotificationsClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 360,
            maxWidth: 400,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.15)',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Notifications
          </Typography>
        </Box>
        <List sx={{ py: 0, maxHeight: 400, overflow: 'auto' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <ListItem
              key={i}
              sx={{
                py: 1.5,
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                '&:hover': { backgroundColor: 'rgba(148, 163, 184, 0.05)' },
              }}
            >
              <ListItemText
                primary={`Task "${i === 1 ? 'Database optimization' : 'API integration'}" needs approval`}
                secondary="2 hours ago"
                primaryTypographyProps={{ fontSize: '0.875rem' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </ListItem>
          ))}
        </List>
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(148, 163, 184, 0.2)', textAlign: 'center' }}>
          <Button size="small" sx={{ textTransform: 'none', fontSize: '0.875rem' }}>
            View all notifications
          </Button>
        </Box>
      </Menu>

      {/* Activity Menu */}
      <Menu
        anchorEl={activityAnchorEl}
        open={Boolean(activityAnchorEl)}
        onClose={() => setActivityAnchorEl(null)}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 500,
            maxWidth: 600,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.15)',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Activity Log
          </Typography>
          
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label="All" size="small" sx={{ bgcolor: '#0f766e', color: '#fff' }} />
            <Chip label="Projects" size="small" variant="outlined" />
            <Chip label="Tasks" size="small" variant="outlined" />
            <Chip label="Members" size="small" variant="outlined" />
            <Chip label="Today" size="small" variant="outlined" />
            <Chip label="This Week" size="small" variant="outlined" />
          </Box>
        </Box>

        <List sx={{ maxHeight: 400, overflow: 'auto', py: 0 }}>
          {/* Sample Activities */}
          {[
            { type: 'task', user: 'Sarah Miller', action: 'completed', item: 'Database optimization', time: '5 mins ago', project: 'Website Redesign' },
            { type: 'task', user: 'John Doe', action: 'created', item: 'API integration testing', time: '15 mins ago', project: 'Website Redesign' },
            { type: 'member', user: 'Alex Kim', action: 'joined', item: 'Marketing project', time: '1 hour ago', project: 'Marketing' },
            { type: 'task', user: 'Patricia Lee', action: 'requested closure for', item: 'Setup CI/CD pipeline', time: '2 hours ago', project: 'Website Redesign' },
            { type: 'project', user: 'Mike Roberts', action: 'updated settings for', item: 'Product Design', time: '3 hours ago', project: 'Product Design' },
          ].map((activity, i) => (
            <ListItem
              key={i}
              sx={{
                py: 1.5,
                px: 2,
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                '&:hover': { backgroundColor: 'rgba(148, 163, 184, 0.05)' },
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, width: '100%' }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: '#0f766e' }}>
                  {activity.user.split(' ').map(n => n[0]).join('')}
                </Avatar>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  <strong>{activity.user}</strong> {activity.action} <strong>{activity.item}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {activity.time}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, ml: 4 }}>
                <Chip
                  label={activity.project}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    backgroundColor: 'rgba(15, 118, 110, 0.1)',
                    color: '#0f766e',
                  }}
                />
                <Chip
                  label={activity.type}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    color: '#7c3aed',
                  }}
                />
              </Box>
            </ListItem>
          ))}
        </List>
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(148, 163, 184, 0.2)', textAlign: 'center' }}>
          <Button size="small" sx={{ textTransform: 'none', fontSize: '0.875rem' }}>
            View full activity log
          </Button>
        </Box>
      </Menu>

      {/* Create Workspace Dialog */}
      <Dialog
        open={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Workspace Name"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="e.g., Marketing Team"
            sx={{ mt: 2 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            A workspace is a shared environment for your team to collaborate on projects.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setCreateWorkspaceOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateWorkspace}
            disabled={!newWorkspaceName.trim()}
            sx={{ textTransform: 'none', px: 3 }}
          >
            Create Workspace
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default TopAppBar;
