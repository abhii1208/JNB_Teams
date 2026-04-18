/**
 * Notification Service
 * Centralized service for creating, managing, and broadcasting notifications
 * with dynamic URL generation and WebSocket integration
 */
const { pool } = require('../db');

const DEFAULT_NOTIFICATION_PREFERENCES = {
  task_assigned: true,
  task_created: true,
  task_unassigned: true,
  task_collaborator_added: true,
  task_due_date_changed: true,
  task_mentioned: true,
  task_attachment: true,
  task_comment: true,
  task_completed: true,
  task_liked: true,
  comment_liked: true,
  attachment_liked: true,
  chat_direct_message: true,
  chat_group_message: true,
  chat_mentioned: true,
  project_settings_changed: true,
  client_added: true,
  client_changed: true,
  approval_requested: true,
  approval_approved: true,
  approval_rejected: true,
  support_ticket_created: true,
  support_ticket_response: true,
  support_ticket_status_changed: true,
  in_app_enabled: true,
  push_enabled: true,
  email_enabled: true,
};

// Notification types with their metadata
const NOTIFICATION_TYPES = {
  // Task notifications
  TASK_CREATED: 'task_created',
  TASK_ASSIGNED: 'task_assigned',
  TASK_COLLABORATOR_ADDED: 'task_collaborator_added',
  TASK_UNASSIGNED: 'task_unassigned',
  TASK_DUE_CHANGED: 'task_due_changed',
  TASK_MENTIONED: 'task_mentioned',
  TASK_ATTACHMENT: 'task_attachment',
  TASK_COMMENT: 'task_comment',
  TASK_COMPLETED: 'task_completed',
  TASK_LIKED: 'task_liked',
  TASK_STATUS_CHANGED: 'task_status_changed',
  DEPENDENCY_CHANGED: 'dependency_changed',
  
  // Like notifications
  COMMENT_LIKED: 'comment_liked',
  ATTACHMENT_LIKED: 'attachment_liked',
  COMPLETION_LIKED: 'completion_liked',
  
  // Chat notifications
  CHAT_MESSAGE: 'chat_message',
  CHAT_GROUP_MESSAGE: 'chat_group_message',
  CHAT_MENTIONED: 'chat_mentioned',
  
  // Project notifications
  PROJECT_SETTINGS: 'project_settings',
  PROJECT_MEMBER_ADDED: 'project_member_added',
  PROJECT_MEMBER_REMOVED: 'project_member_removed',
  PROJECT_ROLE_CHANGED: 'project_role_changed',
  PROJECT_OWNERSHIP: 'ownership_transferred',
  
  // Client notifications
  CLIENT_ADDED: 'client_added',
  CLIENT_CHANGED: 'client_changed',
  CHECKLIST_UPDATED: 'checklist_updated',

  // Support notifications
  SUPPORT_TICKET_CREATED: 'support_ticket_created',
  SUPPORT_TICKET_RESPONSE: 'support_ticket_response',
  SUPPORT_TICKET_STATUS_CHANGED: 'support_ticket_status_changed',
  
  // Approval notifications
  APPROVAL_REQUESTED: 'approval_requested',
  APPROVAL_APPROVED: 'approval_approved',
  APPROVAL_REJECTED: 'approval_rejected',
};

// Store WebSocket broadcast function (will be set from chatWebSocket)
let wsBroadcastFn = null;

/**
 * Set the WebSocket broadcast function
 * Called from chatWebSocket.js initialization
 */
function setWebSocketBroadcast(broadcastFn) {
  wsBroadcastFn = broadcastFn;
}

/**
 * Generate dynamic action URL based on notification type and context
 */
