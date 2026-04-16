import React from 'react';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { getSecondaryMobileNav, MOBILE_ACTION_ITEMS } from './mobileNavConfig';

function MobileMoreSheet({
  open,
  onClose,
  onNavigate,
  onLogout,
  currentPage,
  isPersonalWorkspace,
  canViewClients,
  canViewTeam,
  canViewApprovals,
  canViewAdmin,
  canViewSupport,
  currentWorkspace,
}) {
  const items = getSecondaryMobileNav({
    isPersonalWorkspace,
    canViewClients,
    canViewTeam,
    canViewApprovals,
    canViewAdmin,
    canViewSupport,
  });

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          pb: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          maxHeight: '80vh',
          bgcolor: '#f8fbfd',
        },
      }}
    >
      <Box sx={{ px: 2.25, pt: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 42,
            height: 5,
            borderRadius: 999,
            bgcolor: alpha('#0f172a', 0.18),
            mx: 'auto',
            mb: 1.5,
          }}
        />

        <Stack spacing={0.35} sx={{ mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            More
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentWorkspace?.name || 'Workspace'} shortcuts and settings
          </Typography>
        </Stack>

        <List sx={{ py: 0 }}>
          {items.map((item) => (
            <ListItemButton
              key={item.id}
              selected={currentPage === item.id}
              onClick={() => {
                onClose();
                onNavigate(item.id);
              }}
              sx={{
                borderRadius: 3,
                py: 1.3,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: alpha('#0f766e', 0.08),
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: currentPage === item.id ? '#0f766e' : '#475569' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: 700,
                }}
              />
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ my: 1.25 }} />

        <List sx={{ py: 0 }}>
          {MOBILE_ACTION_ITEMS.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => {
                onClose();
                if (item.id === 'logout') onLogout();
              }}
              sx={{ borderRadius: 3, py: 1.3 }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: '#b91c1c' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: 700, color: '#b91c1c' }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default MobileMoreSheet;
