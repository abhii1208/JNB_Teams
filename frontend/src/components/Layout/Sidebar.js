import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

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
import HandymanIcon from '@mui/icons-material/Handyman';
import InsightsIcon from '@mui/icons-material/Insights';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import ChatIcon from '@mui/icons-material/Chat';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';

import { getApprovalCount, getChatUnreadCount, patchUserAppPreferences } from '../../apiClient';

/**
 * Sidebar variants:
 *  - "fixed": always expanded
 *  - "collapsible": user toggles collapsed/expanded (toggle handle ALWAYS visible)
 *  - "expandable": expands on hover; can be pinned to stay expanded
 */
const APPBAR_HEIGHT = 64;
const EXPANDED_WIDTH = 232; // compact expanded
const COLLAPSED_WIDTH = 72; // compact collapsed

const ACTIVE_ACCENT = '#22d3ee'; // selected indicator color (cyan)

function Sidebar({
  currentPage,
  onNavigate,
  onLogout,
  user,
  workspace,

  // optional props
  sidebarVariant = 'collapsible', // "fixed" | "collapsible" | "expandable"
  defaultCollapsed = false,
  mobileOpen = false,
  onMobileClose,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [pendingCount, setPendingCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // collapse/expand behavior
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(sidebarVariant !== 'expandable'); // expandable: default unpinned

  const isPersonalWorkspace =
    Boolean(workspace?.is_personal) ||
    (workspace?.name === 'Personal' && Number(workspace?.created_by) === Number(user?.id));

  const canViewTeam = !isPersonalWorkspace && (workspace?.role === 'Owner' || workspace?.role === 'Admin');
  const canViewClients = !isPersonalWorkspace;
  const canViewApprovals = !isPersonalWorkspace;
  const canViewAdmin = !isPersonalWorkspace && (workspace?.role === 'Owner' || workspace?.role === 'Admin');
  const canViewChat = !isPersonalWorkspace;

  useEffect(() => {
    if (sidebarVariant !== 'collapsible') return;
    if (typeof user?.app_sidebar_collapsed === 'boolean') {
      setCollapsed(user.app_sidebar_collapsed);
    }
  }, [sidebarVariant, user?.app_sidebar_collapsed]);

  useEffect(() => {
    if (sidebarVariant !== 'collapsible') return;
    if (!user?.id) return;
    if (Boolean(user?.app_sidebar_collapsed) === collapsed) return;

    const timeoutId = window.setTimeout(() => {
      patchUserAppPreferences({ app_sidebar_collapsed: collapsed }).catch((error) => {
        console.error('Failed to persist sidebar state:', error);
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [collapsed, sidebarVariant, user?.app_sidebar_collapsed, user?.id]);

  const isCollapsed = useMemo(() => {
    if (sidebarVariant === 'fixed') return false;
    if (sidebarVariant === 'collapsible') return collapsed;
    // expandable
    return pinned ? false : !hovered;
  }, [sidebarVariant, collapsed, pinned, hovered]);

  const drawerWidth = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const effectiveDrawerWidth = isMobile ? 'min(78vw, 280px)' : drawerWidth;

  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : 'User';

  const initials = (user?.first_name?.[0] || user?.firstName?.[0] || 'U').toUpperCase();
  const displayRole = user?.license_type || user?.role || workspace?.role || 'Member';
  const displayWorkspace = workspace?.name || (isPersonalWorkspace ? 'Personal' : 'Workspace');

  // Keep SAME teal gradient base, just add subtle premium overlays (doesn't "change" the feel)
  const drawerBackground = `
    radial-gradient(900px 520px at -10% 0%, ${alpha('#34d399', 0.18)} 0%, transparent 62%),
    radial-gradient(820px 520px at 115% 12%, ${alpha('#22d3ee', 0.16)} 0%, transparent 58%),
    linear-gradient(180deg, #0f766e 0%, #115e59 100%)
  `;

  // Approvals count
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!workspace?.id || !canViewApprovals) return;
      try {
        const response = await getApprovalCount(workspace.id);
        setPendingCount(Number(response?.data?.count || 0));
      } catch (error) {
        console.error('Failed to fetch approval count:', error);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [workspace?.id, canViewApprovals]);

  // Chat unread count
  useEffect(() => {
    const fetchChatUnread = async () => {
      if (!workspace?.id || !canViewChat) return;
      try {
        const response = await getChatUnreadCount(workspace.id);
        setChatUnreadCount(Number(response?.data?.unread_count || 0));
      } catch {
        console.debug('Chat unread count not available');
      }
    };

    fetchChatUnread();
    const interval = setInterval(fetchChatUnread, 15000);
    return () => clearInterval(interval);
  }, [workspace?.id, canViewChat]);

  const menuItems = useMemo(() => {
    return [
      { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, bg: '#E0F2FE', fg: '#0369A1' },
      { id: 'projects', label: 'Projects', icon: <FolderIcon />, bg: '#EDE9FE', fg: '#6D28D9' },
      ...(canViewClients
        ? [{ id: 'clients', label: 'Clients', icon: <BusinessIcon />, bg: '#DCFCE7', fg: '#15803D' }]
        : []),
      ...(!isPersonalWorkspace
        ? [{ id: 'services', label: 'Services', icon: <HandymanIcon />, bg: '#EDE9FE', fg: '#6d28d9' }]
        : []),
      ...(!isPersonalWorkspace
        ? [{ id: 'operations', label: 'Operations', icon: <InsightsIcon />, bg: '#DBEAFE', fg: '#1d4ed8' }]
        : []),
      ...(!isPersonalWorkspace
        ? [{ id: 'support', label: 'Support', icon: <SupportAgentIcon />, bg: '#FCE7F3', fg: '#be185d' }]
        : []),
      { id: 'tasks', label: 'Tasks', icon: <AssignmentIcon />, bg: '#FEF3C7', fg: '#B45309' },
      { id: 'recurring', label: 'Recurring', icon: <RepeatIcon />, bg: '#E0E7FF', fg: '#4338CA' },
      ...(!isPersonalWorkspace
        ? [{ id: 'checklist', label: 'Checklist', icon: <PlaylistAddCheckIcon />, bg: '#CCFBF1', fg: '#0F766E' }]
        : []),
      ...(canViewChat
        ? [{ id: 'chat', label: 'Chat', icon: <ChatIcon />, bg: '#FFE4E6', fg: '#BE123C', badge: chatUnreadCount }]
        : []),
      ...(canViewTeam ? [{ id: 'team', label: 'Team', icon: <GroupIcon />, bg: '#CFFAFE', fg: '#0E7490' }] : []),
      ...(canViewApprovals
        ? [
            {
              id: 'approvals',
              label: 'Approvals',
              icon: <CheckCircleIcon />,
              bg: '#FEE2E2',
              fg: '#B91C1C',
              badge: pendingCount,
            },
          ]
        : []),
      ...(canViewAdmin
        ? [{ id: 'admin', label: 'Admin', icon: <AdminPanelSettingsIcon />, bg: '#F3E8FF', fg: '#7E22CE' }]
        : []),
    ];
  }, [
    canViewClients,
    canViewChat,
    canViewTeam,
    canViewApprovals,
    canViewAdmin,
    isPersonalWorkspace,
    chatUnreadCount,
    pendingCount,
  ]);

  // ALWAYS-visible handle (fixes: collapse -> can't expand)
  const SideHandle = () => {
    if (sidebarVariant === 'fixed') return null;

    const isCollapsible = sidebarVariant === 'collapsible';
    const isExpandable = sidebarVariant === 'expandable';

    const icon =
      isExpandable ? (pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />) : isCollapsed ? (
        <ChevronRightIcon fontSize="small" />
      ) : (
        <ChevronLeftIcon fontSize="small" />
      );

    const tooltip =
      isExpandable ? (pinned ? 'Unpin (auto-collapse)' : 'Pin (stay open)') : isCollapsed ? 'Expand' : 'Collapse';

    const onClick = () => {
      if (isExpandable) setPinned((v) => !v);
      if (isCollapsible) setCollapsed((v) => !v);
    };

    return (
      <Tooltip title={tooltip} placement="right" arrow disableInteractive>
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: -14, // sits outside the drawer, always clickable
            zIndex: 10,
          }}
        >
          <IconButton
            onClick={onClick}
            size="small"
            sx={{
              width: 30,
              height: 30,
              borderRadius: 2,
              color: '#0b1220',
              backgroundColor: alpha('#FFFFFF', 0.95),
              border: `1px solid ${alpha('#0b1220', 0.12)}`,
              boxShadow: `0 10px 24px ${alpha('#000', 0.30)}`,
              '&:hover': {
                backgroundColor: '#FFFFFF',
                transform: 'translateX(0px) scale(1.02)',
              },
              transition: 'transform 140ms ease',
            }}
          >
            {icon}
          </IconButton>
        </Box>
      </Tooltip>
    );
  };

  const WorkspaceMiniTag = () => {
    // compact indicator (P/T) – shown only when expanded (collapsed uses overlay on avatar)
    if (isCollapsed) return null;
    const text = isPersonalWorkspace ? 'P' : 'T';
    const full = isPersonalWorkspace ? 'Personal' : 'Team';
    return (
      <Tooltip title={full} placement="right" arrow disableInteractive>
        <Box
          sx={{
            ml: 'auto',
            px: 0.7,
            py: 0.28,
            borderRadius: 999,
            fontSize: '0.68rem',
            fontWeight: 900,
            lineHeight: 1,
            color: isPersonalWorkspace ? '#FDE68A' : '#A7F3D0',
            backgroundColor: isPersonalWorkspace ? alpha('#F59E0B', 0.18) : alpha('#10B981', 0.16),
            border: `1px solid ${
              isPersonalWorkspace ? alpha('#F59E0B', 0.22) : alpha('#10B981', 0.20)
            }`,
          }}
        >
          {text}
        </Box>
      </Tooltip>
    );
  };

  const renderMenuItem = (item) => {
    const selected = currentPage === item.id;
    const badgeValue = Number(item.badge || 0);
    const showBadge = badgeValue > 0;

    const iconTile = (
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          background: `linear-gradient(135deg, ${alpha(item.bg, 0.98)} 0%, ${alpha(item.bg, 0.72)} 100%)`,
          border: selected ? `1px solid ${alpha(ACTIVE_ACCENT, 0.65)}` : `1px solid ${alpha('#0b1220', 0.08)}`,
          boxShadow: selected
            ? `0 12px 24px ${alpha('#000', 0.22)}, 0 0 0 3px ${alpha(ACTIVE_ACCENT, 0.14)}`
            : `0 10px 18px ${alpha('#000', 0.12)}`,
          transition: 'all 140ms ease',
          flex: '0 0 auto',
        }}
      >
        {showBadge ? (
          <Badge
            badgeContent={badgeValue}
            color="error"
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.66rem',
                height: 16,
                minWidth: 16,
                borderRadius: 999,
                boxShadow: `0 10px 18px ${alpha('#000', 0.22)}`,
              },
            }}
          >
            <Box sx={{ color: item.fg, display: 'grid', placeItems: 'center', '& svg': { fontSize: 18 } }}>
              {item.icon}
            </Box>
          </Badge>
        ) : (
          <Box sx={{ color: item.fg, display: 'grid', placeItems: 'center', '& svg': { fontSize: 18 } }}>
            {item.icon}
          </Box>
        )}
      </Box>
    );

    return (
      <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
        <Tooltip title={isCollapsed ? item.label : ''} placement="right" arrow disableInteractive>
          <ListItemButton
            selected={selected}
            onClick={() => onNavigate(item.id)}
            sx={{
              borderRadius: 2,
              px: isCollapsed ? 0.9 : (isMobile ? 0.95 : 1.1),
              py: isMobile ? 0.68 : 0.78,
              gap: isMobile ? 0.85 : 1,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 140ms ease',
              // Selected indicator (different color)
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: 8,
                bottom: 8,
                width: 4,
                borderRadius: 999,
                backgroundColor: selected ? ACTIVE_ACCENT : 'transparent',
                boxShadow: selected ? `0 0 0 3px ${alpha(ACTIVE_ACCENT, 0.16)}` : 'none',
                opacity: selected ? 1 : 0,
                transition: 'opacity 140ms ease',
              },
              '&.Mui-selected': {
                backgroundColor: alpha('#FFFFFF', 0.18),
                '&:hover': { backgroundColor: alpha('#FFFFFF', 0.22) },
              },
              '&:hover': {
                backgroundColor: alpha('#FFFFFF', 0.10),
                '& .tf-iconTile': { transform: 'scale(1.03)' },
              },
            }}
          >
            <Box className="tf-iconTile" sx={{ display: 'flex', alignItems: 'center' }}>
              {iconTile}
            </Box>

            {!isCollapsed && (
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  noWrap: true,
                  fontSize: '0.85rem',
                  fontWeight: selected ? 600 : 400, // like your original
                }}    
                sx={{ my: 0 }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    );
  };

  const drawerPaperSx = {
    width: effectiveDrawerWidth,
    boxSizing: 'border-box',
    border: 'none',
    mt: `calc(${APPBAR_HEIGHT}px + var(--safe-area-top, 0px))`,
    height: `calc(100vh - ${APPBAR_HEIGHT}px - var(--safe-area-top, 0px))`,
    background: drawerBackground,
    color: '#fff',
    transition: 'width 180ms ease',
    overflow: 'visible',
    position: 'fixed',
    borderTopRightRadius: isMobile ? 24 : 0,
    borderBottomRightRadius: isMobile ? 24 : 0,
    boxShadow: isMobile ? `0 24px 60px ${alpha('#000', 0.28)}` : 'none',
  };

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? mobileOpen : true}
      onClose={isMobile ? onMobileClose : undefined}
      ModalProps={isMobile ? { keepMounted: true } : undefined}
      onMouseEnter={sidebarVariant === 'expandable' ? () => setHovered(true) : undefined}
      onMouseLeave={sidebarVariant === 'expandable' ? () => setHovered(false) : undefined}
      sx={{
        width: effectiveDrawerWidth,
        flexShrink: 0,
        '& .MuiBackdrop-root': {
          backdropFilter: isMobile ? 'blur(2px)' : undefined,
          backgroundColor: isMobile ? alpha('#0b1220', 0.24) : undefined,
        },
        '& .MuiDrawer-paper': {
          ...drawerPaperSx,
        },
      }}
    >
      {/* Always-visible expand/collapse/pin handle */}
      {!isMobile && <SideHandle />}

      {/* Top user area (compact) */}
      <Box sx={{ px: isMobile ? 1.05 : 1.4, pt: isMobile ? 0.95 : 1.2, pb: isMobile ? 0.8 : 1.0 }}>
        <Box
          sx={{
            p: isMobile ? 0.9 : 1.05,
            borderRadius: 2,
            backgroundColor: alpha('#FFFFFF', 0.10),
            border: `1px solid ${alpha('#FFFFFF', 0.12)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Tooltip title={isCollapsed ? `${displayName} • ${displayRole}` : ''} placement="right" arrow disableInteractive>
            <Box sx={{ position: 'relative', flex: '0 0 auto' }}>
              <Avatar
                sx={{
                  width: isMobile ? 32 : 34,
                  height: isMobile ? 32 : 34,
                  fontWeight: 900,
                  fontSize: '0.88rem',
                  bgcolor: '#f59e0b',
                  boxShadow: `0 12px 24px ${alpha('#000', 0.20)}`,
                }}
              >
                {initials}
              </Avatar>

              {/* When collapsed, show P/T overlay on avatar instead of a separate badge */}
              {isCollapsed && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    color: isPersonalWorkspace ? '#FDE68A' : '#A7F3D0',
                    backgroundColor: isPersonalWorkspace ? alpha('#92400e', 0.95) : alpha('#064e3b', 0.92),
                    border: `2px solid ${alpha('#115e59', 0.95)}`,
                    boxShadow: `0 10px 18px ${alpha('#000', 0.25)}`,
                  }}
                >
                  {isPersonalWorkspace ? 'P' : 'T'}
                </Box>
              )}
            </Box>
          </Tooltip>

          {!isCollapsed && (
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: '0.90rem',
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </Typography>
              <Typography
                sx={{
                  mt: 0.15,
                  fontSize: '0.72rem',
                  color: alpha('#FFFFFF', 0.75),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayRole}
              </Typography>
            </Box>
          )}

          <WorkspaceMiniTag />
        </Box>

        {!isCollapsed && (
          <Typography
            sx={{
              mt: 0.75,
              px: 0.6,
              fontSize: '0.72rem',
              color: alpha('#FFFFFF', 0.65),
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={displayWorkspace}
          >
            {displayWorkspace}
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: alpha('#FFFFFF', 0.10), mx: 1.4 }} />

      {/* Menu scroll area */}
      <Box
        sx={{
          px: isMobile ? 0.95 : 1.2,
          pt: isMobile ? 0.85 : 1.05,
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha('#FFFFFF', 0.14),
            borderRadius: 999,
            border: `2px solid transparent`,
            backgroundClip: 'content-box',
          },
          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: alpha('#FFFFFF', 0.22) },
        }}
      >
        <List disablePadding>{menuItems.map(renderMenuItem)}</List>
      </Box>

      {/* Bottom actions */}
      <Box sx={{ px: isMobile ? 0.95 : 1.2, pb: isMobile ? 1.0 : 1.2 }}>
        <Divider sx={{ borderColor: alpha('#FFFFFF', 0.10), mx: 0.2, mb: 1.0 }} />

        <List disablePadding>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={isCollapsed ? 'Settings' : ''} placement="right" arrow disableInteractive>
              <ListItemButton
                onClick={() => onNavigate('settings')}
                sx={{
                  borderRadius: 2,
                  px: isCollapsed ? 0.95 : 1.1,
                  py: 0.78,
                  gap: 1,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  backgroundColor: alpha('#FFFFFF', 0.06),
                  border: `1px solid ${alpha('#FFFFFF', 0.10)}`,
                  '&:hover': { backgroundColor: alpha('#FFFFFF', 0.10) },
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    background: `linear-gradient(135deg, ${alpha('#E5E7EB', 0.98)} 0%, ${alpha('#CBD5E1', 0.85)} 100%)`,
                    boxShadow: `0 10px 18px ${alpha('#000', 0.12)}`,
                  }}
                >
                  <Box sx={{ color: '#0f172a', '& svg': { fontSize: 18 } }}>
                    <SettingsIcon />
                  </Box>
                </Box>
                {!isCollapsed && (
                  <ListItemText
                    primary="Settings"
                    primaryTypographyProps={{
                      noWrap: true,
                      fontSize: '0.89rem',
                      fontWeight: 900,
                      color: '#FFFFFF',
                    }}
                    sx={{ my: 0 }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>

          <ListItem disablePadding>
            <Tooltip title={isCollapsed ? 'Log out' : ''} placement="right" arrow disableInteractive>
              <ListItemButton
                onClick={onLogout}
                sx={{
                  borderRadius: 2,
                  px: isCollapsed ? 0.95 : 1.1,
                  py: 0.78,
                  gap: 1,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  backgroundColor: alpha('#EF4444', 0.10),
                  border: `1px solid ${alpha('#EF4444', 0.18)}`,
                  '&:hover': { backgroundColor: alpha('#EF4444', 0.16) },
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    background: `linear-gradient(135deg, ${alpha('#FEE2E2', 0.98)} 0%, ${alpha('#FCA5A5', 0.80)} 100%)`,
                    boxShadow: `0 10px 18px ${alpha('#000', 0.12)}`,
                  }}
                >
                  <Box sx={{ color: '#B91C1C', '& svg': { fontSize: 18 } }}>
                    <LogoutIcon />
                  </Box>
                </Box>
                {!isCollapsed && (
                  <ListItemText
                    primary="Log out"
                    primaryTypographyProps={{
                      noWrap: true,
                      fontSize: '0.89rem',
                      fontWeight: 950,
                      color: '#FFFFFF',
                    }}
                    sx={{ my: 0 }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
