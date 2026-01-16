import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Divider,
  Badge,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RepeatIcon from '@mui/icons-material/Repeat';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
import { getApprovalCount } from '../../apiClient';

const DRAWER_WIDTH = 260;

function Sidebar({ currentPage, onNavigate, onLogout, user, workspace }) {
  const [pendingCount, setPendingCount] = useState(0);
  const isPersonalWorkspace = Boolean(workspace?.is_personal)
    || (workspace?.name === 'Personal' && Number(workspace?.created_by) === Number(user?.id));
  const canViewTeam = !isPersonalWorkspace && (workspace?.role === 'Owner' || workspace?.role === 'Admin');
  const canViewClients = !isPersonalWorkspace && (workspace?.role === 'Owner' || workspace?.role === 'Admin');
  const canViewApprovals = !isPersonalWorkspace;
  const canViewAdmin = !isPersonalWorkspace && (workspace?.role === 'Owner' || workspace?.role === 'Admin');

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!workspace?.id || !canViewApprovals) return;
      try {
        const response = await getApprovalCount(workspace.id);
        setPendingCount(response.data.count);
      } catch (error) {
        console.error('Failed to fetch approval count:', error);
      }
    };
    
    fetchPendingCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [workspace, canViewApprovals]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'projects', label: 'Projects', icon: <FolderIcon /> },
    ...(canViewClients ? [{ id: 'clients', label: 'Clients', icon: <BusinessIcon /> }] : []),
    { id: 'tasks', label: 'Tasks', icon: <AssignmentIcon /> },
    { id: 'recurring', label: 'Recurring', icon: <RepeatIcon /> },
    ...(canViewTeam ? [{ id: 'team', label: 'Team', icon: <GroupIcon /> }] : []),
    ...(canViewApprovals ? [{ id: 'approvals', label: 'Approvals', icon: <CheckCircleIcon />, badge: pendingCount }] : []),
    ...(canViewAdmin ? [{ id: 'admin', label: 'Admin', icon: <AdminPanelSettingsIcon /> }] : []),
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #0f766e 0%, #115e59 100%)',
          color: '#fff',
          border: 'none',
          mt: '64px', // Account for AppBar height
          height: 'calc(100vh - 64px)',
        },
      }}
    >
      <Box sx={{ px: 2, mb: 2, mt: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Avatar
            sx={{
              bgcolor: '#f59e0b',
              width: 40,
              height: 40,
              fontWeight: 600,
            }}
          >
            {user?.first_name?.[0] || user?.firstName?.[0] || 'U'}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'User')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {user?.license_type || user?.role || 'Member'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 2 }} />

      <List sx={{ px: 2, mt: 2, flex: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.25)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.9)', minWidth: 40 }}>
                {item.badge ? (
                  <Badge badgeContent={item.badge} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  fontWeight: currentPage === item.id ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ p: 2 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2 }} />
        <List disablePadding>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => onNavigate('settings')}
              sx={{
                borderRadius: 2,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.9)', minWidth: 40 }}>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Settings" primaryTypographyProps={{ fontSize: '0.9rem' }} />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              onClick={onLogout}
              sx={{
                borderRadius: 2,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.9)', minWidth: 40 }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Log out" primaryTypographyProps={{ fontSize: '0.9rem' }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
