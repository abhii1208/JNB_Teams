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
export const getTasks = (projectId) => api.get(`/api/tasks/project/${projectId}`);
export const createTask = (taskData) => api.post('/api/tasks', taskData);
export const updateTask = (taskId, taskData) => api.put(`/api/tasks/${taskId}`, taskData);
export const deleteTask = (taskId) => api.delete(`/api/tasks/${taskId}`);
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