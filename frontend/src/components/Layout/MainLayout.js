import React, { useState, useEffect } from 'react';
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
import RecurringPage from '../Recurring/RecurringPage';
import TasksPage from '../Tasks/TasksPage';
import { getWorkspaces, getUserSettings } from '../../apiClient';

const DRAWER_WIDTH = 260;

function MainLayout({ userId, onLogout }) {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleNavigate = (page) => {
    setCurrentPage(page);
    setSelectedProject(null);
    setSelectedTask(null);
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
          />
        );
      
      case 'recurring':
        return (
          <RecurringPage
            workspace={currentWorkspace}
            user={user}
          />
        );
      
      case 'tasks':
        return (
          <TasksPage
            workspace={currentWorkspace}
            user={user}
          />
        );
      
      case 'team':
        // Team page visible only to licensed_admin users
        if (!user || user.license_type !== 'licensed_admin') {
          return (
            <Box sx={{ p: 6 }}>
              <Typography variant="h6">Access restricted</Typography>
              <Typography variant="body2" color="text.secondary">The Team page is only available to licensed administrators.</Typography>
            </Box>
          );
        }

        return <TeamPage user={user} workspace={currentWorkspace} />;
      
      case 'approvals':
        return <ApprovalsPage user={user} workspace={currentWorkspace} />;
      
      case 'activity':
        return <ActivityLogPage workspace={currentWorkspace} />;
      
      case 'notifications':
        return <NotificationsPage />;
      
      case 'settings':
        return <SettingsPage user={user} />;
      
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
    </Box>
  );
}

export default MainLayout;
