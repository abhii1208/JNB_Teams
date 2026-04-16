import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputBase,
  Slide,
  Grow,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import useScrollTrigger from '@mui/material/useScrollTrigger';

import NotificationsIcon from '@mui/icons-material/Notifications';
import TimelineIcon from '@mui/icons-material/Timeline';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import LogoutIcon from '@mui/icons-material/Logout';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskIcon from '@mui/icons-material/Assignment';
import FolderIcon from '@mui/icons-material/Folder';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import HistoryIcon from '@mui/icons-material/History';
import CommentIcon from '@mui/icons-material/Comment';
import ChatIcon from '@mui/icons-material/Chat';
import ApprovalIcon from '@mui/icons-material/ThumbUpAlt';
import WarningIcon from '@mui/icons-material/Warning';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import MenuIcon from '@mui/icons-material/Menu';

import {
  createWorkspace,
  globalSearch,
  getRecentItems,
  getNotifications,
  markAllNotificationsAsRead,
  getActivity,
  patchUserAppPreferences,
} from '../../apiClient';
import debounce from 'lodash/debounce';

const APPBAR_HEIGHT = 64;
const CSS_APPBAR_OFFSET_VAR = '--appbar-offset';

const ACTIVE_ACCENT = '#22d3ee';

function TopAppBar({
  user,
  currentWorkspace,
  workspaces = [],
  onWorkspaceChange,
  onLogout,
  currentPage,
  selectedProject,
  onNavigate,
  unreadNotificationCount = 0,
  onToggleSidebar,
  isMobileSidebarOpen = false,

  // Optional enhancements (safe defaults)
  hasNewNotifications = false, // show dot even if count is 0
  hideOnScroll = false, // auto-hide on scroll down
  onAppBarVisibilityChange, // (shown:boolean) => void
  onQuickCreate, // (type: 'task'|'project'|'client'|'workspace') => void
  searchItems = [], // optional search data
}) {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'));

  // hide-on-scroll trigger
  const scrollTrigger = useScrollTrigger({ disableHysteresis: true, threshold: 30 });

  const [profileAnchorEl, setProfileAnchorEl] = useState(null);
  const [activityAnchorEl, setActivityAnchorEl] = useState(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifTab, setNotifTab] = useState(0);
  const [notificationsList, setNotificationsList] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [activityList, setActivityList] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const [quickCreateAnchorEl, setQuickCreateAnchorEl] = useState(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ tasks: [], projects: [], clients: [], members: [] });
  const [recentItems, setRecentItems] = useState({ tasks: [], projects: [], clients: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef(null);

  // Notification icons mapping
  const notificationIcons = {
    task_created: <TaskIcon fontSize="small" />,
    task_assigned: <TaskIcon fontSize="small" />,
    task_collaborator_added: <PersonAddIcon fontSize="small" />,
    task_unassigned: <TaskIcon fontSize="small" />,
    task_mentioned: <CommentIcon fontSize="small" />,
    task_comment: <CommentIcon fontSize="small" />,
    task_completed: <TaskIcon fontSize="small" />,
    task_status_changed: <TaskIcon fontSize="small" />,
    chat_message: <ChatIcon fontSize="small" />,
    chat_mentioned: <ChatIcon fontSize="small" />,
    approval_requested: <ApprovalIcon fontSize="small" />,
    approval_approved: <ApprovalIcon fontSize="small" />,
    approval_rejected: <ApprovalIcon fontSize="small" />,
    deadline: <WarningIcon fontSize="small" />,
    project_member: <PersonAddIcon fontSize="small" />,
    Task: <TaskIcon fontSize="small" />,
    Approval: <ApprovalIcon fontSize="small" />,
    Project: <FolderIcon fontSize="small" />,
    Chat: <ChatIcon fontSize="small" />,
  };

  const getNotificationIcon = (type) => notificationIcons[type] || <NotificationsIcon fontSize="small" />;

  // Fetch notifications when drawer opens
  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const response = await getNotifications();
      setNotificationsList(response.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  // Fetch activity when menu opens
  const fetchActivity = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setActivityList([]);
      return;
    }
    setActivityLoading(true);
    try {
      const response = await getActivity({ 
        workspace_id: currentWorkspace.id,
        limit: 10 
      });
      // Handle API response format: { data: { activities: [...], pages: ... } }
      const activities = response?.data?.activities || response?.data || [];
      setActivityList(Array.isArray(activities) ? activities : []);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
      setActivityList([]);
    } finally {
      setActivityLoading(false);
    }
  }, [currentWorkspace]);

  // Fetch notifications when drawer opens
  useEffect(() => {
    if (notificationsOpen) {
      fetchNotifications();
    }
  }, [notificationsOpen, fetchNotifications]);

  // Fetch activity when menu opens
  useEffect(() => {
    if (activityAnchorEl) {
      fetchActivity();
    }
  }, [activityAnchorEl, fetchActivity]);

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotificationsList(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const canCreateWorkspace = user?.license_type === 'licensed_user' || user?.license_type === 'licensed_admin';

  // FINAL effective visibility (ONLY hideOnScroll now)
  const appBarShown = useMemo(() => {
    if (hideOnScroll && scrollTrigger) return false;
    return true;
  }, [hideOnScroll, scrollTrigger]);

  // ✅ This makes the whole page “move up” when appbar is hidden
  useEffect(() => {
    try {
      document.documentElement.style.setProperty(
        CSS_APPBAR_OFFSET_VAR,
        appBarShown ? `${APPBAR_HEIGHT}px` : '0px'
      );
    } catch {
      // ignore (non-browser env)
    }
    if (onAppBarVisibilityChange) onAppBarVisibilityChange(appBarShown);
  }, [appBarShown, onAppBarVisibilityChange]);

  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : 'User';

  const initials = useMemo(() => {
    const f = (user?.first_name?.[0] || user?.firstName?.[0] || 'U').toUpperCase();
    const l = (user?.last_name?.[0] || user?.lastName?.[0] || '').toUpperCase();
    return `${f}${l}`.trim() || 'U';
  }, [user]);

  // Presence/status chip
  const presenceOptions = useMemo(
    () => [
      { id: 'online', label: 'Online', dot: '#22c55e', bg: alpha('#22c55e', 0.10), fg: '#166534' },
      { id: 'busy', label: 'Busy', dot: '#ef4444', bg: alpha('#ef4444', 0.10), fg: '#991b1b' },
      { id: 'away', label: 'Away', dot: '#f59e0b', bg: alpha('#f59e0b', 0.12), fg: '#92400e' },
    ],
    []
  );

  const [presence, setPresence] = useState(user?.app_presence_status || 'online');
  const [presenceAnchorEl, setPresenceAnchorEl] = useState(null);

  useEffect(() => {
    if (user?.app_presence_status) {
      setPresence(user.app_presence_status);
    }
  }, [user?.app_presence_status]);

  useEffect(() => {
    if (!user?.id) return;
    if ((user?.app_presence_status || 'online') === presence) return;

    const timeoutId = window.setTimeout(() => {
      patchUserAppPreferences({ app_presence_status: presence }).catch((error) => {
        console.error('Failed to persist presence status:', error);
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [presence, user?.app_presence_status, user?.id]);

  const presenceMeta = presenceOptions.find((p) => p.id === presence) || presenceOptions[0];

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce(async (query) => {
        console.log('[Search] debouncedSearch called, currentWorkspace:', currentWorkspace?.id, 'query:', query);
        if (!currentWorkspace?.id || query.trim().length < 1) {
          console.log('[Search] Skipping - no workspace or empty query');
          setSearchResults({ tasks: [], projects: [], clients: [], members: [] });
          setSearchLoading(false);
          return;
        }

        setSearchLoading(true);
        try {
          console.log('[Search] Calling API with workspace:', currentWorkspace.id, 'query:', query);
          const response = await globalSearch(currentWorkspace.id, query, { limit: 8 });
          console.log('[Search] Response:', response.data);
          setSearchResults(response.data);
          setSelectedIndex(0);
        } catch (err) {
          console.error('Search failed:', err);
          setSearchResults({ tasks: [], projects: [], clients: [], members: [] });
        } finally {
          setSearchLoading(false);
        }
      }, 300),
    [currentWorkspace?.id]
  );

  // Fetch recent items when search opens
  useEffect(() => {
    if (searchOpen && currentWorkspace?.id) {
      getRecentItems(currentWorkspace.id)
        .then((res) => setRecentItems(res.data))
        .catch((err) => console.error('Failed to fetch recent items:', err));
    }
  }, [searchOpen, currentWorkspace?.id]);

  // Trigger search when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults({ tasks: [], projects: [], clients: [], members: [] });
      setSearchLoading(false);
    }
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  // Calculate flattened results for keyboard navigation
  const flattenedResults = useMemo(() => {
    const items = [];
    
    if (activeCategory === 'all' || activeCategory === 'tasks') {
      searchResults.tasks.forEach((item) => items.push({ ...item, category: 'tasks', type: 'task' }));
    }
    if (activeCategory === 'all' || activeCategory === 'projects') {
      searchResults.projects.forEach((item) => items.push({ ...item, category: 'projects', type: 'project' }));
    }
    if (activeCategory === 'all' || activeCategory === 'clients') {
      searchResults.clients.forEach((item) => items.push({ ...item, category: 'clients', type: 'client' }));
    }
    if (activeCategory === 'all' || activeCategory === 'members') {
      searchResults.members.forEach((item) => items.push({ ...item, category: 'members', type: 'member' }));
    }
    
    return items;
  }, [searchResults, activeCategory]);

  // Handle result selection
  const handleSelectResult = React.useCallback((item) => {
    setSearchOpen(false);
    setSearchQuery('');
    setActiveCategory('all');
    
    if (item.type === 'task') {
      // Navigate to task - pass to tasks view with specific task
      onNavigate('tasks', { taskId: item.id, projectId: item.project_id });
    } else if (item.type === 'project') {
      onNavigate('projects', { projectId: item.id });
    } else if (item.type === 'client') {
      onNavigate('clients', { clientId: item.id });
    } else if (item.type === 'member') {
      onNavigate('team', { memberId: item.id });
    }
  }, [onNavigate]);

  // Global Search hotkey (Ctrl/Cmd+K)
  useEffect(() => {
    const onKeyDown = (e) => {
      const isK = e.key?.toLowerCase() === 'k';
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && isK) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
        setActiveCategory('all');
      }
      
      // Keyboard navigation in search results
      if (searchOpen && flattenedResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flattenedResults.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && flattenedResults[selectedIndex]) {
          e.preventDefault();
          handleSelectResult(flattenedResults[selectedIndex]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, flattenedResults, selectedIndex, handleSelectResult]);

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      try {
        searchInputRef.current?.focus();
      } catch {}
    }, 50);
    return () => clearTimeout(t);
  }, [searchOpen]);

  // Breadcrumbs
  const pageLabelMap = useMemo(
    () => ({
      dashboard: 'Dashboard',
      projects: 'Projects',
      clients: 'Clients',
      tasks: 'Tasks',
      recurring: 'Recurring',
      checklist: 'Checklist',
      chat: 'Chat',
      team: 'Team',
      approvals: 'Approvals',
      admin: 'Admin',
      notifications: 'Notifications',
      activity: 'Activity',
      settings: 'Settings',
    }),
    []
  );

  const crumbs = useMemo(() => {
    const ws = currentWorkspace?.name || 'Workspace';
    const proj = selectedProject?.name || selectedProject?.title || null;
    const view = pageLabelMap[currentPage] || 'View';
    const list = [ws];
    if (proj) list.push(proj);
    list.push(view);
    return list;
  }, [currentWorkspace?.name, selectedProject, currentPage, pageLabelMap]);

  // handlers
  const handleProfileClick = (event) => setProfileAnchorEl(event.currentTarget);
  const handleProfileClose = () => setProfileAnchorEl(null);

  const handleActivityOpen = (event) => setActivityAnchorEl(event.currentTarget);
  const handleActivityClose = () => setActivityAnchorEl(null);

  const handleWorkspaceSelect = (ws) => {
    onWorkspaceChange(ws);
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

  // Quick create
  const openQuickCreateMenu = (event) => setQuickCreateAnchorEl(event.currentTarget);
  const closeQuickCreateMenu = () => setQuickCreateAnchorEl(null);

  const doQuickCreate = (type) => {
    closeQuickCreateMenu();
    if (onQuickCreate) return onQuickCreate(type);

    // fallback actions
    if (type === 'task') return onNavigate('tasks');
    if (type === 'project') return onNavigate('projects');
    if (type === 'client') return onNavigate('clients');
    if (type === 'workspace') return setCreateWorkspaceOpen(true);
  };

  // premium styles
  const iconBtnSx = {
    width: 38,
    height: 38,
    borderRadius: 2,
    color: 'text.secondary',
    border: `1px solid ${alpha('#0f172a', 0.08)}`,
    backgroundColor: alpha('#ffffff', 0.86),
    backdropFilter: 'blur(10px)',
    '&:hover': {
      backgroundColor: '#fff',
      borderColor: alpha('#0f766e', 0.25),
      boxShadow: `0 12px 22px ${alpha('#0f172a', 0.10)}`,
      transform: 'translateY(-1px)',
    },
    transition: 'all 140ms ease',
  };

  const showNotifDot = (unreadNotificationCount > 0) || hasNewNotifications;

  const isMac = useMemo(() => {
    try {
      return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
    } catch {
      return false;
    }
  }, []);

  return (
    <>
      {/* AppBar (slides in/out). The CSS var update above drives page shift */}
      <Slide appear={false} direction="down" in={appBarShown}>
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            height: `calc(${APPBAR_HEIGHT}px + var(--safe-area-top, 0px))`,
            pt: 'var(--safe-area-top, 0px)',
            bgcolor: alpha('#ffffff', 0.90),
            backdropFilter: 'blur(14px)',
            borderBottom: `1px solid ${alpha('#0f172a', 0.08)}`,
            zIndex: (t) => t.zIndex.drawer + 1,
          }}
        >
          <Toolbar sx={{ minHeight: APPBAR_HEIGHT, px: { xs: 1, sm: 2.2 }, gap: { xs: 0.75, sm: 1.6 } }}>
            {/* LEFT: Brand */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.0, minWidth: isSmDown ? 0 : 220, flexShrink: 0 }}>
              {isMdDown && (
                <Tooltip title={isMobileSidebarOpen ? 'Close menu' : 'Open menu'} arrow>
                  <IconButton onClick={onToggleSidebar} sx={iconBtnSx}>
                    <MenuIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                  boxShadow: `0 12px 22px ${alpha('#0f172a', 0.16)}`,
                }}
              >
                <RocketLaunchIcon sx={{ fontSize: 18, color: '#fff' }} />
              </Box>

              {!isSmDown && (
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 900,
                    letterSpacing: '-0.4px',
                    lineHeight: 1,
                    background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  JNB Teams
                </Typography>
              )}
            </Box>

            {/* CENTER: Breadcrumbs + Search */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.2 }}>
              {!isMdDown && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.8,
                    px: 1.2,
                    py: 0.65,
                    borderRadius: 2,
                    border: `1px solid ${alpha('#0f172a', 0.08)}`,
                    backgroundColor: alpha('#ffffff', 0.74),
                    overflow: 'hidden',
                    maxWidth: 720,
                  }}
                  title={crumbs.join(' / ')}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: ACTIVE_ACCENT,
                      boxShadow: `0 0 0 3px ${alpha(ACTIVE_ACCENT, 0.14)}`,
                      flex: '0 0 auto',
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: '0.9rem',
                      fontWeight: 850,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {crumbs.join('  ›  ')}
                  </Typography>
                </Box>
              )}

              {!isSmDown ? (
                <Tooltip title="Search (Ctrl/Cmd+K)" arrow>
                  <Paper
                    onClick={() => setSearchOpen(true)}
                    elevation={0}
                    sx={{
                      ml: 'auto',
                      width: { sm: 160, lg: 200 },
                      maxWidth: '24vw',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.4,
                      height: 38,
                      borderRadius: 2,
                      border: `1px solid ${alpha('#0f172a', 0.08)}`,
                      backgroundColor: alpha('#ffffff', 0.82),
                      cursor: 'text',
                      '&:hover': { borderColor: alpha('#0f766e', 0.18) },
                      transition: 'all 140ms ease',
                    }}
                  >
                    <SearchIcon sx={{ fontSize: 18, color: alpha('#0f172a', 0.55) }} />
                    <Typography sx={{ fontSize: '0.86rem', color: alpha('#0f172a', 0.55), fontWeight: 650 }}>
                      Search…
                    </Typography>
                    <Chip
                      size="small"
                      label={isMac ? '⌘ K' : 'Ctrl K'}
                      sx={{
                        height: 22,
                        fontSize: '0.70rem',
                        fontWeight: 900,
                        borderRadius: 1.4,
                        backgroundColor: alpha('#0f172a', 0.06),
                        color: alpha('#0f172a', 0.62),
                        ml: 'auto',
                      }}
                    />
                  </Paper>
                </Tooltip>
              ) : (
                <Tooltip title="Search (Ctrl/Cmd+K)" arrow>
                  <IconButton onClick={() => setSearchOpen(true)} sx={iconBtnSx}>
                    <SearchIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* RIGHT: Create + Presence + Workspace + Activity + Notifications + Profile */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
              {/* Create (desktop) */}
              {!isMdDown && (
                <ButtonGroup
                  variant="contained"
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: `0 14px 26px ${alpha('#0f172a', 0.10)}`,
                    '& .MuiButton-root': { textTransform: 'none', fontWeight: 950 },
                  }}
                >
                  <Button
                    onClick={() => doQuickCreate('task')}
                    startIcon={<AddIcon />}
                    sx={{
                      background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                      '&:hover': { background: 'linear-gradient(135deg, #0d6b63 0%, #10b8a6 100%)' },
                      px: 1.6,
                    }}
                  >
                    Create
                  </Button>
                  <Button
                    onClick={openQuickCreateMenu}
                    sx={{
                      minWidth: 40,
                      background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                      '&:hover': { background: 'linear-gradient(135deg, #0d6b63 0%, #10b8a6 100%)' },
                      px: 0,
                    }}
                  >
                    <KeyboardArrowDownIcon />
                  </Button>
                </ButtonGroup>
              )}

              {/* Presence */}
              {!isMdDown && (
                <>
                  <Tooltip title="Status" arrow>
                    <Chip
                      onClick={(e) => setPresenceAnchorEl(e.currentTarget)}
                      label={presenceMeta.label}
                      sx={{
                        height: 34,
                        borderRadius: 2,
                        fontWeight: 900,
                        backgroundColor: presenceMeta.bg,
                        color: presenceMeta.fg,
                        border: `1px solid ${alpha(presenceMeta.dot, 0.25)}`,
                        '& .MuiChip-label': { px: 0.9 },
                        cursor: 'pointer',
                      }}
                      icon={
                        <Box
                          sx={{
                            width: 9,
                            height: 9,
                            borderRadius: 999,
                            backgroundColor: presenceMeta.dot,
                            boxShadow: `0 0 0 3px ${alpha(presenceMeta.dot, 0.12)}`,
                            ml: 0.8,
                          }}
                        />
                      }
                    />
                  </Tooltip>

                  <Menu
                    anchorEl={presenceAnchorEl}
                    open={Boolean(presenceAnchorEl)}
                    onClose={() => setPresenceAnchorEl(null)}
                    TransitionComponent={Grow}
                    PaperProps={{
                      sx: {
                        mt: 1,
                        minWidth: 170,
                        borderRadius: 2.5,
                        border: `1px solid ${alpha('#0f172a', 0.08)}`,
                        boxShadow: `0 18px 50px ${alpha('#0f172a', 0.18)}`,
                      },
                    }}
                  >
                    {presenceOptions.map((p) => (
                      <MenuItem
                        key={p.id}
                        selected={p.id === presence}
                        onClick={() => {
                          setPresence(p.id);
                          setPresenceAnchorEl(null);
                        }}
                        sx={{ py: 1.0, '&.Mui-selected': { backgroundColor: alpha(p.dot, 0.10) } }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: p.dot,
                            mr: 1.1,
                            boxShadow: `0 0 0 3px ${alpha(p.dot, 0.12)}`,
                          }}
                        />
                        <ListItemText primary={p.label} primaryTypographyProps={{ fontWeight: 900, color: '#0f172a' }} />
                        {p.id === presence && <CheckIcon sx={{ fontSize: 18, color: p.dot }} />}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}

              {/* Workspace */}
              <Tooltip title="Switch workspace" arrow>
                {isMdDown ? null : (
                  <Chip
                    onClick={handleProfileClick}
                    icon={<WorkspacesIcon sx={{ fontSize: 18 }} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentWorkspace?.name || 'Workspace'}
                        </span>
                        <KeyboardArrowDownIcon sx={{ fontSize: 18, opacity: 0.8 }} />
                      </Box>
                    }
                    sx={{
                      height: 34,
                      borderRadius: 2,
                      fontWeight: 900,
                      color: '#0f766e',
                      border: `1px solid ${alpha('#0f766e', 0.22)}`,
                      background: `linear-gradient(135deg, ${alpha('#0f766e', 0.10)} 0%, ${alpha('#14b8a6', 0.06)} 100%)`,
                      '& .MuiChip-label': { px: 0.9 },
                      '&:hover': {
                        background: `linear-gradient(135deg, ${alpha('#0f766e', 0.14)} 0%, ${alpha('#14b8a6', 0.08)} 100%)`,
                        boxShadow: `0 12px 22px ${alpha('#0f172a', 0.08)}`,
                      },
                      transition: 'all 140ms ease',
                    }}
                  />
                )}
              </Tooltip>

              {/* Activity */}
              {!isSmDown && (
                <Tooltip title="Activity" arrow>
                  <IconButton onClick={handleActivityOpen} sx={iconBtnSx}>
                    <TimelineIcon />
                  </IconButton>
                </Tooltip>
              )}

              {/* Notifications Drawer */}
              <Tooltip title="Notifications" arrow>
                <IconButton
                  onClick={() => setNotificationsOpen(true)}
                  sx={{
                    ...iconBtnSx,
                    borderColor: showNotifDot ? alpha(ACTIVE_ACCENT, 0.25) : iconBtnSx.borderColor,
                  }}
                >
                  <Badge
                    badgeContent={unreadNotificationCount}
                    color="error"
                    invisible={unreadNotificationCount <= 0}
                    sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16, borderRadius: 999 } }}
                  >
                    <Box sx={{ position: 'relative' }}>
                      <NotificationsIcon />
                      {showNotifDot && unreadNotificationCount <= 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            right: -2,
                            top: -2,
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: ACTIVE_ACCENT,
                            boxShadow: `0 0 0 3px ${alpha(ACTIVE_ACCENT, 0.14)}`,
                          }}
                        />
                      )}
                    </Box>
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* Profile */}
              <Tooltip title={displayName} arrow>
                <IconButton
                  onClick={handleProfileClick}
                  sx={{
                    ...iconBtnSx,
                    width: 42,
                    height: 42,
                    borderRadius: 2.2,
                    borderColor: alpha('#0f766e', Boolean(profileAnchorEl) ? 0.28 : 0.10),
                    boxShadow: Boolean(profileAnchorEl) ? `0 14px 26px ${alpha('#0f172a', 0.12)}` : 'none',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      fontWeight: 950,
                      fontSize: '0.88rem',
                      color: '#fff',
                      background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                      boxShadow: `0 12px 22px ${alpha('#0f172a', 0.14)}`,
                    }}
                  >
                    {initials}
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>
      </Slide>

      {/* Notifications Drawer */}
      <Drawer
        anchor="right"
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        SlideProps={{ timeout: 220 }}
        PaperProps={{
          sx: {
            width: isSmDown ? '92vw' : 420,
            borderLeft: `1px solid ${alpha('#0f172a', 0.08)}`,
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 950, fontSize: '1.05rem', color: '#0f172a', flex: 1 }}>
            Notifications
          </Typography>
          <Chip
            label={`${unreadNotificationCount} unread`}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.68rem',
              fontWeight: 900,
              borderRadius: 999,
              backgroundColor: alpha('#ef4444', 0.10),
              color: '#b91c1c',
              border: `1px solid ${alpha('#ef4444', 0.18)}`,
            }}
          />
          <IconButton onClick={() => setNotificationsOpen(false)} sx={{ borderRadius: 2 }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Tabs
          value={notifTab}
          onChange={(e, v) => setNotifTab(v)}
          sx={{
            px: 1,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 900 },
            '& .MuiTabs-indicator': { backgroundColor: ACTIVE_ACCENT, height: 3, borderRadius: 2 },
          }}
        >
          <Tab label="All" />
          <Tab label="Mentions" />
          <Tab label="Approvals" />
        </Tabs>

        <Divider />

        <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setNotificationsOpen(false);
              onNavigate('notifications');
            }}
            sx={{ textTransform: 'none', fontWeight: 900, borderRadius: 2 }}
          >
            View all
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleMarkAllRead}
            sx={{
              textTransform: 'none',
              fontWeight: 950,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #0d6b63 0%, #10b8a6 100%)' },
            }}
          >
            Mark all read
          </Button>
        </Box>

        <Divider />

        <List sx={{ py: 0, maxHeight: 400, overflow: 'auto' }}>
          {notificationsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (() => {
            // Filter notifications based on tab
            const filtered = notificationsList.filter(n => {
              if (notifTab === 1) return n.type?.includes('mentioned') || n.type?.includes('comment');
              if (notifTab === 2) return n.type?.includes('approval') || n.type === 'Approval';
              return true;
            }).slice(0, 10);

            if (filtered.length === 0) {
              return (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No notifications
                  </Typography>
                </Box>
              );
            }

            return filtered.map((notif) => (
              <ListItem
                key={notif.id}
                sx={{
                  py: 1.2,
                  px: 2,
                  borderBottom: `1px solid ${alpha('#0f172a', 0.06)}`,
                  '&:hover': { backgroundColor: alpha('#0f172a', 0.03) },
                  backgroundColor: notif.read ? 'transparent' : alpha('#0f766e', 0.04),
                }}
                disableGutters
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Box sx={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: 1.5, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: alpha('#0f766e', 0.1),
                    color: '#0f766e'
                  }}>
                    {getNotificationIcon(notif.type)}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={notif.title || notif.message || 'Notification'}
                  secondary={formatRelativeTime(notif.created_at)}
                  primaryTypographyProps={{ 
                    fontSize: '0.85rem', 
                    fontWeight: notif.read ? 500 : 700, 
                    color: '#0f172a',
                    sx: { 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical' 
                    }
                  }}
                  secondaryTypographyProps={{ fontSize: '0.72rem', color: alpha('#0f172a', 0.55) }}
                />
              </ListItem>
            ));
          })()}
        </List>
      </Drawer>

      {/* Workspace/Profile menu (COMPACT + NO RECENT) */}
      <Menu
        anchorEl={profileAnchorEl}
        open={Boolean(profileAnchorEl)}
        onClose={handleProfileClose}
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 300,
            maxWidth: 320,
            borderRadius: 2.5,
            overflow: 'hidden',
            border: `1px solid ${alpha('#0f172a', 0.08)}`,
            boxShadow: `0 18px 50px ${alpha('#0f172a', 0.18)}`,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Compact user header */}
        <Box
          sx={{
            px: 1.5,
            py: 1.4,
            background: `linear-gradient(135deg, ${alpha('#0f766e', 0.10)} 0%, ${alpha('#14b8a6', 0.06)} 100%)`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                fontWeight: 950,
                color: '#fff',
                background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                boxShadow: `0 12px 22px ${alpha('#0f172a', 0.14)}`,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: '0.92rem', color: '#0f172a' }} noWrap>
                {displayName}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: alpha('#0f172a', 0.62) }} noWrap>
                {user?.email}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Workspace selection compact */}
        <Box sx={{ px: 1.5, py: 1.1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: 0.8, color: alpha('#0f172a', 0.55) }}>
              WORKSPACES
            </Typography>

            {canCreateWorkspace ? (
              <Tooltip title="Create workspace" arrow>
                <IconButton
                  size="small"
                  onClick={() => setCreateWorkspaceOpen(true)}
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 2,
                    color: '#0f766e',
                    border: `1px solid ${alpha('#0f766e', 0.18)}`,
                    backgroundColor: alpha('#0f766e', 0.08),
                    '&:hover': { backgroundColor: alpha('#0f766e', 0.12) },
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Ask an admin to create workspaces" arrow>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    color: alpha('#0f172a', 0.35),
                    border: `1px solid ${alpha('#0f172a', 0.08)}`,
                    backgroundColor: alpha('#0f172a', 0.03),
                  }}
                >
                  <AddIcon fontSize="small" />
                </Box>
              </Tooltip>
            )}
          </Box>

          <List disablePadding>
            {workspaces.map((ws) => {
              const selected = currentWorkspace?.id === ws.id;
              const color = ws.color || '#0f766e';
              return (
                <ListItemButton
                  key={ws.id}
                  onClick={() => handleWorkspaceSelect(ws)}
                  selected={selected}
                  sx={{
                    borderRadius: 1.8,
                    mb: 0.4,
                    px: 0.8,
                    py: 0.65,
                    border: `1px solid ${selected ? alpha(color, 0.25) : alpha('#0f172a', 0.06)}`,
                    '&.Mui-selected': { backgroundColor: alpha(color, 0.08), '&:hover': { backgroundColor: alpha(color, 0.12) } },
                    '&:hover': { backgroundColor: alpha('#0f172a', 0.03) },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: 1.6,
                        display: 'grid',
                        placeItems: 'center',
                        background: `linear-gradient(135deg, ${alpha(color, 0.18)} 0%, ${alpha(color, 0.08)} 100%)`,
                        border: `1px solid ${alpha(color, 0.18)}`,
                      }}
                    >
                      <WorkspacesIcon sx={{ fontSize: 15, color }} />
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={ws.name}
                    secondary={ws.role}
                    primaryTypographyProps={{
                      fontSize: '0.84rem',
                      fontWeight: selected ? 900 : 650,
                      color: '#0f172a',
                      noWrap: true,
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.70rem',
                      color: alpha('#0f172a', 0.58),
                      noWrap: true,
                    }}
                  />
                  {selected && <CheckIcon sx={{ fontSize: 16, color }} />}
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        <Divider />

        {/* Settings + Logout compact */}
        <MenuItem
          onClick={() => {
            handleProfileClose();
            onNavigate('settings');
          }}
          sx={{ py: 1.05 }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Settings" primaryTypographyProps={{ fontWeight: 900, fontSize: '0.88rem' }} />
        </MenuItem>

        <MenuItem
          onClick={onLogout}
          sx={{ py: 1.05, color: 'error.main', '&:hover': { backgroundColor: alpha('#ef4444', 0.06) } }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Log out" primaryTypographyProps={{ fontWeight: 900, fontSize: '0.88rem' }} />
        </MenuItem>
      </Menu>

      {/* Activity Menu */}
      <Menu
        anchorEl={activityAnchorEl}
        open={Boolean(activityAnchorEl)}
        onClose={handleActivityClose}
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: isSmDown ? 340 : 560,
            maxWidth: 680,
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${alpha('#0f172a', 0.08)}`,
            boxShadow: `0 18px 50px ${alpha('#0f172a', 0.18)}`,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, borderBottom: `1px solid ${alpha('#0f172a', 0.06)}` }}>
          <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Activity Log</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: alpha('#0f172a', 0.55), mt: 0.4 }}>
            Latest events across your workspace
          </Typography>
        </Box>

        <List sx={{ maxHeight: 420, overflow: 'auto', py: 0 }}>
          {activityLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : activityList.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No recent activity
              </Typography>
            </Box>
          ) : (
            activityList.slice(0, 10).map((activity, i) => (
              <ListItem
                key={activity.id || i}
                sx={{
                  py: 1.2,
                  px: 2,
                  borderBottom: `1px solid ${alpha('#0f172a', 0.06)}`,
                  '&:hover': { backgroundColor: alpha('#0f172a', 0.03) },
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                }}
                disableGutters
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Avatar
                    sx={{
                      width: 26,
                      height: 26,
                      fontSize: '0.72rem',
                      fontWeight: 950,
                      color: '#fff',
                      background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                    }}
                  >
                    {activity.user_name ? activity.user_name.split(' ').map((n) => n[0]).join('').substring(0, 2) : 'U'}
                  </Avatar>
                  <Typography variant="body2" sx={{ flex: 1, color: '#0f172a' }}>
                    <strong>{activity.user_name || 'Unknown User'}</strong> {activity.action || 'updated'} <strong>{activity.entity_name || activity.entity_type || 'item'}</strong>
                  </Typography>
                  <Typography variant="caption" sx={{ color: alpha('#0f172a', 0.55) }}>
                    {formatRelativeTime(activity.created_at)}
                  </Typography>
                </Box>

                {activity.project_name && (
                  <Box sx={{ display: 'flex', gap: 1, ml: 4, mt: 0.8 }}>
                    <Chip
                      label={activity.project_name}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.70rem',
                        fontWeight: 900,
                        backgroundColor: alpha('#0f766e', 0.10),
                        color: '#0f766e',
                        border: `1px solid ${alpha('#0f766e', 0.16)}`,
                      }}
                    />
                  </Box>
                )}
              </ListItem>
            ))
          )}
        </List>

        <Box sx={{ p: 1.2, textAlign: 'center' }}>
          <Button
            size="small"
            onClick={() => {
              handleActivityClose();
              onNavigate('activity');
            }}
            sx={{ textTransform: 'none', fontWeight: 900 }}
          >
            View full activity log
          </Button>
        </Box>
      </Menu>

      {/* Quick Create Menu */}
      <Menu
        anchorEl={quickCreateAnchorEl}
        open={Boolean(quickCreateAnchorEl)}
        onClose={closeQuickCreateMenu}
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 220,
            borderRadius: 2.5,
            border: `1px solid ${alpha('#0f172a', 0.08)}`,
            boxShadow: `0 18px 50px ${alpha('#0f172a', 0.18)}`,
          },
        }}
      >
        <MenuItem onClick={() => doQuickCreate('task')} sx={{ py: 1.1 }}>
          <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Create Task" primaryTypographyProps={{ fontWeight: 900 }} />
        </MenuItem>
        <MenuItem onClick={() => doQuickCreate('project')} sx={{ py: 1.1 }}>
          <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Create Project" primaryTypographyProps={{ fontWeight: 900 }} />
        </MenuItem>
        <MenuItem onClick={() => doQuickCreate('client')} sx={{ py: 1.1 }}>
          <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Create Client" primaryTypographyProps={{ fontWeight: 900 }} />
        </MenuItem>
        <Divider />
        {canCreateWorkspace ? (
          <MenuItem onClick={() => doQuickCreate('workspace')} sx={{ py: 1.1 }}>
            <ListItemIcon><WorkspacesIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Create Workspace" primaryTypographyProps={{ fontWeight: 900 }} />
          </MenuItem>
        ) : (
          <Tooltip title="Ask an admin to create workspaces" arrow placement="left">
            <Box>
              <MenuItem disabled sx={{ py: 1.1 }}>
                <ListItemIcon><WorkspacesIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Create Workspace" primaryTypographyProps={{ fontWeight: 900 }} />
              </MenuItem>
            </Box>
          </Tooltip>
        )}
      </Menu>

      {/* Global Search Dialog - Enhanced with Categories */}
      <Dialog
        open={searchOpen}
        onClose={() => { setSearchOpen(false); setSearchQuery(''); setActiveCategory('all'); }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${alpha('#0f172a', 0.08)}`,
            boxShadow: `0 22px 70px ${alpha('#0f172a', 0.22)}`,
            maxHeight: '85vh',
          },
        }}
        TransitionComponent={Grow}
      >
        {/* Search Header */}
        <Box sx={{ 
          px: 2.5, 
          pt: 2.5, 
          pb: 1.5, 
          borderBottom: `1px solid ${alpha('#0f172a', 0.08)}`,
          backgroundColor: alpha('#f8fafc', 0.8),
        }}>
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              height: 52,
              borderRadius: 2.5,
              border: `2px solid ${searchQuery ? '#0f766e' : alpha('#0f172a', 0.12)}`,
              backgroundColor: '#fff',
              transition: 'border-color 0.2s ease',
            }}
          >
            <SearchIcon sx={{ color: searchQuery ? '#0f766e' : alpha('#0f172a', 0.45), fontSize: 22 }} />
            <InputBase
              inputRef={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, projects, clients, team members..."
              sx={{ 
                flex: 1, 
                fontWeight: 600, 
                fontSize: '0.95rem',
                '& input::placeholder': {
                  color: alpha('#0f172a', 0.45),
                  opacity: 1,
                },
              }}
            />
            {searchLoading && <CircularProgress size={20} sx={{ color: '#0f766e' }} />}
            {searchQuery && (
              <IconButton 
                size="small" 
                onClick={() => setSearchQuery('')}
                sx={{ color: alpha('#0f172a', 0.45) }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
            <Chip
              size="small"
              label="Esc"
              sx={{
                height: 22,
                fontSize: '0.68rem',
                fontWeight: 800,
                borderRadius: 1.2,
                backgroundColor: alpha('#0f172a', 0.06),
                color: alpha('#0f172a', 0.55),
              }}
            />
          </Paper>

          {/* Category Tabs */}
          <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All', icon: <SearchIcon fontSize="small" /> },
              { key: 'tasks', label: 'Tasks', icon: <TaskIcon fontSize="small" />, count: searchResults.tasks.length },
              { key: 'projects', label: 'Projects', icon: <FolderIcon fontSize="small" />, count: searchResults.projects.length },
              { key: 'clients', label: 'Clients', icon: <BusinessIcon fontSize="small" />, count: searchResults.clients.length },
              { key: 'members', label: 'Team', icon: <PersonIcon fontSize="small" />, count: searchResults.members.length },
            ].map((cat) => (
              <Chip
                key={cat.key}
                icon={cat.icon}
                label={cat.count !== undefined && searchQuery ? `${cat.label} (${cat.count})` : cat.label}
                onClick={() => { setActiveCategory(cat.key); setSelectedIndex(0); }}
                variant={activeCategory === cat.key ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  height: 30,
                  borderColor: activeCategory === cat.key ? '#0f766e' : alpha('#0f172a', 0.15),
                  backgroundColor: activeCategory === cat.key ? '#0f766e' : 'transparent',
                  color: activeCategory === cat.key ? '#fff' : alpha('#0f172a', 0.7),
                  '& .MuiChip-icon': {
                    color: activeCategory === cat.key ? '#fff' : alpha('#0f172a', 0.5),
                    fontSize: 16,
                  },
                  '&:hover': {
                    backgroundColor: activeCategory === cat.key ? '#0d5c56' : alpha('#0f766e', 0.08),
                    borderColor: '#0f766e',
                  },
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Search Results */}
        <DialogContent sx={{ p: 0, minHeight: 320, maxHeight: 480, overflow: 'auto' }}>
          {/* No Query - Show Recent Items */}
          {!searchQuery && (
            <Box sx={{ p: 2 }}>
              <Typography sx={{ 
                fontSize: '0.72rem', 
                fontWeight: 800, 
                color: alpha('#0f172a', 0.45), 
                textTransform: 'uppercase', 
                letterSpacing: 0.8,
                mb: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}>
                <HistoryIcon sx={{ fontSize: 14 }} />
                Recent Items
              </Typography>
              
              {/* Recent Tasks */}
              {recentItems.tasks?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: alpha('#0f172a', 0.5), mb: 0.5 }}>
                    Tasks
                  </Typography>
                  {recentItems.tasks.map((item) => (
                    <ListItemButton
                      key={`recent-task-${item.id}`}
                      onClick={() => handleSelectResult({ ...item, type: 'task' })}
                      sx={{
                        py: 1,
                        px: 1.5,
                        borderRadius: 2,
                        mb: 0.5,
                        '&:hover': { backgroundColor: alpha('#0f766e', 0.06) },
                      }}
                    >
                      <Box sx={{
                        width: 32, height: 32, borderRadius: 2, mr: 1.5,
                        display: 'grid', placeItems: 'center',
                        backgroundColor: alpha('#3b82f6', 0.1),
                        color: '#3b82f6',
                      }}>
                        <TaskIcon sx={{ fontSize: 16 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: alpha('#0f172a', 0.5) }}>
                          {item.project_name || 'No project'} • {item.status || 'Open'}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  ))}
                </Box>
              )}

              {/* Recent Projects */}
              {recentItems.projects?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: alpha('#0f172a', 0.5), mb: 0.5 }}>
                    Projects
                  </Typography>
                  {recentItems.projects.map((item) => (
                    <ListItemButton
                      key={`recent-project-${item.id}`}
                      onClick={() => handleSelectResult({ ...item, type: 'project' })}
                      sx={{
                        py: 1,
                        px: 1.5,
                        borderRadius: 2,
                        mb: 0.5,
                        '&:hover': { backgroundColor: alpha('#0f766e', 0.06) },
                      }}
                    >
                      <Box sx={{
                        width: 32, height: 32, borderRadius: 2, mr: 1.5,
                        display: 'grid', placeItems: 'center',
                        backgroundColor: alpha('#8b5cf6', 0.1),
                        color: '#8b5cf6',
                      }}>
                        <FolderIcon sx={{ fontSize: 16 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: alpha('#0f172a', 0.5) }}>
                          {item.client_name || 'No client'} • {item.stage || item.status}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  ))}
                </Box>
              )}

              {/* Recent Clients */}
              {recentItems.clients?.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: alpha('#0f172a', 0.5), mb: 0.5 }}>
                    Clients
                  </Typography>
                  {recentItems.clients.map((item) => (
                    <ListItemButton
                      key={`recent-client-${item.id}`}
                      onClick={() => handleSelectResult({ ...item, type: 'client' })}
                      sx={{
                        py: 1,
                        px: 1.5,
                        borderRadius: 2,
                        mb: 0.5,
                        '&:hover': { backgroundColor: alpha('#0f766e', 0.06) },
                      }}
                    >
                      <Box sx={{
                        width: 32, height: 32, borderRadius: 2, mr: 1.5,
                        display: 'grid', placeItems: 'center',
                        backgroundColor: alpha('#f59e0b', 0.1),
                        color: '#f59e0b',
                      }}>
                        <BusinessIcon sx={{ fontSize: 16 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.client_name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: alpha('#0f172a', 0.5) }}>
                          {item.series_no || ''} {item.status ? `• ${item.status}` : ''}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  ))}
                </Box>
              )}

              {/* No Recent Items */}
              {(!recentItems.tasks?.length && !recentItems.projects?.length && !recentItems.clients?.length) && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <HistoryIcon sx={{ fontSize: 40, color: alpha('#0f172a', 0.15), mb: 1 }} />
                  <Typography sx={{ color: alpha('#0f172a', 0.5), fontWeight: 600 }}>
                    No recent items
                  </Typography>
                  <Typography sx={{ color: alpha('#0f172a', 0.35), fontSize: '0.85rem' }}>
                    Start typing to search
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Has Query - Show Search Results */}
          {searchQuery && (
            <Box>
              {flattenedResults.length === 0 && !searchLoading ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <SearchIcon sx={{ fontSize: 48, color: alpha('#0f172a', 0.12), mb: 1 }} />
                  <Typography sx={{ color: alpha('#0f172a', 0.5), fontWeight: 700, fontSize: '1.1rem' }}>
                    No results found
                  </Typography>
                  <Typography sx={{ color: alpha('#0f172a', 0.35), fontSize: '0.88rem', mt: 0.5 }}>
                    Try different keywords or check the spelling
                  </Typography>
                </Box>
              ) : (
                <List sx={{ py: 1 }}>
                  {/* Tasks Section */}
                  {(activeCategory === 'all' || activeCategory === 'tasks') && searchResults.tasks.length > 0 && (
                    <>
                      {activeCategory === 'all' && (
                        <Typography sx={{ 
                          px: 2, py: 1, fontSize: '0.72rem', fontWeight: 800, 
                          color: alpha('#0f172a', 0.45), textTransform: 'uppercase', 
                          letterSpacing: 0.8, backgroundColor: alpha('#f8fafc', 0.8),
                          display: 'flex', alignItems: 'center', gap: 0.75,
                        }}>
                          <TaskIcon sx={{ fontSize: 14 }} />
                          Tasks ({searchResults.tasks.length})
                        </Typography>
                      )}
                      {searchResults.tasks.map((item, idx) => {
                        const globalIdx = flattenedResults.findIndex(f => f.id === item.id && f.category === 'tasks');
                        return (
                          <ListItemButton
                            key={`task-${item.id}`}
                            selected={selectedIndex === globalIdx}
                            onClick={() => handleSelectResult(item)}
                            sx={{
                              py: 1.25,
                              px: 2,
                              borderBottom: `1px solid ${alpha('#0f172a', 0.05)}`,
                              '&:hover': { backgroundColor: alpha('#0f766e', 0.04) },
                              '&.Mui-selected': { 
                                backgroundColor: alpha('#0f766e', 0.08),
                                '&:hover': { backgroundColor: alpha('#0f766e', 0.12) },
                              },
                            }}
                          >
                            <Box sx={{
                              width: 36, height: 36, borderRadius: 2, mr: 1.5,
                              display: 'grid', placeItems: 'center',
                              backgroundColor: alpha('#3b82f6', 0.1),
                              color: '#3b82f6',
                              flexShrink: 0,
                            }}>
                              <TaskIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ 
                                fontWeight: 700, fontSize: '0.9rem', color: '#0f172a',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {item.name}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', color: alpha('#0f172a', 0.55) }}>
                                {item.project_name || 'No project'} 
                                {item.assignee_name && ` • ${item.assignee_name}`}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
                              {item.priority && (
                                <Chip
                                  size="small"
                                  label={item.priority}
                                  sx={{
                                    height: 22, fontSize: '0.7rem', fontWeight: 700,
                                    backgroundColor: item.priority === 'High' || item.priority === 'Critical' 
                                      ? alpha('#ef4444', 0.1) 
                                      : alpha('#0f172a', 0.06),
                                    color: item.priority === 'High' || item.priority === 'Critical' 
                                      ? '#dc2626' 
                                      : alpha('#0f172a', 0.6),
                                  }}
                                />
                              )}
                              <Chip
                                size="small"
                                label={item.status || 'Open'}
                                sx={{
                                  height: 22, fontSize: '0.7rem', fontWeight: 700,
                                  backgroundColor: alpha('#0f172a', 0.06),
                                  color: alpha('#0f172a', 0.6),
                                }}
                              />
                            </Box>
                          </ListItemButton>
                        );
                      })}
                    </>
                  )}

                  {/* Projects Section */}
                  {(activeCategory === 'all' || activeCategory === 'projects') && searchResults.projects.length > 0 && (
                    <>
                      {activeCategory === 'all' && (
                        <Typography sx={{ 
                          px: 2, py: 1, fontSize: '0.72rem', fontWeight: 800, 
                          color: alpha('#0f172a', 0.45), textTransform: 'uppercase', 
                          letterSpacing: 0.8, backgroundColor: alpha('#f8fafc', 0.8),
                          display: 'flex', alignItems: 'center', gap: 0.75,
                        }}>
                          <FolderIcon sx={{ fontSize: 14 }} />
                          Projects ({searchResults.projects.length})
                        </Typography>
                      )}
                      {searchResults.projects.map((item, idx) => {
                        const globalIdx = flattenedResults.findIndex(f => f.id === item.id && f.category === 'projects');
                        return (
                          <ListItemButton
                            key={`project-${item.id}`}
                            selected={selectedIndex === globalIdx}
                            onClick={() => handleSelectResult(item)}
                            sx={{
                              py: 1.25,
                              px: 2,
                              borderBottom: `1px solid ${alpha('#0f172a', 0.05)}`,
                              '&:hover': { backgroundColor: alpha('#0f766e', 0.04) },
                              '&.Mui-selected': { 
                                backgroundColor: alpha('#0f766e', 0.08),
                                '&:hover': { backgroundColor: alpha('#0f766e', 0.12) },
                              },
                            }}
                          >
                            <Box sx={{
                              width: 36, height: 36, borderRadius: 2, mr: 1.5,
                              display: 'grid', placeItems: 'center',
                              backgroundColor: alpha('#8b5cf6', 0.1),
                              color: '#8b5cf6',
                              flexShrink: 0,
                            }}>
                              <FolderIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ 
                                fontWeight: 700, fontSize: '0.9rem', color: '#0f172a',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {item.name}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', color: alpha('#0f172a', 0.55) }}>
                                {item.client_name || 'No client'}
                                {item.task_count > 0 && ` • ${item.task_count} tasks`}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={item.stage || item.status || 'Active'}
                              sx={{
                                height: 22, fontSize: '0.7rem', fontWeight: 700,
                                backgroundColor: alpha('#8b5cf6', 0.1),
                                color: '#7c3aed',
                              }}
                            />
                          </ListItemButton>
                        );
                      })}
                    </>
                  )}

                  {/* Clients Section */}
                  {(activeCategory === 'all' || activeCategory === 'clients') && searchResults.clients.length > 0 && (
                    <>
                      {activeCategory === 'all' && (
                        <Typography sx={{ 
                          px: 2, py: 1, fontSize: '0.72rem', fontWeight: 800, 
                          color: alpha('#0f172a', 0.45), textTransform: 'uppercase', 
                          letterSpacing: 0.8, backgroundColor: alpha('#f8fafc', 0.8),
                          display: 'flex', alignItems: 'center', gap: 0.75,
                        }}>
                          <BusinessIcon sx={{ fontSize: 14 }} />
                          Clients ({searchResults.clients.length})
                        </Typography>
                      )}
                      {searchResults.clients.map((item, idx) => {
                        const globalIdx = flattenedResults.findIndex(f => f.id === item.id && f.category === 'clients');
                        return (
                          <ListItemButton
                            key={`client-${item.id}`}
                            selected={selectedIndex === globalIdx}
                            onClick={() => handleSelectResult(item)}
                            sx={{
                              py: 1.25,
                              px: 2,
                              borderBottom: `1px solid ${alpha('#0f172a', 0.05)}`,
                              '&:hover': { backgroundColor: alpha('#0f766e', 0.04) },
                              '&.Mui-selected': { 
                                backgroundColor: alpha('#0f766e', 0.08),
                                '&:hover': { backgroundColor: alpha('#0f766e', 0.12) },
                              },
                            }}
                          >
                            <Box sx={{
                              width: 36, height: 36, borderRadius: 2, mr: 1.5,
                              display: 'grid', placeItems: 'center',
                              backgroundColor: alpha('#f59e0b', 0.1),
                              color: '#f59e0b',
                              flexShrink: 0,
                            }}>
                              <BusinessIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ 
                                fontWeight: 700, fontSize: '0.9rem', color: '#0f172a',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {item.client_name}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', color: alpha('#0f172a', 0.55) }}>
                                {item.series_no && `${item.series_no} • `}
                                {item.city || item.industry || ''}
                                {item.project_count > 0 && ` • ${item.project_count} projects`}
                              </Typography>
                            </Box>
                            {item.status && (
                              <Chip
                                size="small"
                                label={item.status}
                                sx={{
                                  height: 22, fontSize: '0.7rem', fontWeight: 700,
                                  backgroundColor: item.status === 'Active' 
                                    ? alpha('#22c55e', 0.1) 
                                    : alpha('#0f172a', 0.06),
                                  color: item.status === 'Active' ? '#16a34a' : alpha('#0f172a', 0.6),
                                }}
                              />
                            )}
                          </ListItemButton>
                        );
                      })}
                    </>
                  )}

                  {/* Team Members Section */}
                  {(activeCategory === 'all' || activeCategory === 'members') && searchResults.members.length > 0 && (
                    <>
                      {activeCategory === 'all' && (
                        <Typography sx={{ 
                          px: 2, py: 1, fontSize: '0.72rem', fontWeight: 800, 
                          color: alpha('#0f172a', 0.45), textTransform: 'uppercase', 
                          letterSpacing: 0.8, backgroundColor: alpha('#f8fafc', 0.8),
                          display: 'flex', alignItems: 'center', gap: 0.75,
                        }}>
                          <PersonIcon sx={{ fontSize: 14 }} />
                          Team Members ({searchResults.members.length})
                        </Typography>
                      )}
                      {searchResults.members.map((item, idx) => {
                        const globalIdx = flattenedResults.findIndex(f => f.id === item.id && f.category === 'members');
                        const initials = item.first_name && item.last_name 
                          ? `${item.first_name[0]}${item.last_name[0]}`.toUpperCase()
                          : item.username?.[0]?.toUpperCase() || '?';
                        return (
                          <ListItemButton
                            key={`member-${item.id}`}
                            selected={selectedIndex === globalIdx}
                            onClick={() => handleSelectResult(item)}
                            sx={{
                              py: 1.25,
                              px: 2,
                              borderBottom: `1px solid ${alpha('#0f172a', 0.05)}`,
                              '&:hover': { backgroundColor: alpha('#0f766e', 0.04) },
                              '&.Mui-selected': { 
                                backgroundColor: alpha('#0f766e', 0.08),
                                '&:hover': { backgroundColor: alpha('#0f766e', 0.12) },
                              },
                            }}
                          >
                            <Avatar sx={{
                              width: 36, height: 36, mr: 1.5,
                              backgroundColor: alpha('#0f766e', 0.15),
                              color: '#0f766e',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                            }}>
                              {initials}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ 
                                fontWeight: 700, fontSize: '0.9rem', color: '#0f172a',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {item.full_name || item.username}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', color: alpha('#0f172a', 0.55) }}>
                                @{item.username} • {item.email}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={item.role}
                              sx={{
                                height: 22, fontSize: '0.7rem', fontWeight: 700,
                                backgroundColor: item.role === 'Owner' || item.role === 'Admin'
                                  ? alpha('#0f766e', 0.1)
                                  : alpha('#0f172a', 0.06),
                                color: item.role === 'Owner' || item.role === 'Admin'
                                  ? '#0f766e'
                                  : alpha('#0f172a', 0.6),
                              }}
                            />
                          </ListItemButton>
                        );
                      })}
                    </>
                  )}
                </List>
              )}
            </Box>
          )}
        </DialogContent>

        {/* Footer */}
        <Box sx={{ 
          px: 2.5, 
          py: 1.5, 
          borderTop: `1px solid ${alpha('#0f172a', 0.08)}`,
          backgroundColor: alpha('#f8fafc', 0.6),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Typography sx={{ fontSize: '0.78rem', color: alpha('#0f172a', 0.45) }}>
            <strong>{isMac ? '⌘' : 'Ctrl'}+K</strong> to open • <strong>↑↓</strong> to navigate • <strong>Enter</strong> to select
          </Typography>
          <Button 
            size="small"
            onClick={() => { setSearchOpen(false); setSearchQuery(''); setActiveCategory('all'); }} 
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.82rem' }}
          >
            Close
          </Button>
        </Box>
      </Dialog>

      {/* Create Workspace Dialog */}
      <Dialog
        open={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${alpha('#0f172a', 0.08)}`,
            boxShadow: `0 20px 60px ${alpha('#0f172a', 0.18)}`,
          },
        }}
        TransitionComponent={Grow}
      >
        <DialogTitle sx={{ fontWeight: 950 }}>Create New Workspace</DialogTitle>
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
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: alpha('#0f172a', 0.60) }}>
            A workspace is a shared environment for your team to collaborate on projects.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setCreateWorkspaceOpen(false)} sx={{ textTransform: 'none', fontWeight: 900 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateWorkspace}
            disabled={!newWorkspaceName.trim()}
            sx={{
              textTransform: 'none',
              px: 3,
              fontWeight: 950,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
              boxShadow: `0 14px 26px ${alpha('#0f172a', 0.18)}`,
              '&:hover': { background: 'linear-gradient(135deg, #0d6b63 0%, #10b8a6 100%)' },
            }}
          >
            Create Workspace
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default TopAppBar;
