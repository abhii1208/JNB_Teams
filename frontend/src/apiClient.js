import axios from 'axios';

export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('authToken');
  return token || null;
};

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('rememberedUserId');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;

// Workspaces API
export const getWorkspaces = () => api.get('/api/workspaces');
export const createWorkspace = (name) => api.post('/api/workspaces', { name });
export const getWorkspaceMembers = (workspaceId) => api.get(`/api/workspaces/${workspaceId}/members`);
export const addWorkspaceMember = (workspaceId, email, role = 'Member') => 
  api.post(`/api/workspaces/${workspaceId}/members`, { email, role });
export const updateWorkspaceMember = (workspaceId, userId, role) =>
  api.put(`/api/workspaces/${workspaceId}/members/${userId}`, { role });
export const removeWorkspaceMember = (workspaceId, userId) =>
  api.delete(`/api/workspaces/${workspaceId}/members/${userId}`);

// Projects API
export const getProjects = (workspaceId, includeArchived = false) => 
  api.get(`/api/projects/workspace/${workspaceId}`, { params: includeArchived ? { include_archived: 'true' } : {} });
export const createProject = (projectData) => api.post('/api/projects', projectData);
export const updateProject = (projectId, projectData) => api.put(`/api/projects/${projectId}`, projectData);
export const archiveProject = (projectId) => api.put(`/api/projects/${projectId}/archive`);
export const unarchiveProject = (projectId) => api.put(`/api/projects/${projectId}/unarchive`);
export const updateProjectAccess = (projectId) => api.put(`/api/projects/${projectId}/access`);
export const getProjectMembers = (projectId) => api.get(`/api/projects/${projectId}/members`);
export const addProjectMember = (projectId, { user_id, email, role = 'Member' }) =>
  api.post(`/api/projects/${projectId}/members`, { user_id, email, role });
export const updateProjectMember = (projectId, userId, role) =>
  api.put(`/api/projects/${projectId}/members/${userId}`, { role });
export const removeProjectMember = (projectId, userId) =>
  api.delete(`/api/projects/${projectId}/members/${userId}`);

// Tasks API
export const getTasks = (projectId, includeArchived = false) => 
  api.get(`/api/tasks/project/${projectId}`, { params: includeArchived ? { include_archived: 'true' } : {} });
export const createTask = (taskData) => api.post('/api/tasks', taskData);
export const updateTask = (taskId, taskData) => api.put(`/api/tasks/${taskId}`, taskData);
export const deleteTask = (taskId) => api.delete(`/api/tasks/${taskId}`);
export const archiveTask = (taskId) => api.put(`/api/tasks/${taskId}/archive`, { archive: true });
export const unarchiveTask = (taskId) => api.put(`/api/tasks/${taskId}/archive`, { archive: false });
export const addTaskCollaborator = (taskId, userId) => 
  api.post(`/api/tasks/${taskId}/collaborators`, { user_id: userId });

// Approvals API
export const getApprovals = (filters = {}) => api.get('/api/approvals', { params: filters });
export const getApprovalCount = (workspaceId) => 
  api.get('/api/approvals/count', { params: workspaceId ? { workspace_id: workspaceId } : {} });
export const approveApproval = (approvalId) => api.put(`/api/approvals/${approvalId}/approve`);
export const rejectApproval = (approvalId, reason) => 
  api.put(`/api/approvals/${approvalId}/reject`, { reject_reason: reason });

// Activity API
export const getActivity = (filters = {}) => api.get('/api/activity', { params: filters });

// Notifications API
export const getNotifications = (read) => 
  api.get('/api/notifications', { params: read !== undefined ? { read } : {} });
export const getNotificationCount = () => api.get('/api/notifications/count');
export const markNotificationAsRead = (notificationId) => 
  api.put(`/api/notifications/${notificationId}/read`);
export const markAllNotificationsAsRead = () => api.put('/api/notifications/read-all');
export const deleteNotification = (notificationId) => 
  api.delete(`/api/notifications/${notificationId}`);

// User Settings API
export const getUserSettings = () => api.get('/api/user/settings');
export const updateUserProfile = (profileData) => api.put('/api/user/profile', profileData);
export const changePassword = (currentPassword, newPassword) => 
  api.put('/api/user/password', { current_password: currentPassword, new_password: newPassword });

