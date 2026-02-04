import axios from 'axios';

export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

const publicApi = axios.create({
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
export const updateWorkspace = (workspaceId, payload) =>
  api.patch(`/api/workspaces/${workspaceId}`, payload);

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

// Clients API
export const getClients = (workspaceId, params = {}) =>
  api.get(`/api/clients/workspace/${workspaceId}`, { params });
export const getClientDetails = (clientId) =>
  api.get(`/api/clients/${clientId}`);
export const createClient = (clientData) =>
  api.post('/api/clients', clientData);
export const updateClient = (clientId, clientData) =>
  api.put(`/api/clients/${clientId}`, clientData);
export const deactivateClient = (clientId) =>
  api.delete(`/api/clients/${clientId}`);

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
export const approveApproval = (approvalId, notes) => 
  api.put(`/api/approvals/${approvalId}/approve`, { notes });
export const rejectApproval = (approvalId, reason) => 
  api.put(`/api/approvals/${approvalId}/reject`, { reject_reason: reason });

// Approval Audit Trail
export const getApprovalAuditTrail = (approvalId) => 
  api.get(`/api/approvals/${approvalId}/audit`);

// Multiple Approvers Management
export const getProjectApprovers = (projectId) => 
  api.get(`/api/approvals/project/${projectId}/approvers`);
export const addProjectApprover = (projectId, userId, priority = 1) => 
  api.post(`/api/approvals/project/${projectId}/approvers`, { user_id: userId, priority });
export const removeProjectApprover = (projectId, userId) => 
  api.delete(`/api/approvals/project/${projectId}/approvers/${userId}`);

// Escalation Settings
export const getEscalationSettings = (projectId) => 
  api.get(`/api/approvals/project/${projectId}/escalation`);
export const updateEscalationSettings = (projectId, settings) => 
  api.put(`/api/approvals/project/${projectId}/escalation`, settings);

// Approval Comments
export const getApprovalComments = (approvalId) => 
  api.get(`/api/approvals/${approvalId}/comments`);
export const addApprovalComment = (approvalId, comment) => 
  api.post(`/api/approvals/${approvalId}/comments`, { comment });

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

// Share Links API (authenticated)
export const createShareLink = (payload) => api.post('/api/share-links', payload);
export const listShareLinks = (workspaceId, params = {}) =>
  api.get('/api/share-links', { params: { workspaceId, ...params } });
export const revokeShareLink = (linkId) => api.delete(`/api/share-links/${linkId}`);
export const updateShareLink = (linkId, payload) => api.patch(`/api/share-links/${linkId}`, payload);

// Share Links API (public)
export const getPublicShareMeta = (slug) => publicApi.get(`/public/share/${slug}/meta`);
export const unlockPublicShare = (slug, password) =>
  publicApi.post(`/public/share/${slug}/unlock`, { password });
export const getPublicShareTasks = (slug, token) =>
  publicApi.get(`/public/share/${slug}/tasks`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});

// =====================================================
// CHAT API
// =====================================================

// Threads
export const getChatThreads = (workspaceId) =>
  api.get(`/api/chat/${workspaceId}/threads`);
export const getChatThread = (workspaceId, threadId) =>
  api.get(`/api/chat/${workspaceId}/threads/${threadId}`);
export const createDmThread = (workspaceId, userId) =>
  api.post(`/api/chat/${workspaceId}/threads/dm`, { user_id: userId });
export const createGroupThread = (workspaceId, name, memberIds) =>
  api.post(`/api/chat/${workspaceId}/threads/group`, { name, member_ids: memberIds });
export const updateChatThread = (workspaceId, threadId, data) =>
  api.patch(`/api/chat/${workspaceId}/threads/${threadId}`, data);

// Thread Members
export const addThreadMembers = (workspaceId, threadId, userIds) =>
  api.post(`/api/chat/${workspaceId}/threads/${threadId}/members`, { user_ids: userIds });
export const removeThreadMember = (workspaceId, threadId, userId) =>
  api.delete(`/api/chat/${workspaceId}/threads/${threadId}/members/${userId}`);

// Messages
export const getChatMessages = (workspaceId, threadId, params = {}) =>
  api.get(`/api/chat/${workspaceId}/threads/${threadId}/messages`, { params });
export const sendChatMessage = (workspaceId, threadId, content, attachmentIds = []) =>
  api.post(`/api/chat/${workspaceId}/threads/${threadId}/messages`, { content, attachmentIds });

// Read Tracking
export const markThreadRead = (workspaceId, threadId, messageId = null) =>
  api.put(`/api/chat/${workspaceId}/threads/${threadId}/read`, { message_id: messageId });
export const getChatUnreadCount = (workspaceId) =>
  api.get(`/api/chat/${workspaceId}/unread-count`);

// Search & Mentions
export const searchChatThreads = (workspaceId, query) =>
  api.get(`/api/chat/${workspaceId}/search`, { params: { q: query } });
export const getChatMentionables = (workspaceId, params = {}) =>
  api.get(`/api/chat/${workspaceId}/mentionables`, { params });

// =====================================================
// ATTACHMENTS API
// =====================================================

export const uploadAttachments = (formData) =>
  api.post('/api/attachments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getAttachments = (entityType, entityId) =>
  api.get(`/api/attachments/${entityType}/${entityId}`);

export const downloadAttachment = (attachmentId) =>
  api.get(`/api/attachments/download/${attachmentId}`, { responseType: 'blob' });

export const deleteAttachment = (attachmentId) =>
  api.delete(`/api/attachments/${attachmentId}`);

// =====================================================
// PROJECT OWNERSHIP TRANSFER API
// =====================================================

export const transferProjectOwnership = (projectId, newOwnerId, reason) =>
  api.post(`/api/projects/${projectId}/transfer-ownership`, { 
    new_owner_id: newOwnerId, 
    reason 
  });

export const getProjectTransferHistory = (projectId) =>
  api.get(`/api/projects/${projectId}/transfer-history`);

// =====================================================
// CHECKLIST API (Monthly Client Checklist)
// =====================================================

// Checklist Items
export const getChecklistItems = (workspaceId, filters = {}) =>
  api.get(`/api/checklist/workspace/${workspaceId}/items`, { params: filters });

export const getClientChecklistItems = (clientId, filters = {}) =>
  api.get(`/api/checklist/client/${clientId}/items`, { params: filters });

export const getChecklistItem = (itemId) =>
  api.get(`/api/checklist/items/${itemId}`);

export const createChecklistItem = (workspaceId, data) =>
  api.post(`/api/checklist/workspace/${workspaceId}/items`, data);

export const updateChecklistItem = (itemId, data) =>
  api.put(`/api/checklist/items/${itemId}`, data);

export const updateChecklistAssignments = (itemId, assigneeIds, effectiveFrom) =>
  api.put(`/api/checklist/items/${itemId}/assignments`, { assigneeIds, effectiveFrom });

// Client Holidays
export const getClientHolidays = (clientId, year = null) =>
  api.get(`/api/checklist/client/${clientId}/holidays`, { params: { year } });

export const addClientHoliday = (clientId, data) =>
  api.post(`/api/checklist/client/${clientId}/holidays`, data);

export const deleteClientHoliday = (clientId, holidayDate) =>
  api.delete(`/api/checklist/client/${clientId}/holidays/${holidayDate}`);

export const copyClientHolidays = (clientId, sourceClientId, year) =>
  api.post(`/api/checklist/client/${clientId}/holidays/copy`, { sourceClientId, year });

// Occurrences & Grid
export const getChecklistGrid = (workspaceId, clientId, year, month, filters = {}) =>
  api.get(`/api/checklist/workspace/${workspaceId}/grid`, { 
    params: { clientId, year, month, ...filters } 
  });

export const getTodaysChecklistItems = (workspaceId, clientId = null) =>
  api.get(`/api/checklist/workspace/${workspaceId}/today`, { params: { clientId } });

export const getChecklistOccurrence = (occurrenceId) =>
  api.get(`/api/checklist/occurrences/${occurrenceId}`);

// Confirmations
export const confirmChecklistOccurrence = (occurrenceId, remarks = null) =>
  api.post(`/api/checklist/occurrences/${occurrenceId}/confirm`, { remarks });

export const lateConfirmChecklistOccurrence = (occurrenceId, userId, reason) =>
  api.post(`/api/checklist/occurrences/${occurrenceId}/late-confirm`, { userId, reason });

// Reports
export const getChecklistSummaryReport = (workspaceId, filters = {}) =>
  api.get(`/api/checklist/workspace/${workspaceId}/reports/summary`, { params: filters });

export const getChecklistDetailedReport = (workspaceId, filters = {}) =>
  api.get(`/api/checklist/workspace/${workspaceId}/reports/detailed`, { params: filters });

export const getChecklistPerformanceReport = (workspaceId, year, month) =>
  api.get(`/api/checklist/workspace/${workspaceId}/reports/performance`, { params: { year, month } });

export const exportChecklistCSV = (workspaceId, filters = {}) =>
  api.get(`/api/checklist/workspace/${workspaceId}/reports/export/csv`, { 
    params: filters,
    responseType: 'blob'
  });

export const exportChecklistPDF = (workspaceId, filters = {}) =>
  api.get(`/api/checklist/workspace/${workspaceId}/reports/export/pdf`, { 
    params: filters,
    responseType: 'blob'
  });

// Categories
export const getChecklistCategories = (workspaceId) =>
  api.get(`/api/checklist/workspace/${workspaceId}/categories`);

export const createChecklistCategory = (workspaceId, data) =>
  api.post(`/api/checklist/workspace/${workspaceId}/categories`, data);

// Client Settings
export const getClientChecklistSettings = (clientId) =>
  api.get(`/api/checklist/client/${clientId}/settings`);

export const updateClientChecklistSettings = (clientId, data) =>
  api.put(`/api/checklist/client/${clientId}/settings`, data);

// Workspace Settings
export const getWorkspaceChecklistSettings = (workspaceId) =>
  api.get(`/api/checklist/workspace/${workspaceId}/settings`);

export const updateWorkspaceChecklistSettings = (workspaceId, data) =>
  api.put(`/api/checklist/workspace/${workspaceId}/settings`, data);

// Checklist Item Delete
export const deleteChecklistItem = (itemId) =>
  api.delete(`/api/checklist/items/${itemId}`);

// User Performance Report
export const getChecklistUserPerformance = (workspaceId, filters = {}) =>
  api.get(`/api/checklist/workspace/${workspaceId}/reports/user-performance`, { params: filters });

// Delete Client Holiday by ID
export const deleteClientHolidayById = (holidayId) =>
  api.delete(`/api/checklist/holidays/${holidayId}`);

// Client User Assignments
export const getClientAssignments = (workspaceId) =>
  api.get(`/api/checklist/workspace/${workspaceId}/client-assignments`);

export const getClientUserAssignments = (clientId) =>
  api.get(`/api/checklist/client/${clientId}/assignments`);

export const getUserAssignedClients = (workspaceId, userId) =>
  api.get(`/api/checklist/workspace/${workspaceId}/user/${userId}/assigned-clients`);

export const assignUserToClient = (clientId, userId, notes = null) =>
  api.post(`/api/checklist/client/${clientId}/assignments`, { userId, notes });

export const removeUserFromClient = (clientId, userId) =>
  api.delete(`/api/checklist/client/${clientId}/assignments/${userId}`);

export const bulkAssignUsersToClient = (clientId, userIds) =>
  api.post(`/api/checklist/client/${clientId}/assignments/bulk`, { userIds });

// ============================================
// Global Search API
// ============================================
export const globalSearch = (workspaceId, query, options = {}) =>
  api.get('/api/search', { 
    params: { 
      workspaceId, 
      q: query, 
      types: options.types?.join(','),
      limit: options.limit || 10
    } 
  });

export const getRecentItems = (workspaceId) =>
  api.get('/api/search/recent', { params: { workspaceId } });
