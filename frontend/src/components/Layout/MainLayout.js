import React, { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import Sidebar from './Sidebar';
import TopAppBar from './TopAppBar';
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
import RecurringPage from '../Recurring/RecurringPage';
import TasksPage from '../Tasks/TasksPage';
import AdminPage from '../Admin/AdminPage';
import ClientsPage from '../Clients/ClientsPage';
import ChatPage from '../Chat/ChatPage';
import { ChecklistPage } from '../Checklist';
import { getWorkspaces, getUserSettings } from '../../apiClient';

function MainLayout({ userId, onLogout }) {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [navigationState, setNavigationState] = useState(null);

  // Fetch workspaces on mount
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setLoading(true);
        const response = await getWorkspaces();
        setWorkspaces(response.data);
        
        // Load saved workspace or use first one
        const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
        const savedWorkspace = response.data.find(w => w.id === parseInt(savedWorkspaceId));
        setCurrentWorkspace(savedWorkspace || response.data[0] || null);
      } catch (error) {
        console.error('Failed to fetch workspaces:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkspaces();
  }, []);

  const [user, setUser] = useState(null);

  // Real-time notifications hook
  const {
    notifications,
    unreadCount,
    newNotification,
    fetchNotifications,
    clearNewNotification,
  } = useNotifications(currentWorkspace?.id);

  // Handle notification toast click - navigate to relevant page
  const handleNotificationToastClick = useCallback((notification) => {
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
      }
    } else if (type.includes('approval')) {
      handleNavigate('approvals', { projectId: notification.project_id });
    } else if (type.includes('task') || notification.task_id) {
      handleNavigate('tasks', { projectId: notification.project_id, taskId: notification.task_id });
    } else if (type.includes('chat') || notification.chat_thread_id) {
      handleNavigate('chat', { threadId: notification.chat_thread_id });
    }
  }, []);

  // Fetch current user settings
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await getUserSettings();
        setUser(res.data);
      } catch (err) {
        console.error('Failed to fetch user settings:', err);
      }
    };

    fetchUser();
  }, []);

  const handleNavigate = (page, options = null) => {
    setCurrentPage(page);
    setSelectedProject(null);
    setSelectedTask(null);
    setNavigationState(options ? { page, ...options } : null);
  };

  const handleWorkspaceChange = (workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspaceId', workspace.id);
    // Reset project and task selections when workspace changes
    setSelectedProject(null);
    setSelectedTask(null);
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
  };

  const handleSelectTask = (task) => {
    setSelectedTask(task);
  };

  const handleBack = () => {
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
        return <SettingsPage user={user} workspace={currentWorkspace} />;
      
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
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
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
      />
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        user={user}
        workspace={currentWorkspace}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginLeft: 0,
          marginTop: '64px',
          height: 'calc(100vh - 64px)',
          backgroundColor: '#f8fafc',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ height: '100%', overflow: 'auto' }}>
          {renderContent()}
        </Box>
      </Box>

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