function generateActionUrl({ type, workspaceId, projectId, taskId, chatThreadId, clientId, approvalId, supportTicketId }) {
  const base = ''; // Frontend routes are relative
  
  switch (type) {
    // Task URLs
    case NOTIFICATION_TYPES.TASK_CREATED:
    case NOTIFICATION_TYPES.TASK_ASSIGNED:
    case NOTIFICATION_TYPES.TASK_COLLABORATOR_ADDED:
    case NOTIFICATION_TYPES.TASK_UNASSIGNED:
    case NOTIFICATION_TYPES.TASK_DUE_CHANGED:
    case NOTIFICATION_TYPES.TASK_MENTIONED:
    case NOTIFICATION_TYPES.TASK_ATTACHMENT:
    case NOTIFICATION_TYPES.TASK_COMMENT:
    case NOTIFICATION_TYPES.TASK_COMPLETED:
    case NOTIFICATION_TYPES.TASK_LIKED:
    case NOTIFICATION_TYPES.TASK_STATUS_CHANGED:
    case NOTIFICATION_TYPES.DEPENDENCY_CHANGED:
    case NOTIFICATION_TYPES.COMMENT_LIKED:
    case NOTIFICATION_TYPES.ATTACHMENT_LIKED:
    case NOTIFICATION_TYPES.COMPLETION_LIKED:
      if (taskId && projectId) {
        return `/projects/${projectId}/tasks/${taskId}`;
      }
      if (taskId) {
        return `/tasks/${taskId}`;
      }
      return `/dashboard`;
    
    // Chat URLs
    case NOTIFICATION_TYPES.CHAT_MESSAGE:
    case NOTIFICATION_TYPES.CHAT_GROUP_MESSAGE:
    case NOTIFICATION_TYPES.CHAT_MENTIONED:
      if (chatThreadId) {
        return `/chat/${chatThreadId}`;
      }
      return `/chat`;
    
    // Project URLs
    case NOTIFICATION_TYPES.PROJECT_SETTINGS:
    case NOTIFICATION_TYPES.PROJECT_MEMBER_ADDED:
    case NOTIFICATION_TYPES.PROJECT_MEMBER_REMOVED:
    case NOTIFICATION_TYPES.PROJECT_ROLE_CHANGED:
    case NOTIFICATION_TYPES.PROJECT_OWNERSHIP:
      if (projectId) {
        return `/projects/${projectId}/settings`;
      }
      return `/projects`;
    
    // Client URLs
    case NOTIFICATION_TYPES.CLIENT_ADDED:
    case NOTIFICATION_TYPES.CLIENT_CHANGED:
      if (clientId) {
        return `/clients/${clientId}`;
      }
      return `/clients`;

    case NOTIFICATION_TYPES.CHECKLIST_UPDATED:
      return `/checklist`;

    case NOTIFICATION_TYPES.SUPPORT_TICKET_CREATED:
    case NOTIFICATION_TYPES.SUPPORT_TICKET_RESPONSE:
    case NOTIFICATION_TYPES.SUPPORT_TICKET_STATUS_CHANGED:
      if (supportTicketId) {
        return `/support/${supportTicketId}`;
      }
      return `/support`;
    
    // Approval URLs
    case NOTIFICATION_TYPES.APPROVAL_REQUESTED:
    case NOTIFICATION_TYPES.APPROVAL_APPROVED:
    case NOTIFICATION_TYPES.APPROVAL_REJECTED:
      return `/approvals`;
    
    default:
      return `/dashboard`;
  }
}

/**
 * Get user's notification preferences
 */
