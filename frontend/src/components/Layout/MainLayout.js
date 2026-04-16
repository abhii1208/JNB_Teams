import React, { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Sidebar from './Sidebar';
import TopAppBar from './TopAppBar';
import MobileTopBar, { MOBILE_TOPBAR_HEIGHT } from './MobileTopBar';
import MobileBottomNav, { MOBILE_BOTTOM_NAV_HEIGHT } from './MobileBottomNav';
import MobileMoreSheet from './MobileMoreSheet';
import Dashboard from '../Dashboard/Dashboard';
import ProjectList from '../Projects/ProjectList';
import ProjectDetail from '../Projects/ProjectDetail';
import TeamPage from '../Team/TeamPage';
import SettingsPage from '../Settings/SettingsPage';
import ApprovalsPage from '../Approvals/ApprovalsPage';
import ActivityLogPage from '../Activity/ActivityLogPage';
import NotificationsPage from '../Notifications/NotificationsPage';
import NotificationToast from '../Notifications/NotificationToast';
import useNotifications from '../Notifications/useNotifications';
import RecurringPage from '../Recurring/RecurringPageV2';
import TasksPage from '../Tasks/TasksPage';
import AdminPage from '../Admin/AdminPage';
import ClientsPage from '../Clients/ClientsPage';
import ChatPage from '../Chat/ChatPage';
import ServicesPage from '../Services/ServicesPage';
import OperationsPage from '../Operations/OperationsPage';
import SupportPage from '../Support/SupportPage';
import { ChecklistPage } from '../Checklist';
import { getWorkspaces, getUserSettings, patchUserAppPreferences } from '../../apiClient';

function MainLayout({ userId, onLogout, themePreference = 'light', onThemePreferenceChange }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [navigationState, setNavigationState] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [user, setUser] = useState(null);

  const buildHistoryState = useCallback((overrides = {}) => ({
    appView: 'main-layout',
    userId,
    page: currentPage,
    selectedProject,
    selectedTask,
    navigationState,
    ...overrides,
  }), [userId, currentPage, selectedProject, selectedTask, navigationState]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [workspacesResult, userResult] = await Promise.allSettled([
          getWorkspaces(),
          getUserSettings(),
        ]);

        const nextWorkspaces = workspacesResult.status === 'fulfilled'
          ? (workspacesResult.value.data || [])
          : [];
        const nextUser = userResult.status === 'fulfilled'
          ? (userResult.value.data || null)
          : null;

        if (workspacesResult.status === 'rejected') {
          console.error('Failed to fetch workspaces:', workspacesResult.reason);
        }

        if (userResult.status === 'rejected') {
          console.error('Failed to fetch user settings:', userResult.reason);
        }

        setWorkspaces(nextWorkspaces);
        setUser(nextUser);

        const preferredWorkspaceId = Number(nextUser?.last_workspace_id);
        const preferredWorkspace = nextWorkspaces.find((workspace) => Number(workspace.id) === preferredWorkspaceId);
        setCurrentWorkspace(preferredWorkspace || nextWorkspaces[0] || null);
      } catch (error) {
        console.error('Failed to fetch initial app data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Real-time notifications hook
  const {
    notifications,
    unreadCount,
    newNotification,
    fetchNotifications,
    clearNewNotification,
  } = useNotifications(currentWorkspace?.id);

  // Handle notification toast click - navigate to relevant page
  const handleNotificationToastClick = (notification) => {
    const type = notification.type?.toLowerCase() || '';
    
    if (notification.action_url) {
      const url = notification.action_url;
      if (url.startsWith('/tasks/')) {
        handleNavigate('tasks', { projectId: notification.project_id, taskId: parseInt(url.split('/tasks/')[1]) });
      } else if (url.startsWith('/approvals')) {
        handleNavigate('approvals', { projectId: notification.project_id });
      } else if (url.startsWith('/chat/')) {
        handleNavigate('chat', { threadId: parseInt(url.split('/chat/')[1]) });
      } else if (url.startsWith('/projects/')) {
        handleNavigate('projects', { projectId: parseInt(url.split('/projects/')[1]) });
      } else if (url.startsWith('/clients/')) {
        handleNavigate('clients', { clientId: parseInt(url.split('/clients/')[1]) });
      } else if (url.startsWith('/support/')) {
        handleNavigate('support', { ticketId: parseInt(url.split('/support/')[1], 10) });
      }
    } else if (type.includes('approval')) {
      handleNavigate('approvals', { projectId: notification.project_id });
    } else if (type.includes('task') || notification.task_id) {
      handleNavigate('tasks', { projectId: notification.project_id, taskId: notification.task_id });
    } else if (type.includes('chat') || notification.chat_thread_id) {
      handleNavigate('chat', { threadId: notification.chat_thread_id });
    }
  };

  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;
      if (!state || state.appView !== 'main-layout') return;

      setCurrentPage(state.page || 'dashboard');
      setSelectedProject(state.selectedProject || null);
      setSelectedTask(state.selectedTask || null);
      setNavigationState(state.navigationState || null);
      setMobileSidebarOpen(false);
      setMobileMoreOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (loading) return;
    const currentState = window.history.state;
    if (currentState?.appView === 'main-layout') return;
    window.history.replaceState(buildHistoryState(), document.title);
  }, [loading, buildHistoryState]);

  const handleNavigate = (page, options = null) => {
    if (isMobile && page === 'more') {
      setMobileMoreOpen(true);
      return;
    }
    const nextNavigationState = options ? { page, ...options } : null;
    setCurrentPage(page);
    setSelectedProject(null);
    setSelectedTask(null);
    setNavigationState(nextNavigationState);
    setMobileSidebarOpen(false);
    setMobileMoreOpen(false);
    window.history.pushState(
      buildHistoryState({
        page,
        selectedProject: null,
        selectedTask: null,
        navigationState: nextNavigationState,
      }),
      document.title
    );
  };

  const handleWorkspaceChange = (workspace) => {
    setCurrentWorkspace(workspace);
    setUser((prev) => (prev ? { ...prev, last_workspace_id: workspace.id } : prev));
    // Reset project and task selections when workspace changes
    setSelectedProject(null);
    setSelectedTask(null);
    setNavigationState(null);
    setMobileSidebarOpen(false);
    setMobileMoreOpen(false);
    window.history.replaceState(
      buildHistoryState({
        page: currentPage,
        selectedProject: null,
        selectedTask: null,
        navigationState: null,
      }),
      document.title
    );

    patchUserAppPreferences({ last_workspace_id: workspace.id }).catch((error) => {
      console.error('Failed to persist workspace preference:', error);
    });
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
    window.history.pushState(
      buildHistoryState({
        selectedProject: project,
        selectedTask: null,
      }),
      document.title
    );
  };

  const handleSelectTask = (task) => {
    setSelectedTask(task);
    window.history.pushState(
      buildHistoryState({
        selectedTask: task,
      }),
      document.title
    );
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (selectedTask) {
      setSelectedTask(null);
    } else if (selectedProject) {
      setSelectedProject(null);
    }
  };

  const isPersonalWorkspace = Boolean(currentWorkspace?.is_personal)
    || (currentWorkspace?.name === 'Personal' && Number(currentWorkspace?.created_by) === Number(user?.id));
  const canViewTeam = !isPersonalWorkspace && (currentWorkspace?.role === 'Owner' || currentWorkspace?.role === 'Admin');
  const canViewClients = !isPersonalWorkspace;
  const canViewApprovals = !isPersonalWorkspace;
  const canViewAdmin = !isPersonalWorkspace && (currentWorkspace?.role === 'Owner' || currentWorkspace?.role === 'Admin');

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            user={user}
            workspace={currentWorkspace}
            onNavigate={handleNavigate}
          />
        );
      
      case 'projects':
        if (selectedProject) {
          return (
            <ProjectDetail
              project={selectedProject}
              workspace={currentWorkspace}
              onBack={handleBack}
              onSelectTask={handleSelectTask}
              user={user}
            />
          );
        }
        return (
          <ProjectList
            onSelectProject={handleSelectProject}
            workspace={currentWorkspace}
            user={user}
          />
        );
      
      case 'recurring':
        return (
          <RecurringPage
            workspace={currentWorkspace}
            user={user}
          />
        );
      
      case 'tasks': {
        const pageNavigation = navigationState?.page === 'tasks' ? navigationState : null;
        return (
          <TasksPage
            workspace={currentWorkspace}
            user={user}
            navigationState={pageNavigation}
            onNavigationConsumed={() => setNavigationState(null)}
          />
        );
      }
      case 'team':
        if (!currentWorkspace || !canViewTeam) {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">
                {isPersonalWorkspace
                  ? 'Team management is not available for personal workspaces.'
                  : 'The Team page is only available to workspace Owners and Admins.'}
              </Typography>
            </Box>
          );
        }

        return <TeamPage user={user} workspace={currentWorkspace} />;
      
      case 'approvals':
        if (!currentWorkspace || !canViewApprovals) {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">
                Approvals are not available for personal workspaces.
              </Typography>
            </Box>
          );
        }
        return <ApprovalsPage user={user} workspace={currentWorkspace} />;
      
      case 'activity':
        return <ActivityLogPage workspace={currentWorkspace} />;
      
      case 'notifications':
        return (
          <NotificationsPage 
            onNavigate={handleNavigate}
            notifications={notifications}
            onRefresh={fetchNotifications}
          />
        );
      
      case 'admin':
        if (!currentWorkspace || !canViewAdmin) {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">
                {isPersonalWorkspace
                  ? 'Admin tools are not available for personal workspaces.'
                  : 'The Admin page is only available to workspace Owners and Admins.'}
              </Typography>
            </Box>
          );
        }
        return <AdminPage workspace={currentWorkspace} user={user} />;

      case 'clients':
        if (!currentWorkspace || !canViewClients) {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">
                {isPersonalWorkspace
                  ? 'Clients are not available for personal workspaces.'
                  : 'The Clients page is only available to workspace Owners and Admins.'}
              </Typography>
            </Box>
          );
        }
        return <ClientsPage workspace={currentWorkspace} />;

      case 'services':
        if (!currentWorkspace || isPersonalWorkspace) {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">
                Services are not available for personal workspaces.
              </Typography>
            </Box>
          );
        }
        return <ServicesPage workspace={currentWorkspace} />;

      case 'operations':
        if (!currentWorkspace || isPersonalWorkspace) {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">
                Operations tools are not available for personal workspaces.
              </Typography>
            </Box>
          );
        }
        return <OperationsPage workspace={currentWorkspace} user={user} />;

      case 'support': {
        if (!currentWorkspace || isPersonalWorkspace) {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">
                Support is not available for personal workspaces.
              </Typography>
            </Box>
          );
        }
        const pageNavigation = navigationState?.page === 'support' ? navigationState : null;
        return (
          <SupportPage
            workspace={currentWorkspace}
            user={user}
            navigationState={pageNavigation}
            onNavigationConsumed={() => setNavigationState(null)}
          />
        );
      }
      
      case 'chat':
        return <ChatPage workspace={currentWorkspace} user={user} />;
      
      case 'checklist':
        if (!currentWorkspace || isPersonalWorkspace) {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">
                Checklist is not available for personal workspaces.
              </Typography>
            </Box>
          );
        }
        return <ChecklistPage workspace={currentWorkspace} user={user} />;
      
      case 'settings':
        return (
          <SettingsPage
            user={user}
            workspace={currentWorkspace}
            themePreference={themePreference}
            onThemePreferenceChange={onThemePreferenceChange}
          />
        );
      
      default:
        return (
          <Dashboard
            user={user}
            workspace={currentWorkspace}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!currentWorkspace) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <p>No workspaces found. Please create one.</p>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: isMobile
          ? (theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, #0b1220 0%, #111827 100%)'
            : 'linear-gradient(180deg, #f8fbfd 0%, #edf4f8 100%)')
          : (theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc'),
      }}
    >
      {isMobile ? (
        <MobileTopBar
          user={user}
          currentPage={currentPage}
          currentWorkspace={currentWorkspace}
          workspaces={workspaces}
          onWorkspaceChange={handleWorkspaceChange}
          unreadNotificationCount={unreadCount}
          onNotificationsClick={() => handleNavigate('notifications')}
        />
      ) : (
        <TopAppBar
          user={user}
          currentWorkspace={currentWorkspace}
          workspaces={workspaces}
          onWorkspaceChange={handleWorkspaceChange}
          onLogout={onLogout}
          currentPage={currentPage}
          selectedProject={selectedProject}
          onNavigate={handleNavigate}
          unreadNotificationCount={unreadCount}
          onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          isMobileSidebarOpen={mobileSidebarOpen}
        />
      )}

      {!isMobile && (
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={onLogout}
          user={user}
          workspace={currentWorkspace}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          marginLeft: 0,
          marginTop: isMobile
            ? `calc(${MOBILE_TOPBAR_HEIGHT}px + var(--safe-area-top, 0px))`
            : 'calc(64px + var(--safe-area-top, 0px))',
          height: isMobile
            ? `calc(100dvh - ${MOBILE_TOPBAR_HEIGHT}px - var(--safe-area-top, 0px))`
            : 'calc(100vh - 64px - var(--safe-area-top, 0px))',
          backgroundColor: 'transparent',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            height: '100%',
            overflow: 'auto',
            px: isMobile ? 1.25 : 0,
            pt: isMobile ? 1 : 0,
            pb: isMobile
              ? `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 28px)`
              : 0,
          }}
        >
          {renderContent()}
        </Box>
      </Box>

      {isMobile && (
        <>
          <MobileBottomNav
            currentPage={currentPage}
            onNavigate={handleNavigate}
            canViewChat={!isPersonalWorkspace}
          />
          <MobileMoreSheet
            open={mobileMoreOpen}
            onClose={() => setMobileMoreOpen(false)}
            onNavigate={handleNavigate}
            onLogout={onLogout}
            currentPage={currentPage}
            isPersonalWorkspace={isPersonalWorkspace}
            canViewClients={canViewClients}
            canViewTeam={canViewTeam}
            canViewApprovals={canViewApprovals}
            canViewAdmin={canViewAdmin}
            canViewSupport={!isPersonalWorkspace}
            currentWorkspace={currentWorkspace}
          />
        </>
      )}

      {/* Real-time notification toast */}
      <NotificationToast
        notification={newNotification}
        onClose={clearNewNotification}
        onClick={handleNotificationToastClick}
        autoHideDuration={4000}
      />
    </Box>
  );
}

export default MainLayout;
