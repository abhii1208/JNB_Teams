import React, { useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { PAGE_TITLES } from './mobileNavConfig';

const MOBILE_TOPBAR_HEIGHT = 72;

function MobileTopBar({
  currentPage,
  currentWorkspace,
  workspaces,
  onWorkspaceChange,
  unreadNotificationCount = 0,
  onNotificationsClick,
  user,
}) {
  const [workspaceAnchorEl, setWorkspaceAnchorEl] = useState(null);

  const title = PAGE_TITLES[currentPage] || 'Workspace';
  const subtitle = useMemo(() => {
    if (!currentWorkspace?.name) return 'Choose a workspace';
    return currentWorkspace.name;
  }, [currentWorkspace?.name]);

  const initials = useMemo(() => {
    const first = user?.first_name?.[0] || user?.firstName?.[0] || 'U';
    const last = user?.last_name?.[0] || user?.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  }, [user]);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        height: `calc(${MOBILE_TOPBAR_HEIGHT}px + var(--safe-area-top, 0px))`,
        pt: 'var(--safe-area-top, 0px)',
        bgcolor: alpha('#f8fbfd', 0.92),
        backdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${alpha('#0f172a', 0.08)}`,
        color: '#0f172a',
      }}
    >
      <Toolbar sx={{ minHeight: MOBILE_TOPBAR_HEIGHT, px: 2, gap: 1.25 }}>
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: '#0f766e',
            fontWeight: 800,
            boxShadow: `0 10px 24px ${alpha('#0f172a', 0.12)}`,
          }}
        >
          {initials}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            {title}
          </Typography>
          <Chip
            onClick={(event) => setWorkspaceAnchorEl(event.currentTarget)}
            label={subtitle}
            deleteIcon={<KeyboardArrowDownRoundedIcon />}
            onDelete={(event) => setWorkspaceAnchorEl(event.currentTarget)}
            sx={{
              mt: 0.45,
              maxWidth: '100%',
              height: 26,
              fontWeight: 700,
              bgcolor: alpha('#0f766e', 0.08),
              color: '#0f766e',
              '& .MuiChip-label': {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }}
          />
        </Box>

        <IconButton
          onClick={onNotificationsClick}
          sx={{
            width: 42,
            height: 42,
            borderRadius: 3,
            bgcolor: '#fff',
            border: `1px solid ${alpha('#0f172a', 0.08)}`,
            boxShadow: `0 10px 24px ${alpha('#0f172a', 0.06)}`,
          }}
        >
          <Badge color="error" badgeContent={unreadNotificationCount} max={99}>
            <NotificationsRoundedIcon />
          </Badge>
        </IconButton>
      </Toolbar>

      <Menu
        anchorEl={workspaceAnchorEl}
        open={Boolean(workspaceAnchorEl)}
        onClose={() => setWorkspaceAnchorEl(null)}
        PaperProps={{
          sx: {
            mt: 1,
            borderRadius: 3,
            minWidth: 220,
            boxShadow: `0 18px 48px ${alpha('#0f172a', 0.16)}`,
          },
        }}
      >
        {workspaces.map((workspace) => (
          <MenuItem
            key={workspace.id}
            selected={Number(workspace.id) === Number(currentWorkspace?.id)}
            onClick={() => {
              setWorkspaceAnchorEl(null);
              onWorkspaceChange(workspace);
            }}
          >
            <Stack spacing={0.2}>
              <Typography sx={{ fontWeight: 700 }}>{workspace.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {workspace.role || 'Member'}
              </Typography>
            </Stack>
          </MenuItem>
        ))}
      </Menu>
    </AppBar>
  );
}

export { MOBILE_TOPBAR_HEIGHT };
export default MobileTopBar;