async function getUserPreferences(userId, workspaceId = null) {
  try {
    const query = workspaceId
      ? `SELECT * FROM notification_preferences WHERE user_id = $1 AND (workspace_id = $2 OR workspace_id IS NULL) ORDER BY workspace_id NULLS LAST LIMIT 1`
      : `SELECT * FROM notification_preferences WHERE user_id = $1 AND workspace_id IS NULL LIMIT 1`;
    
      const params = workspaceId ? [userId, workspaceId] : [userId];
      const result = await pool.query(query, params);
      
      // Return default preferences if none exist
      if (result.rows.length === 0) {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
      }
      
      return result.rows[0];
  } catch (err) {
    console.error('Error getting notification preferences:', err);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/**
 * Check if user should receive this notification type
 */
function shouldNotify(preferences, notificationType) {
  if (!preferences) return true;
  if (preferences.in_app_enabled === false) return false;
  
  const prefMap = {
    [NOTIFICATION_TYPES.TASK_CREATED]: 'task_created',
    [NOTIFICATION_TYPES.TASK_ASSIGNED]: 'task_assigned',
    [NOTIFICATION_TYPES.TASK_COLLABORATOR_ADDED]: 'task_collaborator_added',
    [NOTIFICATION_TYPES.TASK_UNASSIGNED]: 'task_unassigned',
    [NOTIFICATION_TYPES.TASK_DUE_CHANGED]: 'task_due_date_changed',
    [NOTIFICATION_TYPES.TASK_MENTIONED]: 'task_mentioned',
    [NOTIFICATION_TYPES.TASK_ATTACHMENT]: 'task_attachment',
    [NOTIFICATION_TYPES.TASK_COMMENT]: 'task_comment',
    [NOTIFICATION_TYPES.TASK_COMPLETED]: 'task_completed',
    [NOTIFICATION_TYPES.TASK_LIKED]: 'task_liked',
    [NOTIFICATION_TYPES.COMMENT_LIKED]: 'comment_liked',
    [NOTIFICATION_TYPES.ATTACHMENT_LIKED]: 'attachment_liked',
    [NOTIFICATION_TYPES.COMPLETION_LIKED]: 'task_liked',
    [NOTIFICATION_TYPES.CHAT_MESSAGE]: 'chat_direct_message',
    [NOTIFICATION_TYPES.CHAT_GROUP_MESSAGE]: 'chat_group_message',
    [NOTIFICATION_TYPES.CHAT_MENTIONED]: 'chat_mentioned',
    [NOTIFICATION_TYPES.PROJECT_SETTINGS]: 'project_settings_changed',
    [NOTIFICATION_TYPES.CLIENT_ADDED]: 'client_added',
    [NOTIFICATION_TYPES.CLIENT_CHANGED]: 'client_changed',
    [NOTIFICATION_TYPES.APPROVAL_REQUESTED]: 'approval_requested',
    [NOTIFICATION_TYPES.APPROVAL_APPROVED]: 'approval_approved',
    [NOTIFICATION_TYPES.APPROVAL_REJECTED]: 'approval_rejected',
    [NOTIFICATION_TYPES.SUPPORT_TICKET_CREATED]: 'support_ticket_created',
    [NOTIFICATION_TYPES.SUPPORT_TICKET_RESPONSE]: 'support_ticket_response',
    [NOTIFICATION_TYPES.SUPPORT_TICKET_STATUS_CHANGED]: 'support_ticket_status_changed',
  };
  
  const prefKey = prefMap[notificationType];
  return prefKey ? preferences[prefKey] !== false : true;
}

/**
 * Create a notification in the database and optionally broadcast via WebSocket
 */
async function createNotification({
  userId,
  type,
  title,
  message,
  workspaceId = null,
  projectId = null,
  taskId = null,
  chatThreadId = null,
  chatMessageId = null,
  clientId = null,
  supportTicketId = null,
  senderId = null,
  metadata = {},
  broadcast = true,
  }) {
    try {
    // Don't notify self
    if (senderId && userId === senderId) {
      return null;
    }

    // Check user preferences
    const preferences = await getUserPreferences(userId, workspaceId);
    if (!shouldNotify(preferences, type)) {
      return null;
    }

    // Generate action URL
    const actionUrl = generateActionUrl({
      type,
      workspaceId,
      projectId,
      taskId,
      chatThreadId,
      clientId,
      supportTicketId,
    });

    // Insert notification
      let result;
      try {
        result = await pool.query(
          `INSERT INTO notifications 
           (user_id, type, title, message, workspace_id, project_id, task_id, 
            chat_thread_id, chat_message_id, client_id, support_ticket_id, sender_id, action_url, action_type, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            userId,
            type,
            title,
            message,
            workspaceId,
            projectId,
            taskId,
            chatThreadId,
            chatMessageId,
            clientId,
            supportTicketId,
            senderId,
            actionUrl,
            type,
            JSON.stringify(metadata),
          ]
        );
      } catch (insertErr) {
        const missingColumnError = insertErr?.code === '42703' || /column .* does not exist/i.test(insertErr?.message || '');
        const missingRelationError = insertErr?.code === '42P01';

        if (!missingColumnError && !missingRelationError) {
          throw insertErr;
        }

        console.warn('Notification insert fallback triggered:', insertErr.message);
        result = await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            userId,
            type,
            title,
            message,
            projectId,
            taskId,
          ]
        );
      }

    const notification = result.rows[0];

    // Broadcast via WebSocket if available
    if (broadcast && wsBroadcastFn) {
      // Fetch additional data for the notification (project name, task name, sender name)
      let enrichedNotification = { ...notification, is_new: true };
      
      try {
        // Get project name if project_id exists
        if (projectId) {
          const projectRes = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
          if (projectRes.rows.length > 0) {
            enrichedNotification.project_name = projectRes.rows[0].name;
          }
        }
        
        // Get task name if task_id exists
        if (taskId) {
          const taskRes = await pool.query('SELECT name FROM tasks WHERE id = $1', [taskId]);
          if (taskRes.rows.length > 0) {
            enrichedNotification.task_name = taskRes.rows[0].name;
          }
        }
        
        // Get sender name if sender_id exists
        if (senderId) {
          const senderRes = await pool.query(`
            SELECT COALESCE(first_name || ' ' || last_name, username) as name 
            FROM users WHERE id = $1
          `, [senderId]);
          if (senderRes.rows.length > 0) {
            enrichedNotification.sender_name = senderRes.rows[0].name;
          }
        }
      } catch (enrichErr) {
        console.error('Error enriching notification for WebSocket:', enrichErr);
        // Continue with non-enriched notification
      }
      
      console.log('🔔 Broadcasting notification via WebSocket to user:', userId, {
        id: enrichedNotification.id,
        title: enrichedNotification.title,
        type: enrichedNotification.type,
        created_at: enrichedNotification.created_at
      });
      
      // Send enriched notification directly - notificationToUser will wrap it
      wsBroadcastFn(userId, enrichedNotification);
    }

    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
}

/**
 * Create notifications for multiple users
 */
async function createBulkNotifications(notifications) {
  const results = [];
  for (const notif of notifications) {
    const result = await createNotification(notif);
    if (result) results.push(result);
  }
  return results;
}

// ============================================================================
// TASK NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify task followers when a task is newly created
 */
async function notifyTaskCreated({ taskId, taskName, creatorId, projectId, workspaceId, followers = [] }) {
  const creator = await getUserName(creatorId);
  const notifications = followers.map((followerId) => ({
    userId: followerId,
    type: NOTIFICATION_TYPES.TASK_CREATED,
    title: 'New Task Created',
    message: `${creator} created "${taskName}" and added you to it`,
    projectId,
    taskId,
    workspaceId,
    senderId: creatorId,
    metadata: { task_name: taskName, created_by: creator },
  }));
  return createBulkNotifications(notifications);
}

/**
 * Notify when a task is assigned to a user
 */
async function notifyTaskAssigned({ taskId, taskName, assigneeId, assignerId, projectId, workspaceId }) {
  const assigner = await getUserName(assignerId);
  return createNotification({
    userId: assigneeId,
    type: NOTIFICATION_TYPES.TASK_ASSIGNED,
    title: 'Task Assigned',
    message: `${assigner} assigned you to "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: assignerId,
    metadata: { task_name: taskName, assigner_id: assignerId },
  });
}

/**
 * Notify when a collaborator is added to a task
 */
async function notifyTaskCollaboratorAdded({ taskId, taskName, collaboratorId, adderId, projectId, workspaceId }) {
  const adder = await getUserName(adderId);
  return createNotification({
    userId: collaboratorId,
    type: NOTIFICATION_TYPES.TASK_COLLABORATOR_ADDED,
    title: 'Added as Collaborator',
    message: `${adder} added you as a collaborator on "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: adderId,
    metadata: { task_name: taskName, added_by: adder },
  });
}

/**
 * Notify when a task is unassigned from a user
 */
async function notifyTaskUnassigned({ taskId, taskName, previousAssigneeId, unassignerId, projectId, workspaceId }) {
  const unassigner = await getUserName(unassignerId);
  return createNotification({
    userId: previousAssigneeId,
    type: NOTIFICATION_TYPES.TASK_UNASSIGNED,
    title: 'Task Unassigned',
    message: `${unassigner} removed you from "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: unassignerId,
    metadata: { task_name: taskName },
  });
}

/**
 * Notify when a task due date is changed
 */
async function notifyTaskDueDateChanged({ taskId, taskName, assigneeId, changerId, oldDueDate, newDueDate, projectId, workspaceId }) {
  const changer = await getUserName(changerId);
  const dateStr = newDueDate ? new Date(newDueDate).toLocaleDateString() : 'No due date';
  return createNotification({
    userId: assigneeId,
    type: NOTIFICATION_TYPES.TASK_DUE_CHANGED,
    title: 'Due Date Changed',
    message: `${changer} changed the due date of "${taskName}" to ${dateStr}`,
    projectId,
    taskId,
    workspaceId,
    senderId: changerId,
    metadata: { task_name: taskName, old_due_date: oldDueDate, new_due_date: newDueDate },
  });
}

/**
 * Notify when a user is @mentioned in a task
 */
async function notifyTaskMentioned({ taskId, taskName, mentionedUserId, mentionerId, projectId, workspaceId, context = 'description' }) {
  const mentioner = await getUserName(mentionerId);
  return createNotification({
    userId: mentionedUserId,
    type: NOTIFICATION_TYPES.TASK_MENTIONED,
    title: 'Mentioned in Task',
    message: `${mentioner} mentioned you in "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: mentionerId,
    metadata: { task_name: taskName, context },
  });
}

/**
 * Notify task followers when a new attachment is added
 */
async function notifyTaskAttachment({ taskId, taskName, attachmentName, uploaderId, projectId, workspaceId, followers = [] }) {
  const uploader = await getUserName(uploaderId);
  const notifications = followers.map(followerId => ({
    userId: followerId,
    type: NOTIFICATION_TYPES.TASK_ATTACHMENT,
    title: 'New Attachment',
    message: `${uploader} added "${attachmentName}" to "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: uploaderId,
    metadata: { task_name: taskName, attachment_name: attachmentName },
  }));
  return createBulkNotifications(notifications);
}

/**
 * Notify task followers when a new comment is added
 */
async function notifyTaskComment({ taskId, taskName, commentPreview, commenterId, projectId, workspaceId, followers = [] }) {
  const commenter = await getUserName(commenterId);
  const preview = commentPreview.length > 50 ? commentPreview.substring(0, 50) + '...' : commentPreview;
  const notifications = followers.map(followerId => ({
    userId: followerId,
    type: NOTIFICATION_TYPES.TASK_COMMENT,
    title: 'New Comment',
    message: `${commenter} commented on "${taskName}": "${preview}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: commenterId,
    metadata: { task_name: taskName, comment_preview: preview },
  }));
  return createBulkNotifications(notifications);
}

/**
 * Notify task followers when task is marked complete
 */
async function notifyTaskCompleted({ taskId, taskName, completerId, projectId, workspaceId, followers = [] }) {
  const completer = await getUserName(completerId);
  const notifications = followers.map(followerId => ({
    userId: followerId,
    type: NOTIFICATION_TYPES.TASK_COMPLETED,
    title: 'Task Completed',
    message: `${completer} marked "${taskName}" as complete`,
    projectId,
    taskId,
    workspaceId,
    senderId: completerId,
    metadata: { task_name: taskName },
  }));
  return createBulkNotifications(notifications);
}

/**
 * Notify task followers when important task fields change
 */
async function notifyTaskStatusChanged({
  taskId,
  taskName,
  changerId,
  projectId,
  workspaceId,
  followers = [],
  title,
  message,
  metadata = {},
}) {
  const changer = await getUserName(changerId);
  const normalizedTitle = String(title || 'Task Updated').trim() || 'Task Updated';
  const normalizedMessage = String(message || '').trim();
  const notifications = followers.map((followerId) => ({
    userId: followerId,
    type: NOTIFICATION_TYPES.TASK_STATUS_CHANGED,
    title: normalizedTitle,
    message: normalizedMessage || `${changer} updated "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: changerId,
    metadata: {
      task_name: taskName,
      changed_by: changer,
      ...metadata,
    },
  }));
  return createBulkNotifications(notifications);
}

/**
 * Notify when task is liked
 */
async function notifyTaskLiked({ taskId, taskName, taskOwnerId, likerId, projectId, workspaceId }) {
  const liker = await getUserName(likerId);
  return createNotification({
    userId: taskOwnerId,
    type: NOTIFICATION_TYPES.TASK_LIKED,
    title: 'Task Liked',
    message: `${liker} liked your task "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: likerId,
    metadata: { task_name: taskName },
  });
}

/**
 * Notify when comment is liked
 */
async function notifyCommentLiked({ taskId, taskName, commentOwnerId, likerId, projectId, workspaceId }) {
  const liker = await getUserName(likerId);
  return createNotification({
    userId: commentOwnerId,
    type: NOTIFICATION_TYPES.COMMENT_LIKED,
    title: 'Comment Liked',
    message: `${liker} liked your comment on "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: likerId,
    metadata: { task_name: taskName },
  });
}

/**
 * Notify when attachment is liked
 */
async function notifyAttachmentLiked({ taskId, taskName, attachmentOwnerId, likerId, projectId, workspaceId }) {
  const liker = await getUserName(likerId);
  return createNotification({
    userId: attachmentOwnerId,
    type: NOTIFICATION_TYPES.ATTACHMENT_LIKED,
    title: 'Attachment Liked',
    message: `${liker} liked your attachment on "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: likerId,
    metadata: { task_name: taskName },
  });
}

/**
 * Notify when dependency status changes
 */
async function notifyDependencyChanged({ taskId, taskName, dependentTaskName, userId, changerId, projectId, workspaceId, newStatus }) {
  const changer = await getUserName(changerId);
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.DEPENDENCY_CHANGED,
    title: 'Dependency Updated',
    message: `"${dependentTaskName}" (dependency of "${taskName}") was marked ${newStatus}`,
    projectId,
    taskId,
    workspaceId,
    senderId: changerId,
    metadata: { task_name: taskName, dependent_task_name: dependentTaskName, new_status: newStatus },
  });
}

// ============================================================================
// CHAT NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify when a direct message is received
 */
async function notifyChatMessage({ threadId, senderId, receiverId, messagePreview, workspaceId }) {
  const sender = await getUserName(senderId);
  const preview = messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview;
  return createNotification({
    userId: receiverId,
    type: NOTIFICATION_TYPES.CHAT_MESSAGE,
    title: 'New Message',
    message: `${sender}: "${preview}"`,
    chatThreadId: threadId,
    workspaceId,
    senderId,
    metadata: { message_preview: preview },
  });
}

/**
 * Notify when a group message is received
 */
async function notifyChatGroupMessage({ threadId, threadName, senderId, memberIds, messagePreview, workspaceId }) {
  const sender = await getUserName(senderId);
  const preview = messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview;
  const notifications = memberIds
    .filter(id => id !== senderId)
    .map(memberId => ({
      userId: memberId,
      type: NOTIFICATION_TYPES.CHAT_GROUP_MESSAGE,
      title: threadName || 'Group Chat',
      message: `${sender}: "${preview}"`,
      chatThreadId: threadId,
      workspaceId,
      senderId,
      metadata: { thread_name: threadName, message_preview: preview },
    }));
  return createBulkNotifications(notifications);
}

/**
 * Notify when mentioned in chat
 */
async function notifyChatMentioned({ threadId, threadName, senderId, mentionedUserId, messagePreview, workspaceId }) {
  const sender = await getUserName(senderId);
  const preview = messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview;
  return createNotification({
    userId: mentionedUserId,
    type: NOTIFICATION_TYPES.CHAT_MENTIONED,
    title: 'Mentioned in Chat',
    message: `${sender} mentioned you: "${preview}"`,
    chatThreadId: threadId,
    workspaceId,
    senderId,
    metadata: { thread_name: threadName, message_preview: preview },
  });
}

// ============================================================================
// PROJECT NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify project admins and owner when settings change
 */
async function notifyProjectSettingsChanged({ projectId, projectName, changerId, workspaceId, changeDescription }) {
  // Get project owner and admins (excluding the changer)
  const adminsResult = await pool.query(
    `SELECT user_id FROM project_members 
     WHERE project_id = $1 AND role IN ('Owner', 'Admin') AND user_id != $2`,
    [projectId, changerId]
  );
  
  const changer = await getUserName(changerId);
  const notifications = adminsResult.rows.map(row => ({
    userId: row.user_id,
    type: NOTIFICATION_TYPES.PROJECT_SETTINGS,
    title: 'Project Settings Changed',
    message: `${changer} updated settings for "${projectName}": ${changeDescription}`,
    projectId,
    workspaceId,
    senderId: changerId,
    metadata: { project_name: projectName, change_description: changeDescription },
  }));
  
  return createBulkNotifications(notifications);
}

/**
 * Notify when project ownership is transferred
 */
async function notifyProjectOwnershipTransferred({ projectId, projectName, newOwnerId, previousOwnerId, workspaceId }) {
  const previousOwner = await getUserName(previousOwnerId);
  return createNotification({
    userId: newOwnerId,
    type: NOTIFICATION_TYPES.PROJECT_OWNERSHIP,
    title: 'Project Ownership Transferred',
    message: `You are now the owner of project "${projectName}"`,
    projectId,
    workspaceId,
    senderId: previousOwnerId,
    metadata: { project_name: projectName, previous_owner_id: previousOwnerId },
  });
}

/**
 * Notify owner when admin makes changes
 */
async function notifyOwnerOfAdminChanges({ projectId, projectName, adminId, workspaceId, changeDescription }) {
  // Get project owner
  const ownerResult = await pool.query(
    `SELECT user_id FROM project_members WHERE project_id = $1 AND role = 'Owner' LIMIT 1`,
    [projectId]
  );
  
  if (ownerResult.rows.length === 0) return null;
  
  const ownerId = ownerResult.rows[0].user_id;
  if (ownerId === adminId) return null; // Don't notify self
  
  const admin = await getUserName(adminId);
  return createNotification({
    userId: ownerId,
    type: NOTIFICATION_TYPES.PROJECT_SETTINGS,
    title: 'Admin Made Changes',
    message: `${admin} made changes to "${projectName}": ${changeDescription}`,
    projectId,
    workspaceId,
    senderId: adminId,
    metadata: { project_name: projectName, change_description: changeDescription, admin_id: adminId },
  });
}

// ============================================================================
// CLIENT NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify when client is added to project
 */
async function notifyClientAdded({ projectId, projectName, clientName, adderId, workspaceId }) {
  // Get project owner and admins
  const adminsResult = await pool.query(
    `SELECT user_id FROM project_members 
     WHERE project_id = $1 AND role IN ('Owner', 'Admin') AND user_id != $2`,
    [projectId, adderId]
  );
  
  const adder = await getUserName(adderId);
  const notifications = adminsResult.rows.map(row => ({
    userId: row.user_id,
    type: NOTIFICATION_TYPES.CLIENT_ADDED,
    title: 'Client Added',
    message: `${adder} added client "${clientName}" to "${projectName}"`,
    projectId,
    workspaceId,
    senderId: adderId,
    metadata: { project_name: projectName, client_name: clientName },
  }));
  
  return createBulkNotifications(notifications);
}

/**
 * Notify when client is changed
 */
async function notifyClientChanged({ clientId, clientName, changerId, workspaceId, changeDescription }) {
  // Get workspace owner and admins
  const adminsResult = await pool.query(
    `SELECT user_id FROM workspace_members 
     WHERE workspace_id = $1 AND role IN ('Owner', 'Admin') AND user_id != $2`,
    [workspaceId, changerId]
  );
  
  const changer = await getUserName(changerId);
  const notifications = adminsResult.rows.map(row => ({
    userId: row.user_id,
    type: NOTIFICATION_TYPES.CLIENT_CHANGED,
    title: 'Client Updated',
    message: `${changer} updated client "${clientName}": ${changeDescription}`,
    clientId,
    workspaceId,
    senderId: changerId,
    metadata: { client_name: clientName, change_description: changeDescription },
  }));
  
  return createBulkNotifications(notifications);
}

// ============================================================================
// APPROVAL NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify approvers when approval is requested
 */
async function notifyApprovalRequested({ approvalId, taskId, taskName, requesterId, projectId, workspaceId, approverIds = [] }) {
  const requester = await getUserName(requesterId);
  const notifications = approverIds.map(approverId => ({
    userId: approverId,
    type: NOTIFICATION_TYPES.APPROVAL_REQUESTED,
    title: 'Approval Requested',
    message: `${requester} requested approval for "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: requesterId,
    metadata: { task_name: taskName, approval_id: approvalId },
  }));
  return createBulkNotifications(notifications);
}

/**
 * Notify requester when task is approved
 */
async function notifyApprovalApproved({ taskId, taskName, requesterId, approverId, projectId, workspaceId }) {
  const approver = await getUserName(approverId);
  return createNotification({
    userId: requesterId,
    type: NOTIFICATION_TYPES.APPROVAL_APPROVED,
    title: 'Task Approved',
    message: `${approver} approved your request for "${taskName}"`,
    projectId,
    taskId,
    workspaceId,
    senderId: approverId,
    metadata: { task_name: taskName },
  });
}

/**
 * Notify requester when task is rejected
 */
async function notifyApprovalRejected({ taskId, taskName, requesterId, rejecterId, projectId, workspaceId, reason }) {
  const rejecter = await getUserName(rejecterId);
  return createNotification({
    userId: requesterId,
    type: NOTIFICATION_TYPES.APPROVAL_REJECTED,
    title: 'Task Rejected',
    message: `${rejecter} rejected your request for "${taskName}"${reason ? `: ${reason}` : ''}`,
    projectId,
    taskId,
    workspaceId,
    senderId: rejecterId,
    metadata: { task_name: taskName, rejection_reason: reason },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get user's display name
 */
async function getUserName(userId) {
  try {
    const result = await pool.query(
      `SELECT first_name, last_name, username FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return 'Someone';
    const user = result.rows[0];
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.username || 'Someone';
  } catch (err) {
    return 'Someone';
  }
}

/**
 * Get task followers (assignee + collaborators + creator)
 */
async function getTaskFollowers(taskId, excludeUserId = null) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT user_id FROM (
        SELECT assignee_id as user_id FROM tasks WHERE id = $1 AND assignee_id IS NOT NULL
        UNION
        SELECT created_by as user_id FROM tasks WHERE id = $1
        UNION
        SELECT user_id FROM task_collaborators WHERE task_id = $1
      ) AS followers
      WHERE user_id IS NOT NULL ${excludeUserId ? 'AND user_id != $2' : ''}`,
      excludeUserId ? [taskId, excludeUserId] : [taskId]
    );
    return result.rows.map(r => r.user_id);
  } catch (err) {
    console.error('Error getting task followers:', err);
    return [];
  }
}

/**
 * Get project approvers (tagged approvers + designated approvers + owner if admins_can_approve)
 */
async function getProjectApprovers(projectId) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT user_id FROM (
        -- Tagged approvers from project_approvers table
        SELECT user_id FROM project_approvers WHERE project_id = $1
        UNION
        -- Designated approvers from project settings
        SELECT UNNEST(designated_approvers) as user_id 
        FROM project_approval_settings 
        WHERE project_id = $1 AND designated_approvers IS NOT NULL
        UNION
        -- Project owner
        SELECT user_id FROM project_members WHERE project_id = $1 AND role = 'Owner'
      ) AS approvers
      WHERE user_id IS NOT NULL`,
      [projectId]
    );
    return result.rows.map(r => r.user_id);
  } catch (err) {
    console.error('Error getting project approvers:', err);
    return [];
  }
}

/**
 * Parse @mentions from text and return user IDs
 */
function parseMentionsFromText(text) {
  const mentionRegex = /@\[(user|project|task):(\d+):([^\]]+)\]/g;
  const userIds = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match[1] === 'user') {
      userIds.push(parseInt(match[2], 10));
    }
  }
  return userIds;
}

module.exports = {
  NOTIFICATION_TYPES,
  setWebSocketBroadcast,
  createNotification,
  createBulkNotifications,
  getUserPreferences,
  generateActionUrl,
  getTaskFollowers,
  getProjectApprovers,
  parseMentionsFromText,
  getUserName,
  // Task notifications
  notifyTaskCreated,
  notifyTaskAssigned,
  notifyTaskCollaboratorAdded,
  notifyTaskUnassigned,
  notifyTaskDueDateChanged,
  notifyTaskMentioned,
  notifyTaskAttachment,
  notifyTaskComment,
  notifyTaskCompleted,
  notifyTaskStatusChanged,
  notifyTaskLiked,
  notifyCommentLiked,
  notifyAttachmentLiked,
  notifyDependencyChanged,
  // Chat notifications
  notifyChatMessage,
  notifyChatGroupMessage,
  notifyChatMentioned,
  // Project notifications
  notifyProjectSettingsChanged,
  notifyProjectOwnershipTransferred,
  notifyOwnerOfAdminChanges,
  // Client notifications
  notifyClientAdded,
  notifyClientChanged,
  // Approval notifications
  notifyApprovalRequested,
  notifyApprovalApproved,
  notifyApprovalRejected,
};