// Workspace Tasks API (cross-project)
export const getWorkspaceTasks = (workspaceId, params = {}) => 
  api.get(`/api/tasks/workspace/${workspaceId}`, { params });
export const getCalendarTasks = (workspaceId, params = {}) => 
  api.get(`/api/tasks/workspace/${workspaceId}/calendar`, { params });
export const bulkUpdateTasks = (taskIds, updates) => 
  api.put('/api/tasks/bulk', { task_ids: taskIds, updates });

// Workspace Projects (for TasksPage project filter)
export const getWorkspaceProjects = (workspaceId) => 
  api.get(`/api/projects/workspace/${workspaceId}`);

// Saved Views API
export const getSavedViews = (workspaceId) => 
  api.get(`/api/views/workspace/${workspaceId}`);
export const createSavedView = (workspaceId, viewData) => 
  api.post(`/api/views/workspace/${workspaceId}`, viewData);
export const updateSavedView = (viewId, viewData) => 
  api.put(`/api/views/${viewId}`, viewData);
export const deleteSavedView = (viewId) => 
  api.delete(`/api/views/${viewId}`);
export const getUserViewPreferences = (workspaceId) => 
  api.get(`/api/views/workspace/${workspaceId}/preferences`);
export const updateUserViewPreferences = (workspaceId, preferences) => 
  api.put(`/api/views/workspace/${workspaceId}/preferences`, preferences);

// User Preferences API (enhanced)
export const getFullUserPreferences = (workspaceId) => 
  api.get(`/api/user-preferences/workspace/${workspaceId}`);
export const updateFullUserPreferences = (workspaceId, preferences) => 
  api.put(`/api/user-preferences/workspace/${workspaceId}`, preferences);
export const patchUserPreferences = (workspaceId, partialPreferences) => 
  api.patch(`/api/user-preferences/workspace/${workspaceId}`, partialPreferences);
export const resetUserPreferences = (workspaceId) => 
  api.delete(`/api/user-preferences/workspace/${workspaceId}`);

// Project Column Options API (Category & Section management)
export const getProjectColumnOptions = (projectId, columnType) => 
  api.get(`/api/project-columns/${projectId}/column-options`, { params: columnType ? { column_name: columnType } : {} });
export const createProjectColumnOption = (projectId, optionData) => 
  api.post(`/api/project-columns/${projectId}/column-options`, optionData);
export const updateProjectColumnOption = (projectId, optionId, optionData) => 
  api.put(`/api/project-columns/${projectId}/column-options/${optionId}`, optionData);
export const deleteProjectColumnOption = (projectId, optionId) => 
  api.delete(`/api/project-columns/${projectId}/column-options/${optionId}`);
export const bulkCreateColumnOptions = (projectId, options) => 
  api.post(`/api/project-columns/${projectId}/column-options/bulk`, { options });
export const copyColumnOptionsFromProject = (projectId, sourceProjectId, columnTypes, strategy = 'merge') => 
  api.post(`/api/project-columns/${projectId}/column-options/copy`, { 
    source_project_id: sourceProjectId, 
    column_types: columnTypes, 
    strategy 
  });
export const getCopyableProjects = (projectId) => 
  api.get(`/api/project-columns/${projectId}/column-options/copyable-projects`);
export const getProjectColumnSettings = (projectId) => 
  api.get(`/api/project-columns/${projectId}/column-settings`);
export const updateProjectColumnSettings = (projectId, settings) => 
  api.put(`/api/project-columns/${projectId}/column-settings`, settings);

// Admin API
export const getAdminProjects = (workspaceId, params = {}) => 
  api.get(`/api/admin/${workspaceId}/projects`, { params });
export const getAdminProjectTeamMetrics = (workspaceId, projectId, params = {}) => 
  api.get(`/api/admin/${workspaceId}/projects/${projectId}/team-metrics`, { params });
export const getAdminTeam = (workspaceId, params = {}) => 
  api.get(`/api/admin/${workspaceId}/team`, { params });
export const getAdminMemberDetails = (workspaceId, userId, params = {}) => 
  api.get(`/api/admin/${workspaceId}/team/${userId}/details`, { params });
export const getAdminProjectTasks = (workspaceId, projectId, params = {}) => 
  api.get(`/api/admin/${workspaceId}/projects/${projectId}/tasks`, { params });
