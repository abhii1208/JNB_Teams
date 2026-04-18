const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const notificationService = require('../services/notificationService');
const { sendMail } = require('../services/mailService');

const normalizeNumericInput = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeClientIdInput = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeUserIdsInput = (value) => {
  if (value === undefined) return { ids: null };
  if (value === null) return { ids: [] };
  const list = Array.isArray(value) ? value : [value];
  const ids = list
    .map((item) => {
      if (typeof item === 'object' && item !== null) {
        return Number(item.id ?? item.user_id);
      }
      return Number(item);
    })
    .filter((id) => Number.isInteger(id) && id > 0);
  return { ids: [...new Set(ids)] };
};

const inferStatusForStageChange = ({ newStage, currentStatus }) => {
  if (!newStage) return null;
  const status = typeof currentStatus === 'string' ? currentStatus : null;

  if (newStage !== 'Completed' && (status === 'Pending Approval' || status === 'Rejected')) {
    return 'Open';
  }

  if ((newStage === 'Planned' || newStage === 'In-process') && status === 'Closed') {
    return 'Open';
  }

  if (newStage === 'Planned') return 'Open';

  if (newStage === 'In-process') {
    if (status === 'Pending Approval' || status === 'Closed') return 'Open';
    return 'In Progress';
  }

  if (newStage === 'On-hold') {
    if (status === 'Pending Approval') return 'Open';
    return 'Blocked';
  }

  if (newStage === 'Completed') {
    if (status === 'Closed' || status === 'auto_closed') return status;
    return 'Pending Approval';
  }

  return null;
};

const normalizeLinkedProjectIds = (value) => {
  if (value === undefined) return { ids: null };
  if (value === null) return { ids: [] };
  if (!Array.isArray(value)) {
    return { error: 'linked_project_ids must be an array', ids: [] };
  }
  const ids = value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const unique = [];
  const seen = new Set();
  ids.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  });
  return { ids: unique };
};

const ensureLinkedProjectsAccessible = async (dbClient, {
  workspaceId,
  userId,
  projectIds,
}) => {
  if (!projectIds || projectIds.length === 0) return;
  const result = await dbClient.query(
    `SELECT p.id
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE p.workspace_id = $1
       AND pm.user_id = $2
       AND p.id = ANY($3::int[])`,
    [workspaceId, userId, projectIds]
  );
  if (result.rows.length !== projectIds.length) {
    const err = new Error('Not allowed to link one or more projects');
    err.status = 403;
    throw err;
  }
};

const ensureProjectMembersAccessible = async (dbClient, {
  projectId,
  userIds,
}) => {
  if (!userIds || userIds.length === 0) return;
  const result = await dbClient.query(
    `SELECT user_id
     FROM project_members
     WHERE project_id = $1
       AND user_id = ANY($2::int[])`,
    [projectId, userIds]
  );
  if (result.rows.length !== userIds.length) {
    const err = new Error('One or more collaborators are not members of the project');
    err.status = 400;
    throw err;
  }
};

const syncTaskProjectLinks = async (dbClient, taskId, projectIds, userId) => {
  if (!projectIds || projectIds.length === 0) {
    await dbClient.query('DELETE FROM task_project_links WHERE task_id = $1', [taskId]);
    return;
  }

  await dbClient.query(
    'DELETE FROM task_project_links WHERE task_id = $1 AND NOT (project_id = ANY($2::int[]))',
    [taskId, projectIds]
  );

  await dbClient.query(
    `INSERT INTO task_project_links (task_id, project_id, created_by)
     SELECT $1, unnest($2::int[]), $3
     ON CONFLICT DO NOTHING`,
    [taskId, projectIds, userId]
  );
};

const syncTaskCollaborators = async (dbClient, taskId, collaboratorIds) => {
  if (!collaboratorIds || collaboratorIds.length === 0) {
    await dbClient.query('DELETE FROM task_collaborators WHERE task_id = $1', [taskId]);
    return;
  }

  await dbClient.query(
    'DELETE FROM task_collaborators WHERE task_id = $1 AND NOT (user_id = ANY($2::int[]))',
    [taskId, collaboratorIds]
  );

  await dbClient.query(
    `INSERT INTO task_collaborators (task_id, user_id)
     SELECT $1, unnest($2::int[])
     ON CONFLICT DO NOTHING`,
    [taskId, collaboratorIds]
  );
};

const getPrimaryProjectClientId = async (dbClient, projectId) => {
  const result = await dbClient.query(
    `SELECT client_id
     FROM project_clients
     WHERE project_id = $1
     ORDER BY is_primary DESC, id ASC
     LIMIT 1`,
    [projectId]
  );
  return result.rows[0]?.client_id || null;
};

const validateProjectClientLink = async (dbClient, projectId, clientId) => {
  if (!clientId) return null;
  const result = await dbClient.query(
    'SELECT 1 FROM project_clients WHERE project_id = $1 AND client_id = $2',
    [projectId, clientId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Client is not linked to this project');
    err.status = 400;
    throw err;
  }
  return clientId;
};

const getWorkspaceRole = async (dbClient, workspaceId, userId) => {
  const result = await dbClient.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return result.rows[0]?.role || null;
};

const canManageServices = (workspaceRole) => ['Owner', 'Admin', 'ProjectAdmin'].includes(workspaceRole);

const parseJsonField = (value, fallback = []) => {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return fallback;
  }
};

const insertMinimalNotification = async (dbClient, {
  userId,
  type,
  title,
  message,
  projectId = null,
  taskId = null,
}) => {
  if (!userId || !type || !title || !message) return null;
  try {
    const result = await dbClient.query(
      `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, type, title, message, projectId, taskId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Minimal notification insert failed:', err);
    return null;
  }
};

const normalizeWorkLogInput = ({ start_time, end_time, hours, work_date, notes }) => {
  const normalizedHours = normalizeNumericInput(hours);
  let computedHours = normalizedHours;

  if (start_time && end_time) {
    const start = new Date(start_time);
    const end = new Date(end_time);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      computedHours = Number(((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2));
    }
  }

  return {
    start_time: start_time || null,
    end_time: end_time || null,
    hours: computedHours,
    work_date: work_date || null,
    notes: notes || null,
  };
};

const syncTaskWorkedHours = async (dbClient, taskId) => {
  const aggregateResult = await dbClient.query(
    `SELECT
       COALESCE(SUM(COALESCE(hours, 0)), 0)::numeric(10,2) AS worked_hours,
       MIN(start_time) AS first_start_time,
       MAX(end_time) AS last_end_time
     FROM task_work_logs
     WHERE task_id = $1`,
    [taskId]
  );

  const aggregate = aggregateResult.rows[0] || {};

  const taskUpdate = await dbClient.query(
    `UPDATE tasks
     SET worked_hours = $2,
         start_time = COALESCE($3, start_time),
         end_time = COALESCE($4, end_time),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING worked_hours, start_time, end_time`,
    [
      taskId,
      aggregate.worked_hours || 0,
      aggregate.first_start_time || null,
      aggregate.last_end_time || null,
    ]
  );

  return taskUpdate.rows[0] || null;
};

const getTaskDetailById = async (dbClient, taskId, userId) => {
  const result = await dbClient.query(
    `SELECT
       t.*,
       p.workspace_id,
       p.name AS project_name,
       p.service_id AS project_service_id,
       COALESCE(u.first_name || ' ' || u.last_name, u.username) AS assignee_name,
       COALESCE(creator.first_name || ' ' || creator.last_name, creator.username) AS created_by_name,
       s.name AS service_name,
       s.category AS service_category,
       COALESCE(
         (
           SELECT json_agg(json_build_object(
             'id', tc.id,
             'user_id', tc.user_id,
             'user_name', COALESCE(cu.first_name || ' ' || cu.last_name, cu.username),
             'comment', tc.comment,
             'created_at', tc.created_at,
             'updated_at', tc.updated_at
           ) ORDER BY tc.created_at ASC)
           FROM task_comments tc
           JOIN users cu ON cu.id = tc.user_id
           WHERE tc.task_id = t.id AND tc.deleted_at IS NULL
         ),
         '[]'::json
       ) AS comments,
       COALESCE(
         (
           SELECT json_agg(json_build_object(
             'id', twl.id,
             'user_id', twl.user_id,
             'user_name', COALESCE(wu.first_name || ' ' || wu.last_name, wu.username),
             'work_date', twl.work_date,
             'start_time', twl.start_time,
             'end_time', twl.end_time,
             'hours', twl.hours,
             'notes', twl.notes,
             'created_at', twl.created_at
           ) ORDER BY twl.work_date DESC, twl.created_at DESC)
           FROM task_work_logs twl
           JOIN users wu ON wu.id = twl.user_id
           WHERE twl.task_id = t.id
         ),
         '[]'::json
       ) AS work_logs,
       COALESCE(
         (
           SELECT json_agg(json_build_object(
             'id', tr.id,
             'recipient_id', tr.recipient_id,
             'recipient_name', COALESCE(ru.first_name || ' ' || ru.last_name, ru.username),
             'sender_id', tr.sender_id,
             'sender_name', COALESCE(su.first_name || ' ' || su.last_name, su.username),
             'message', tr.message,
             'delivery_channels', tr.delivery_channels,
             'sent_at', tr.sent_at
           ) ORDER BY tr.sent_at DESC)
           FROM task_reminders tr
           JOIN users ru ON ru.id = tr.recipient_id
           JOIN users su ON su.id = tr.sender_id
           WHERE tr.task_id = t.id
         ),
         '[]'::json
       ) AS reminders,
       COALESCE(
         (
           SELECT json_agg(json_build_object(
             'id', u2.id,
             'name', COALESCE(u2.first_name || ' ' || u2.last_name, u2.username),
             'email', u2.email
           ) ORDER BY u2.first_name, u2.last_name)
           FROM task_collaborators tc2
           JOIN users u2 ON u2.id = tc2.user_id
           WHERE tc2.task_id = t.id
         ),
         '[]'::json
       ) AS collaborators
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN users creator ON creator.id = t.created_by
     LEFT JOIN services s ON s.id = t.service_id
     LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
     WHERE t.id = $1
       AND t.deleted_at IS NULL
       AND (pm.user_id IS NOT NULL OR p.created_by = $2)`,
    [taskId, userId]
  );

  if (!result.rows.length) return null;

  const task = result.rows[0];
  task.comments = parseJsonField(task.comments, []);
  task.work_logs = parseJsonField(task.work_logs, []);
  task.reminders = parseJsonField(task.reminders, []);
  task.collaborators = parseJsonField(task.collaborators, []);
  return task;
};

// Get ALL tasks for a workspace (cross-project)
// Supports filtering, sorting, pagination
router.get('/workspace/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  const {
    // Pagination
    page = 1,
    limit = 50,
    // Filters
    projects, // comma-separated project IDs
    status, // comma-separated statuses
    stage, // comma-separated stages
    priority, // comma-separated priorities
    assignee, // 'me', 'unassigned', or comma-separated user IDs
    name,
    client_name,
    notes,
    category,
    section,
    tags,
    external_id,
    estimated_hours_min,
    estimated_hours_max,
    actual_hours_min,
    actual_hours_max,
    completion_percentage_min,
    completion_percentage_max,
    target_date_from,
    target_date_to,
    no_target_date,
    collaborator_ids,
    due_date_from,
    due_date_to,
    no_due_date,
    overdue, // 'true' or 'false'
    recurring, // 'true' or 'false'
    approval_status, // 'pending', 'approved', 'rejected'
    created_by,
    created_date_from,
    created_date_to,
    completed_date_from,
    completed_date_to,
    auto_closed, // 'true' or 'false'
    has_reminders, // 'true' or 'false'
    search,
    include_archived,
    hide_completed, // Feature 4: 'true' to hide completed/closed tasks
    due_date_filter, // Feature 7: 'today', 'overdue', 'tomorrow', 'week', 'month'
    // Sorting
    sort_by = 'created_at',
    sort_order = 'desc',
    // Grouping (for metadata)
    group_by
  } = req.query;

  try {
    // First, get projects user has access to
    const userProjectsResult = await pool.query(`
      SELECT p.id 
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE p.workspace_id = $1 AND pm.user_id = $2 AND p.archived_at IS NULL
    `, [workspaceId, req.userId]);

    const userProjectIds = userProjectsResult.rows.map(r => r.id);
    
    if (userProjectIds.length === 0) {
      return res.json({ tasks: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
    }

    // Build query
    let query = `
      SELECT 
        t.*,
        p.name as project_name,
        p.id as project_id,
        s.name as service_name,
        s.category as service_category,
        COALESCE(task_client.client_name, pc_client.client_name) as client_name,
        COALESCE(task_client.legal_name, pc_client.legal_name) as client_legal_name,
        COALESCE(task_client.series_no, pc_client.series_no) as client_series_no,
        COALESCE(t.client_id, pc_client.client_id) as client_id,
        u.first_name || ' ' || u.last_name as assignee_name,
        u.email as assignee_email,
        COALESCE(creator.first_name || ' ' || creator.last_name, 'Unknown User') as created_by_name,
        rt.id as recurring_task_id,
        rt.name as recurring_task_name,
        (SELECT json_agg(json_build_object('id', u2.id, 'name', u2.first_name || ' ' || u2.last_name, 'email', u2.email))
         FROM task_collaborators tc
         JOIN users u2 ON tc.user_id = u2.id
         WHERE tc.task_id = t.id) as collaborators,
        CASE WHEN t.due_date < CURRENT_DATE AND t.status NOT IN ('Closed', 'Completed') THEN true ELSE false END as is_overdue,
        CASE WHEN rt.id IS NOT NULL THEN true ELSE false END as is_recurring,
        (SELECT status FROM approvals WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1) as latest_approval_status,
        COALESCE((SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id AND tc.deleted_at IS NULL), 0) as comments_count,
        COALESCE((SELECT COUNT(*) FROM task_reminders tr WHERE tr.task_id = t.id), 0) as reminders_count,
        COALESCE(
          (SELECT array_agg(DISTINCT tpl.project_id)
           FROM task_project_links tpl
           WHERE tpl.task_id = t.id),
          ARRAY[]::int[]
        ) as linked_project_ids
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN services s ON s.id = t.service_id
      LEFT JOIN clients task_client ON task_client.id = t.client_id
      LEFT JOIN LATERAL (
        SELECT c.id as client_id, c.client_name, c.legal_name, c.series_no
        FROM project_clients pc
        JOIN clients c ON c.id = pc.client_id
        WHERE pc.project_id = p.id AND c.workspace_id = p.workspace_id
        ORDER BY pc.is_primary DESC, pc.id ASC
        LIMIT 1
      ) pc_client ON true
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN recurring_tasks rt ON t.recurring_task_id = rt.id
      WHERE p.workspace_id = $1 
        AND t.deleted_at IS NULL
        AND (
          t.project_id = ANY($2::int[])
          OR EXISTS (
            SELECT 1
            FROM task_project_links tpl
            WHERE tpl.task_id = t.id AND tpl.project_id = ANY($2::int[])
          )
        )
    `;

    const params = [workspaceId, userProjectIds];
    let paramIndex = 3;

    // Apply filters
    const includeArchived = include_archived === 'true';
    const showCompleted = hide_completed !== 'true';
    const noDueDate = no_due_date === 'true';
    const noTargetDate = no_target_date === 'true';

    if (!includeArchived) {
      if (showCompleted) {
        query += ` AND (t.archived_at IS NULL OR t.status IN ('Closed', 'Completed'))`;
      } else {
        query += ` AND t.archived_at IS NULL`;
      }
    }

    if (projects) {
      const projectIds = projects.split(',').map(Number).filter(id => userProjectIds.includes(id));
      if (projectIds.length > 0) {
        query += ` AND (
          t.project_id = ANY($${paramIndex}::int[])
          OR EXISTS (
            SELECT 1
            FROM task_project_links tpl
            WHERE tpl.task_id = t.id AND tpl.project_id = ANY($${paramIndex}::int[])
          )
        )`;
        params.push(projectIds);
        paramIndex++;
      }
    }

    if (status) {
      const statuses = status.split(',');
      query += ` AND t.status = ANY($${paramIndex}::text[])`;
      params.push(statuses);
      paramIndex++;
    }

    if (stage) {
      const stages = stage.split(',');
      query += ` AND t.stage = ANY($${paramIndex}::text[])`;
      params.push(stages);
      paramIndex++;
    }

    if (priority) {
      const priorities = priority.split(',');
      query += ` AND t.priority = ANY($${paramIndex}::text[])`;
      params.push(priorities);
      paramIndex++;
    }

    if (assignee) {
      if (assignee === 'me') {
        query += ` AND t.assignee_id = $${paramIndex}`;
        params.push(req.userId);
        paramIndex++;
      } else if (assignee === 'unassigned') {
        query += ` AND t.assignee_id IS NULL`;
      } else {
        const assigneeIds = assignee.split(',').map(Number);
        query += ` AND t.assignee_id = ANY($${paramIndex}::int[])`;
        params.push(assigneeIds);
        paramIndex++;
      }
    }

    if (name) {
      const trimmed = String(name).trim();
      if (trimmed) {
        query += ` AND t.name ILIKE $${paramIndex}`;
        params.push(`%${trimmed}%`);
        paramIndex++;
      }
    }

    if (client_name) {
      const trimmed = String(client_name).trim();
      if (trimmed) {
        query += ` AND (
          COALESCE(task_client.client_name, pc_client.client_name) ILIKE $${paramIndex}
          OR COALESCE(task_client.legal_name, pc_client.legal_name) ILIKE $${paramIndex}
          OR COALESCE(task_client.series_no, pc_client.series_no) ILIKE $${paramIndex}
        )`;
        params.push(`%${trimmed}%`);
        paramIndex++;
      }
    }

    if (notes) {
      const trimmed = String(notes).trim();
      if (trimmed) {
        query += ` AND t.notes ILIKE $${paramIndex}`;
        params.push(`%${trimmed}%`);
        paramIndex++;
      }
    }

    if (category) {
      const trimmed = String(category).trim();
      if (trimmed) {
        query += ` AND t.category ILIKE $${paramIndex}`;
        params.push(`%${trimmed}%`);
        paramIndex++;
      }
    }

    if (section) {
      const trimmed = String(section).trim();
      if (trimmed) {
        query += ` AND t.section ILIKE $${paramIndex}`;
        params.push(`%${trimmed}%`);
        paramIndex++;
      }
    }

    if (tags) {
      const tagList = String(tags)
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      if (tagList.length > 0) {
        query += ` AND t.tags && $${paramIndex}::text[]`;
        params.push(tagList);
        paramIndex++;
      }
    }

    if (external_id) {
      const trimmed = String(external_id).trim();
      if (trimmed) {
        query += ` AND t.external_id ILIKE $${paramIndex}`;
        params.push(`%${trimmed}%`);
        paramIndex++;
      }
    }

    const estimatedMin = Number(estimated_hours_min);
    if (Number.isFinite(estimatedMin)) {
      query += ` AND t.estimated_hours >= $${paramIndex}`;
      params.push(estimatedMin);
      paramIndex++;
    }

    const estimatedMax = Number(estimated_hours_max);
    if (Number.isFinite(estimatedMax)) {
      query += ` AND t.estimated_hours <= $${paramIndex}`;
      params.push(estimatedMax);
      paramIndex++;
    }

    const actualMin = Number(actual_hours_min);
    if (Number.isFinite(actualMin)) {
      query += ` AND t.actual_hours >= $${paramIndex}`;
      params.push(actualMin);
      paramIndex++;
    }

    const actualMax = Number(actual_hours_max);
    if (Number.isFinite(actualMax)) {
      query += ` AND t.actual_hours <= $${paramIndex}`;
      params.push(actualMax);
      paramIndex++;
    }

    const completionMin = Number(completion_percentage_min);
    if (Number.isFinite(completionMin)) {
      query += ` AND t.completion_percentage >= $${paramIndex}`;
      params.push(completionMin);
      paramIndex++;
    }

    const completionMax = Number(completion_percentage_max);
    if (Number.isFinite(completionMax)) {
      query += ` AND t.completion_percentage <= $${paramIndex}`;
      params.push(completionMax);
      paramIndex++;
    }

    if (noTargetDate) {
      query += ` AND t.target_date IS NULL`;
    } else {
      if (target_date_from) {
        query += ` AND t.target_date >= $${paramIndex}`;
        params.push(target_date_from);
        paramIndex++;
      }

      if (target_date_to) {
        query += ` AND t.target_date <= $${paramIndex}`;
        params.push(target_date_to);
        paramIndex++;
      }
    }

    if (collaborator_ids) {
      const collaboratorIds = String(collaborator_ids)
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
      if (collaboratorIds.length > 0) {
        query += ` AND EXISTS (
          SELECT 1
          FROM task_collaborators tc
          WHERE tc.task_id = t.id AND tc.user_id = ANY($${paramIndex}::int[])
        )`;
        params.push(collaboratorIds);
        paramIndex++;
      }
    }

    if (noDueDate) {
      query += ` AND t.due_date IS NULL`;
    } else {
      if (due_date_from) {
        query += ` AND t.due_date >= $${paramIndex}`;
        params.push(due_date_from);
        paramIndex++;
      }

      if (due_date_to) {
        query += ` AND t.due_date <= $${paramIndex}`;
        params.push(due_date_to);
        paramIndex++;
      }

      if (overdue === 'true') {
        query += ` AND t.due_date < CURRENT_DATE AND t.status NOT IN ('Closed', 'Completed')`;
      }
    }

    if (recurring === 'true') {
      query += ` AND t.recurring_task_id IS NOT NULL`;
    } else if (recurring === 'false') {
      query += ` AND t.recurring_task_id IS NULL`;
    }

    // Feature 4: Hide completed tasks
    if (hide_completed === 'true') {
      query += ` AND t.status NOT IN ('Closed', 'Completed')`;
    }

    // Feature 7: Date filter from label click
    if (!noDueDate && due_date_filter) {
      switch (due_date_filter) {
        case 'today':
          query += ` AND t.due_date = CURRENT_DATE`;
          break;
        case 'overdue':
          query += ` AND t.due_date < CURRENT_DATE AND t.status NOT IN ('Closed', 'Completed')`;
          break;
        case 'tomorrow':
          query += ` AND t.due_date = CURRENT_DATE + INTERVAL '1 day'`;
          break;
        case 'week':
          query += ` AND t.due_date > CURRENT_DATE AND t.due_date <= CURRENT_DATE + INTERVAL '7 days'`;
          break;
        case 'month':
          query += ` AND t.due_date > CURRENT_DATE + INTERVAL '7 days' AND t.due_date <= CURRENT_DATE + INTERVAL '31 days'`;
          break;
      }
    }

    if (created_by) {
      const creatorIds = created_by.split(',').map(Number);
      query += ` AND t.created_by = ANY($${paramIndex}::int[])`;
      params.push(creatorIds);
      paramIndex++;
    }

    if (created_date_from) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(created_date_from);
      paramIndex++;
    }

    if (created_date_to) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(created_date_to);
      paramIndex++;
    }

    if (search) {
      query += ` AND (t.name ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count total before pagination using subquery to avoid regex issues with nested SELECTs
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_sub`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Apply sorting
    const validSortColumns = ['created_at', 'updated_at', 'due_date', 'name', 'priority', 'status', 'stage', 'project_name', 'assignee_name'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortDir = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // Handle sorting for joined columns
    let orderByClause;
    if (sortColumn === 'project_name') {
      orderByClause = `p.name ${sortDir}`;
    } else if (sortColumn === 'assignee_name') {
      orderByClause = `u.first_name ${sortDir} NULLS LAST`;
    } else {
      orderByClause = `t.${sortColumn} ${sortDir} NULLS LAST`;
    }
    
    query += ` ORDER BY ${orderByClause}`;

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Get grouping metadata if requested
    let groupMetadata = null;
    if (group_by) {
      groupMetadata = await getGroupMetadata(workspaceId, userProjectIds, group_by, pool);
    }

    res.json({
      tasks: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      groupMetadata
    });
  } catch (err) {
    console.error('Get workspace tasks error:', {
      error: err.message,
      stack: err.stack,
      workspaceId,
      userId: req.userId,
      params,
      query
    });
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Helper function for group metadata
async function getGroupMetadata(workspaceId, projectIds, groupBy, pool) {
  const metadata = {};
  
  if (groupBy === 'project') {
    const result = await pool.query(`
      SELECT p.id, p.name, COUNT(DISTINCT t.id) as task_count
      FROM projects p
      LEFT JOIN tasks t
        ON t.deleted_at IS NULL
       AND t.archived_at IS NULL
       AND (
         t.project_id = p.id
         OR EXISTS (
           SELECT 1
           FROM task_project_links tpl
           WHERE tpl.task_id = t.id AND tpl.project_id = p.id
         )
       )
      WHERE p.id = ANY($1::int[])
      GROUP BY p.id, p.name
      ORDER BY p.name
    `, [projectIds]);
    metadata.groups = result.rows;
  } else if (groupBy === 'status') {
    const result = await pool.query(`
      SELECT t.status, COUNT(*) as task_count
      FROM tasks t
      WHERE t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND (
          t.project_id = ANY($1::int[])
          OR EXISTS (
            SELECT 1
            FROM task_project_links tpl
            WHERE tpl.task_id = t.id AND tpl.project_id = ANY($1::int[])
          )
        )
      GROUP BY t.status
      ORDER BY t.status
    `, [projectIds]);
    metadata.groups = result.rows;
  } else if (groupBy === 'assignee') {
    const result = await pool.query(`
      SELECT u.id, u.first_name || ' ' || u.last_name as name, COUNT(t.id) as task_count
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND (
          t.project_id = ANY($1::int[])
          OR EXISTS (
            SELECT 1
            FROM task_project_links tpl
            WHERE tpl.task_id = t.id AND tpl.project_id = ANY($1::int[])
          )
        )
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY u.first_name NULLS LAST
    `, [projectIds]);
    metadata.groups = result.rows;
  } else if (groupBy === 'priority') {
    const result = await pool.query(`
      SELECT t.priority, COUNT(*) as task_count
      FROM tasks t
      WHERE t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND (
          t.project_id = ANY($1::int[])
          OR EXISTS (
            SELECT 1
            FROM task_project_links tpl
            WHERE tpl.task_id = t.id AND tpl.project_id = ANY($1::int[])
          )
        )
      GROUP BY t.priority
      ORDER BY 
        CASE t.priority 
          WHEN 'Critical' THEN 1 
          WHEN 'High' THEN 2 
          WHEN 'Medium' THEN 3 
          WHEN 'Low' THEN 4 
          ELSE 5 
        END
    `, [projectIds]);
    metadata.groups = result.rows;
  } else if (groupBy === 'due_date') {
    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN t.due_date IS NULL THEN 'No Due Date'
          WHEN t.due_date < CURRENT_DATE THEN 'Overdue'
          WHEN t.due_date = CURRENT_DATE THEN 'Today'
          WHEN t.due_date = CURRENT_DATE + 1 THEN 'Tomorrow'
          WHEN t.due_date <= CURRENT_DATE + 7 THEN 'This Week'
          WHEN t.due_date <= CURRENT_DATE + 14 THEN 'Next Week'
          ELSE 'Later'
        END as bucket,
        COUNT(*) as task_count
      FROM tasks t
      WHERE t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND (
          t.project_id = ANY($1::int[])
          OR EXISTS (
            SELECT 1
            FROM task_project_links tpl
            WHERE tpl.task_id = t.id AND tpl.project_id = ANY($1::int[])
          )
        )
      GROUP BY bucket
    `, [projectIds]);
    metadata.groups = result.rows;
  }
  
  return metadata;
}

// Get tasks for calendar view (date-based)
router.get('/workspace/:workspaceId/calendar', async (req, res) => {
  const { workspaceId } = req.params;
  const { start_date, end_date, projects, assignee, include_completed } = req.query;

  try {
    // Get user's accessible projects
    const userProjectsResult = await pool.query(`
      SELECT p.id 
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE p.workspace_id = $1 AND pm.user_id = $2 AND p.archived_at IS NULL
    `, [workspaceId, req.userId]);

    let projectIds = userProjectsResult.rows.map(r => r.id);
    
    // Filter by selected projects if specified
    if (projects) {
      const selectedIds = projects.split(',').map(Number);
      projectIds = projectIds.filter(id => selectedIds.includes(id));
    }

    if (projectIds.length === 0) {
      return res.json([]);
    }

    const params = [projectIds, start_date, end_date];
    let paramIndex = 4;

    let query = `
      SELECT 
        t.id, t.name, t.description, t.due_date, t.target_date, t.status, t.stage, t.priority, t.assignee_id,
        t.worked_hours, t.start_time, t.end_time,
        p.id as project_id, p.name as project_name,
        s.name as service_name,
        u.first_name || ' ' || u.last_name as assignee_name,
        CASE WHEN rt.id IS NOT NULL THEN true ELSE false END as is_recurring
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN services s ON s.id = t.service_id
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN recurring_tasks rt ON t.recurring_task_id = rt.id
      WHERE (
        t.project_id = ANY($1::int[])
        OR EXISTS (
          SELECT 1
          FROM task_project_links tpl
          WHERE tpl.task_id = t.id AND tpl.project_id = ANY($1::int[])
        )
      )
        AND t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND ($4::boolean = true OR t.status NOT IN ('Closed', 'Completed'))
        AND (
          (t.due_date >= $2 AND t.due_date <= $3)
          OR (t.target_date >= $2 AND t.target_date <= $3)
        )
    `;

    params.splice(3, 0, include_completed === 'true');
    paramIndex = 5;

    if (assignee && assignee !== 'all') {
      if (assignee === 'me') {
        query += ` AND t.assignee_id = $${paramIndex}`;
        params.push(req.userId);
        paramIndex++;
      } else if (assignee === 'unassigned') {
        query += ' AND t.assignee_id IS NULL';
      } else {
        const assigneeIds = String(assignee)
          .split(',')
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0);
        if (assigneeIds.length > 0) {
          query += ` AND t.assignee_id = ANY($${paramIndex}::int[])`;
          params.push(assigneeIds);
          paramIndex++;
        }
      }
    }

    query += ' ORDER BY t.due_date ASC NULLS LAST';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Get calendar tasks error:', {
      error: err.message,
      stack: err.stack,
      workspaceId,
      userId: req.userId,
      projectIds,
      start_date,
      end_date
    });
    res.status(500).json({ error: 'Failed to fetch calendar tasks' });
  }
});

// Bulk update tasks
router.put('/bulk', async (req, res) => {
  const { task_ids, updates: rawUpdates } = req.body;
  const updates = rawUpdates || {};
  
  if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
    return res.status(400).json({ error: 'task_ids array is required' });
  }
  if (typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates object is required' });
  }

  const normalizedUpdates = {
    status: updates.status,
    stage: updates.stage,
    priority: updates.priority,
    assignee_id: updates.assignee_id ?? updates.assigneeId,
    due_date: updates.due_date ?? updates.dueDate,
    target_date: updates.target_date ?? updates.targetDate,
  };

  if (normalizedUpdates.due_date === '') normalizedUpdates.due_date = null;
  if (normalizedUpdates.target_date === '') normalizedUpdates.target_date = null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify user has access to all tasks
    const accessCheck = await client.query(`
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN project_members pm ON p.id = pm.project_id
      WHERE t.id = ANY($1::int[]) AND pm.user_id = $2
    `, [task_ids, req.userId]);

    if (accessCheck.rows.length !== task_ids.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied to one or more tasks' });
    }

    const requestedStatus = typeof normalizedUpdates.status === 'string'
      ? normalizedUpdates.status.toLowerCase()
      : null;
    const isApprovalStatus = requestedStatus === 'closed' || requestedStatus === 'rejected';
    if (isApprovalStatus) {
      const permRes = await client.query(`
        SELECT t.id,
          p.created_by AS project_owner,
          p.admins_can_approve,
          p.only_owner_approves,
          pm.role as user_project_role
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
        WHERE t.id = ANY($1::int[])
      `, [task_ids, req.userId]);

      const notAllowed = permRes.rows.some((row) => {
        const isProjectOwner = Number(row.project_owner) === Number(req.userId);
        const isProjectAdmin = row.user_project_role === 'Admin' || row.user_project_role === 'Owner';
        const adminsCanApprove = row.admins_can_approve !== null ? row.admins_can_approve : true;
        const onlyOwnerApproves = row.only_owner_approves !== null ? row.only_owner_approves : false;
        const canApprove = isProjectOwner || (!onlyOwnerApproves && adminsCanApprove && isProjectAdmin);
        return !canApprove;
      });

      if (notAllowed) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Insufficient permissions to approve or reject tasks' });
      }
    }

    // Build update query
    const updateFields = [];
    const params = [task_ids];
    let paramIndex = 2;
    let stageParamIndex = null;

    if (normalizedUpdates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}::text`);
      params.push(normalizedUpdates.status);
      paramIndex++;
    }
    if (normalizedUpdates.stage !== undefined) {
      stageParamIndex = paramIndex;
      updateFields.push(`stage = $${paramIndex}::text`);
      params.push(normalizedUpdates.stage);
      paramIndex++;
    }

    const shouldAutoSyncStatus = normalizedUpdates.status === undefined
      && normalizedUpdates.stage !== undefined
      && stageParamIndex !== null;

    if (shouldAutoSyncStatus) {
      updateFields.push(`status = CASE
        WHEN status = 'Closed' AND $${stageParamIndex}::text IN ('Planned', 'In-process') THEN 'Open'
        WHEN status IN ('Pending Approval', 'Rejected') AND $${stageParamIndex}::text <> 'Completed' THEN 'Open'
        WHEN $${stageParamIndex}::text = 'Planned' THEN 'Open'
        WHEN $${stageParamIndex}::text = 'In-process' THEN CASE WHEN status IN ('Closed', 'auto_closed') THEN status ELSE 'In Progress' END
        WHEN $${stageParamIndex}::text = 'On-hold' THEN CASE WHEN status IN ('Closed', 'auto_closed') THEN status ELSE 'Blocked' END
        WHEN $${stageParamIndex}::text = 'Completed' THEN CASE WHEN status IN ('Closed', 'auto_closed') THEN status ELSE 'Pending Approval' END
        ELSE status
      END`);
    }
    if (normalizedUpdates.priority !== undefined) {
      updateFields.push(`priority = $${paramIndex}::text`);
      params.push(normalizedUpdates.priority);
      paramIndex++;
    }
    if (normalizedUpdates.assignee_id !== undefined) {
      updateFields.push(`assignee_id = $${paramIndex}::int`);
      params.push(normalizedUpdates.assignee_id);
      paramIndex++;
    }
    if (normalizedUpdates.due_date !== undefined) {
      updateFields.push(`due_date = $${paramIndex}::date`);
      params.push(normalizedUpdates.due_date);
      paramIndex++;
    }
    if (normalizedUpdates.target_date !== undefined) {
      updateFields.push(`target_date = $${paramIndex}::date`);
      params.push(normalizedUpdates.target_date);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const updateQuery = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = ANY($1::int[])
      RETURNING *
    `;

    const result = await client.query(updateQuery, params);

    await client.query('COMMIT');
    res.json({ updated: result.rows.length, tasks: result.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk update error:', err);
    res.status(500).json({ error: 'Failed to bulk update tasks' });
  } finally {
    client.release();
  }
});

// Get tasks for a project
router.get('/project/:projectId', async (req, res) => {
  const includeArchived = req.query.include_archived === 'true';
  
  try {
    const archiveCondition = includeArchived ? '' : 'AND t.archived_at IS NULL';
    const result = await pool.query(`
      SELECT t.*,
        s.name as service_name,
        s.category as service_category,
        COALESCE(task_client.client_name, pc_client.client_name) as client_name,
        COALESCE(task_client.legal_name, pc_client.legal_name) as client_legal_name,
        COALESCE(task_client.series_no, pc_client.series_no) as client_series_no,
        COALESCE(t.client_id, pc_client.client_id) as client_id,
        u.first_name || ' ' || u.last_name as assignee_name,
        u.username as assignee_username,
        COALESCE(creator.first_name || ' ' || creator.last_name, 'Unknown User') as created_by_name,
        COALESCE(
          (SELECT array_agg(DISTINCT tpl.project_id)
           FROM task_project_links tpl
           WHERE tpl.task_id = t.id),
          ARRAY[]::int[]
        ) as linked_project_ids,
        COALESCE((SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id AND tc.deleted_at IS NULL), 0) as comments_count,
        COALESCE((SELECT COUNT(*) FROM task_reminders tr WHERE tr.task_id = t.id), 0) as reminders_count,
        (SELECT json_agg(json_build_object('id', u2.id, 'name', u2.first_name || ' ' || u2.last_name))
         FROM task_collaborators tc
         JOIN users u2 ON tc.user_id = u2.id
         WHERE tc.task_id = t.id) as collaborators
      FROM tasks t
      LEFT JOIN services s ON s.id = t.service_id
      LEFT JOIN clients task_client ON task_client.id = t.client_id
      LEFT JOIN LATERAL (
        SELECT c.id as client_id, c.client_name, c.legal_name, c.series_no
        FROM project_clients pc
        JOIN clients c ON c.id = pc.client_id
        WHERE pc.project_id = t.project_id
        ORDER BY pc.is_primary DESC, pc.id ASC
        LIMIT 1
      ) pc_client ON true
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE (
        t.project_id = $1
        OR EXISTS (
          SELECT 1
          FROM task_project_links tpl
          WHERE tpl.task_id = t.id AND tpl.project_id = $1
        )
      )
      AND t.deleted_at IS NULL ${archiveCondition}
      ORDER BY t.created_at DESC
    `, [req.params.projectId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/', async (req, res) => {
  console.log('[Task Create] Request received:', {
    userId: req.userId,
    body: req.body,
  });
  
  const {
    name,
    description,
    project_id,
    assignee_id,
    service_id,
    worked_hours,
    start_time,
    end_time,
    client_id,
    clientId,
    stage = 'Planned',
    status = 'Not started',
    priority = 'Medium',
    due_date,
    target_date,
    notes,
    category,
    section,
    estimated_hours,
    actual_hours,
    completion_percentage,
    tags,
    external_id,
    estimatedHours,
    actualHours,
    completionPercentage,
    externalId,
  } = req.body;

  const normalizedEstimatedHours = normalizeNumericInput(estimated_hours ?? estimatedHours);
  const normalizedActualHours = normalizeNumericInput(actual_hours ?? actualHours);
  const normalizedCompletionPercentage = normalizeNumericInput(completion_percentage ?? completionPercentage);
  const normalizedWorkedHours = normalizeNumericInput(worked_hours);
  const normalizedServiceId = normalizeNumericInput(service_id);
  const normalizedExternalId = external_id ?? externalId ?? null;
  const normalizedTags = Array.isArray(tags) ? tags : null;
  const requestedClientId = normalizeClientIdInput(client_id ?? clientId);
  const {
    ids: collaboratorIds,
  } = normalizeUserIdsInput(req.body.collaborator_ids ?? req.body.collaborators);
  const rawLinkedProjectIds = req.body.linked_project_ids ?? req.body.linkedProjectIds;
  const {
    ids: linkedProjectIds,
    error: linkedProjectIdsError,
  } = normalizeLinkedProjectIds(rawLinkedProjectIds);
  
  if (!name || !project_id) {
    return res.status(400).json({ error: 'Name and project_id are required' });
  }
  if (linkedProjectIdsError) {
    return res.status(400).json({ error: linkedProjectIdsError });
  }

  let client;
  try {
    console.log('[Task Create] Getting database connection...');
    client = await pool.connect();
    console.log('[Task Create] Got database connection');
    
    console.log('[Task Create] Beginning transaction...');
    await client.query('BEGIN');
    console.log('[Task Create] Transaction started');

    console.log('[Task Create] Fetching project metadata for project_id:', project_id);
    const projectMetaRes = await client.query(
      `SELECT p.workspace_id,
              p.enable_multi_project_links,
              p.members_can_create_tasks,
              p.created_by,
              pm.role
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = $2
       WHERE p.id = $1`,
      [project_id, req.userId]
    );
    console.log('[Task Create] Project metadata fetched:', projectMetaRes.rows.length, 'rows');
    if (projectMetaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    const {
      workspace_id: workspaceId,
      enable_multi_project_links: allowMultiProjectLinks,
      members_can_create_tasks: membersCanCreateTasks,
      created_by: projectOwnerId,
      role: projectRole,
    } = projectMetaRes.rows[0];
    const isProjectOwner = Number(projectOwnerId) === Number(req.userId);
    const normalizedRole = (projectRole || '').toLowerCase();

    if (!isProjectOwner && !projectRole) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    if (!isProjectOwner && membersCanCreateTasks === false && normalizedRole !== 'admin' && normalizedRole !== 'owner') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Members cannot create tasks in this project' });
    }
    const filteredLinkedProjectIds = (linkedProjectIds || [])
      .filter((id) => Number(id) !== Number(project_id));

    if (filteredLinkedProjectIds.length > 0 && !allowMultiProjectLinks) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Multi-project linking is disabled for this project' });
    }

    console.log('[Task Create] Checking linked projects access...');
    await ensureLinkedProjectsAccessible(client, {
      workspaceId,
      userId: req.userId,
      projectIds: filteredLinkedProjectIds,
    });
    console.log('[Task Create] Linked projects access OK');
    await ensureProjectMembersAccessible(client, {
      projectId: project_id,
      userIds: collaboratorIds,
    });

    console.log('[Task Create] Resolving client ID...');
    const resolvedClientId = requestedClientId
      ? await validateProjectClientLink(client, project_id, requestedClientId)
      : await getPrimaryProjectClientId(client, project_id);
    console.log('[Task Create] Client ID resolved:', resolvedClientId);
    
    // Generate unique task code for this workspace
    console.log('[Task Create] Generating task code...');
    const taskCodeResult = await client.query(
      'SELECT generate_task_code($1) as task_code',
      [project_id]
    );
    const taskCode = taskCodeResult.rows[0].task_code;
    console.log('[Task Create] Task code generated:', taskCode);
    
    console.log('[Task Create] Inserting task into database...');
    const taskResult = await client.query(
      `INSERT INTO tasks 
       (name, description, project_id, assignee_id, service_id, stage, status, priority, due_date, target_date, notes, category, section, estimated_hours, actual_hours, completion_percentage, tags, external_id, client_id, task_code, created_by, worked_hours, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING *`,
      [
        name,
        description,
        project_id,
        assignee_id,
        normalizedServiceId,
        stage,
        status,
        priority,
        due_date,
        target_date,
        notes,
        category,
        section,
        normalizedEstimatedHours,
        normalizedActualHours,
        normalizedCompletionPercentage,
        normalizedTags,
        normalizedExternalId,
        resolvedClientId,
        taskCode,
        req.userId,
        normalizedWorkedHours,
        start_time || null,
        end_time || null,
      ]
    );
    
    const task = taskResult.rows[0];

    await syncTaskProjectLinks(client, task.id, filteredLinkedProjectIds, req.userId);
    await syncTaskCollaborators(client, task.id, collaboratorIds);
    task.linked_project_ids = filteredLinkedProjectIds;
    task.collaborators = collaboratorIds;
    
    await client.query(
      'INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [req.userId, workspaceId, project_id, task.id, 'Task', 'Created', name, `Created task "${name}"`]
    );
    
    // If task status is Pending Approval, create an approval request (if one doesn't exist)
    try {
      const shouldCreateApproval = String(status).toLowerCase().includes('pending');
      if (shouldCreateApproval) {
        // Check if approval already exists for this task
        const existingApproval = await client.query(
          'SELECT id FROM approvals WHERE task_id = $1 AND status = $2',
          [task.id, 'Pending']
        );
        if (existingApproval.rows.length === 0) {
          await client.query(
            'INSERT INTO approvals (type, task_id, project_id, requester_id, reason, details) VALUES ($1, $2, $3, $4, $5, $6)',
            ['task', task.id, project_id, req.userId, 'Task completion approval', `Approval requested for task ${task.name}`]
          );
        }
      }
    } catch (err) {
      console.error('Failed to create approval for task creation:', err);
      // don't fail the whole request for approval insertion errors
    }
    
      await client.query('COMMIT');
      
      // Send notification AFTER commit so task exists in database
      try {
        const creatorNotification = await notificationService.createNotification({
          userId: req.userId,
          type: notificationService.NOTIFICATION_TYPES.TASK_CREATED,
          title: 'Task Created',
          message: `You created "${name}"`,
          workspaceId,
          projectId: project_id,
          taskId: task.id,
          senderId: null,
          metadata: {
            task_name: name,
            created_by_self: true,
          },
        });
        if (!creatorNotification) {
          await insertMinimalNotification(pool, {
            userId: req.userId,
            type: notificationService.NOTIFICATION_TYPES.TASK_CREATED,
            title: 'Task Created',
            message: `You created "${name}"`,
            projectId: project_id,
            taskId: task.id,
          });
        }

        if (assignee_id && assignee_id !== req.userId) {
          const assigneeNotification = await notificationService.notifyTaskAssigned({
              taskId: task.id,
              taskName: name,
              assigneeId: assignee_id,
            assignerId: req.userId,
            projectId: project_id,
            workspaceId: workspaceId,
          });
          if (!assigneeNotification) {
            await insertMinimalNotification(pool, {
              userId: assignee_id,
              type: notificationService.NOTIFICATION_TYPES.TASK_ASSIGNED,
              title: 'Task Assigned',
              message: `You were assigned "${name}"`,
              projectId: project_id,
              taskId: task.id,
            });
          }
        }
        const followers = await notificationService.getTaskFollowers(task.id, req.userId);
        if (followers.length > 0) {
          await notificationService.notifyTaskCreated({
            taskId: task.id,
          taskName: name,
          creatorId: req.userId,
          projectId: project_id,
          workspaceId,
          followers,
        });
      }
    } catch (notifErr) {
      console.error('Failed to send task creation notifications:', notifErr);
      // Don't fail the request for notification errors
    }
    
    res.status(201).json(task);
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
    }
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Create task error:', err);
    console.error('Create task error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      where: err.where,
      table: err.table,
      column: err.column,
      constraint: err.constraint
    });
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Update task
router.put('/:taskId', async (req, res) => {
  const {
    name,
    description,
    assignee_id,
    service_id,
    worked_hours,
    start_time,
    end_time,
    client_id,
    clientId,
    stage,
    status,
    priority,
    due_date,
    target_date,
    notes,
    category,
    section,
    estimated_hours,
    actual_hours,
    completion_percentage,
    tags,
    external_id,
    estimatedHours,
    actualHours,
    completionPercentage,
    externalId,
  } = req.body;

  const normalizedEstimatedHours = normalizeNumericInput(estimated_hours ?? estimatedHours);
  const normalizedActualHours = normalizeNumericInput(actual_hours ?? actualHours);
  const normalizedCompletionPercentage = normalizeNumericInput(completion_percentage ?? completionPercentage);
  const normalizedWorkedHours = normalizeNumericInput(worked_hours);
  const normalizedServiceId = normalizeNumericInput(service_id);
  const normalizedExternalId = external_id ?? externalId ?? null;
  const normalizedTags = Array.isArray(tags) ? tags : null;
  const hasClientId = Object.prototype.hasOwnProperty.call(req.body, 'client_id')
    || Object.prototype.hasOwnProperty.call(req.body, 'clientId');
  const rawCollaboratorIds = req.body.collaborator_ids ?? req.body.collaborators;
  const {
    ids: collaboratorIds,
  } = normalizeUserIdsInput(rawCollaboratorIds);
  const hasCollaboratorUpdate = rawCollaboratorIds !== undefined;
  const rawLinkedProjectIds = req.body.linked_project_ids ?? req.body.linkedProjectIds;
  const {
    ids: linkedProjectIds,
    error: linkedProjectIdsError,
  } = normalizeLinkedProjectIds(rawLinkedProjectIds);
  const hasLinkedProjectUpdate = rawLinkedProjectIds !== undefined;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (linkedProjectIdsError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: linkedProjectIdsError });
    }

    const accessRes = await client.query(
      `SELECT t.id, t.project_id, t.assignee_id, t.due_date, t.name as current_name,
        t.status,
        t.stage,
        COALESCE(
          (
            SELECT array_agg(tc.user_id ORDER BY tc.user_id)
            FROM task_collaborators tc
            WHERE tc.task_id = t.id
          ),
          ARRAY[]::int[]
        ) AS collaborator_ids,
        p.created_by AS project_owner,
        p.workspace_id,
        p.admins_can_approve,
        p.only_owner_approves,
        p.enable_multi_project_links,
        pm_primary.role as primary_role,
        (SELECT pm.role
         FROM task_project_links tpl
         JOIN project_members pm
           ON pm.project_id = tpl.project_id AND pm.user_id = $2
         WHERE tpl.task_id = t.id
         ORDER BY CASE pm.role
           WHEN 'Owner' THEN 3
           WHEN 'Admin' THEN 2
           ELSE 1
         END DESC
         LIMIT 1) as linked_role
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm_primary ON pm_primary.project_id = p.id AND pm_primary.user_id = $2
       WHERE t.id = $1`,
      [req.params.taskId, req.userId]
    );

    if (accessRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

    const access = accessRes.rows[0];
    const isProjectOwner = Number(access.project_owner) === Number(req.userId);
    const primaryRole = access.primary_role;
    const linkedRole = access.linked_role;
    const userProjectRole = primaryRole || linkedRole;
    const isProjectAdmin = primaryRole === 'Admin' || primaryRole === 'Owner';
    const adminsCanApprove = access.admins_can_approve !== null ? access.admins_can_approve : true;
    const onlyOwnerApproves = access.only_owner_approves !== null ? access.only_owner_approves : false;
    const canApprove = isProjectOwner || (!onlyOwnerApproves && adminsCanApprove && isProjectAdmin);

    if (!isProjectOwner && !userProjectRole) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied to this task' });
    }

    const allowMultiProjectLinks = access.enable_multi_project_links ?? false;
    const filteredLinkedProjectIds = hasLinkedProjectUpdate
      ? (linkedProjectIds || []).filter((id) => Number(id) !== Number(access.project_id))
      : null;

    if (hasLinkedProjectUpdate && filteredLinkedProjectIds.length > 0 && !allowMultiProjectLinks) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Multi-project linking is disabled for this project' });
    }

    if (hasCollaboratorUpdate) {
      await ensureProjectMembersAccessible(client, {
        projectId: access.project_id,
        userIds: collaboratorIds,
      });
    }

    if (hasLinkedProjectUpdate) {
      const workspaceRes = await client.query(
        'SELECT workspace_id FROM projects WHERE id = $1',
        [access.project_id]
      );
      if (workspaceRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Project not found' });
      }
      await ensureLinkedProjectsAccessible(client, {
        workspaceId: workspaceRes.rows[0].workspace_id,
        userId: req.userId,
        projectIds: filteredLinkedProjectIds,
      });
    }

    const inferredStatus = status === undefined
      ? inferStatusForStageChange({ newStage: stage, currentStatus: access.status })
      : null;
    const effectiveStatus = status !== undefined ? status : inferredStatus;
    const requestedStatus = typeof effectiveStatus === 'string' ? effectiveStatus.toLowerCase() : null;
    const isApprovalStatus = requestedStatus === 'closed' || requestedStatus === 'rejected';
    if (isApprovalStatus && !canApprove) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Insufficient permissions to approve or reject this task' });
    }

    // Feature 5: Check if auto-approve is enabled for owner/admin
    // Get project settings for auto-approve
    const projectSettingsRes = await client.query(
      `SELECT p.auto_approve_owner_tasks, p.auto_approve_admin_tasks, p.task_approval_required,
              w.is_personal, w.name as workspace_name, w.created_by as workspace_owner
       FROM projects p
       JOIN workspaces w ON p.workspace_id = w.id
       WHERE p.id = $1`,
      [access.project_id]
    );
    const projectSettings = projectSettingsRes.rows[0] || {};
    const autoApproveOwnerTasks = projectSettings.auto_approve_owner_tasks ?? false;
    const autoApproveAdminTasks = projectSettings.auto_approve_admin_tasks ?? false;
    const taskApprovalRequired = projectSettings.task_approval_required ?? true;
    
    // Check if this is a personal workspace (skip approval for personal workspaces)
    const isPersonalWorkspace = projectSettings.is_personal === true || 
      (projectSettings.workspace_name === 'Personal' && Number(projectSettings.workspace_owner) === Number(req.userId));

    // Determine if task should be auto-approved
    let finalStatus = effectiveStatus ?? null;
    let shouldAutoApprove = false;
    
    // If status is being set to Completed/Pending Approval and auto-approve conditions are met
    if (requestedStatus === 'completed' || requestedStatus === 'pending approval' || requestedStatus === 'pending') {
      if (isPersonalWorkspace) {
        // Personal workspace: skip approval entirely, go directly to Closed
        finalStatus = 'Closed';
        shouldAutoApprove = true;
      } else if (!taskApprovalRequired) {
        // If approval not required, auto-close the task
        finalStatus = 'Closed';
        shouldAutoApprove = true;
      } else if (isProjectOwner && autoApproveOwnerTasks) {
        // Auto-approve if owner is completing and auto-approve owner tasks is enabled
        finalStatus = 'Closed';
        shouldAutoApprove = true;
      } else if (isProjectAdmin && autoApproveAdminTasks && !isProjectOwner) {
        // Auto-approve if admin is completing and auto-approve admin tasks is enabled
        finalStatus = 'Closed';
        shouldAutoApprove = true;
      }
    }

    let resolvedClientId = null;
    if (hasClientId) {
      const requestedClientId = normalizeClientIdInput(client_id ?? clientId);
      resolvedClientId = requestedClientId
        ? await validateProjectClientLink(client, access.project_id, requestedClientId)
        : null;
    }
    
    // Auto-archive when task is closed
    const shouldArchive = finalStatus && finalStatus.toLowerCase() === 'closed';
    
    const result = await client.query(
      `UPDATE tasks 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           assignee_id = COALESCE($3, assignee_id),
           stage = COALESCE($4, stage),
           status = COALESCE($5, status),
           priority = COALESCE($6, priority),
           due_date = COALESCE($7, due_date),
           target_date = COALESCE($8, target_date),
           notes = COALESCE($9, notes),
           category = COALESCE($10, category),
           section = COALESCE($11, section),
           estimated_hours = COALESCE($12, estimated_hours),
           actual_hours = COALESCE($13, actual_hours),
           completion_percentage = COALESCE($14, completion_percentage),
           tags = COALESCE($15, tags),
           external_id = COALESCE($16, external_id),
           client_id = CASE WHEN $18 THEN $17 ELSE client_id END,
           service_id = COALESCE($19, service_id),
           worked_hours = COALESCE($20, worked_hours),
           start_time = COALESCE($21, start_time),
           end_time = COALESCE($22, end_time),
           archived_at = CASE WHEN $24 THEN CURRENT_TIMESTAMP ELSE archived_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $23
       RETURNING *`,
      [
        name,
        description,
        assignee_id,
        stage ?? null,
        finalStatus ?? null,  // Use finalStatus which may be auto-approved
        priority,
        due_date,
        target_date,
        notes,
        category,
        section,
        normalizedEstimatedHours,
        normalizedActualHours,
        normalizedCompletionPercentage,
        normalizedTags,
        normalizedExternalId,
        resolvedClientId,
        hasClientId,
        normalizedServiceId,
        normalizedWorkedHours,
        start_time || null,
        end_time || null,
        req.params.taskId,
        shouldArchive,
      ]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = result.rows[0];

    if (hasLinkedProjectUpdate) {
      await syncTaskProjectLinks(client, task.id, filteredLinkedProjectIds, req.userId);
      task.linked_project_ids = filteredLinkedProjectIds;
    }
    if (hasCollaboratorUpdate) {
      await syncTaskCollaborators(client, task.id, collaboratorIds);
      task.collaborator_ids = collaboratorIds;
    }
    
    const projectResult = await client.query(
      'SELECT workspace_id FROM projects WHERE id = $1',
      [task.project_id]
    );
    
    await client.query(
      'INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [req.userId, projectResult.rows[0].workspace_id, task.project_id, task.id, 'Task', 'Updated', task.name, `Updated task "${task.name}"`]
    );
    // If task status is Pending Approval, create an approval request (if one doesn't exist)
    try {
      const shouldCreateApproval = String(task.status).toLowerCase().includes('pending');
      if (shouldCreateApproval) {
        // Check if approval already exists for this task
        const existingApproval = await client.query(
          'SELECT id FROM approvals WHERE task_id = $1 AND status = $2',
          [task.id, 'Pending']
        );
        if (existingApproval.rows.length === 0) {
          const approvalResult = await client.query(
            'INSERT INTO approvals (type, task_id, project_id, requester_id, reason, details) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            ['task', task.id, task.project_id, req.userId, 'Task completion approval', `Approval requested for task ${task.name}`]
          );
          
          // Notify approvers about the new approval request
          const approverIds = await notificationService.getProjectApprovers(task.project_id);
          await notificationService.notifyApprovalRequested({
            approvalId: approvalResult.rows[0].id,
            taskId: task.id,
            taskName: task.name,
            requesterId: req.userId,
            projectId: task.project_id,
            workspaceId: access.workspace_id,
            approverIds: approverIds.filter(id => id !== req.userId),
          });
        }
      }
    } catch (err) {
      console.error('Failed to create approval for task update:', err);
    }
    
    // Send notifications for task changes
    try {
      const oldAssigneeId = access.assignee_id;
      const newAssigneeId = task.assignee_id;
      const oldDueDate = access.due_date;
      const newDueDate = task.due_date;
      const previousCollaboratorIds = Array.isArray(access.collaborator_ids) ? access.collaborator_ids.map(Number) : [];
      const currentCollaboratorIds = hasCollaboratorUpdate ? collaboratorIds : previousCollaboratorIds;
      const addedCollaboratorIds = currentCollaboratorIds.filter((id) => !previousCollaboratorIds.includes(id));
      const changeFragments = [];
      
      // Notify when assignee changes
      if (assignee_id !== undefined && oldAssigneeId !== newAssigneeId) {
        changeFragments.push(newAssigneeId ? 'assignee updated' : 'assignee removed');
        // Notify old assignee they were unassigned
        if (oldAssigneeId && oldAssigneeId !== req.userId) {
          await notificationService.notifyTaskUnassigned({
            taskId: task.id,
            taskName: task.name,
            previousAssigneeId: oldAssigneeId,
            unassignerId: req.userId,
            projectId: task.project_id,
            workspaceId: access.workspace_id,
          });
        }
        
        // Notify new assignee they were assigned
        if (newAssigneeId && newAssigneeId !== req.userId) {
          const assigneeNotification = await notificationService.notifyTaskAssigned({
            taskId: task.id,
            taskName: task.name,
            assigneeId: newAssigneeId,
            assignerId: req.userId,
            projectId: task.project_id,
            workspaceId: access.workspace_id,
          });
          if (!assigneeNotification) {
            await insertMinimalNotification(pool, {
              userId: newAssigneeId,
              type: notificationService.NOTIFICATION_TYPES.TASK_ASSIGNED,
              title: 'Task Assigned',
              message: `You were assigned "${task.name}"`,
              projectId: task.project_id,
              taskId: task.id,
            });
          }
        }
      }
      
      // Notify assignee when due date changes
      if (due_date !== undefined && String(oldDueDate) !== String(newDueDate) && newAssigneeId && newAssigneeId !== req.userId) {
        changeFragments.push('due date changed');
        await notificationService.notifyTaskDueDateChanged({
          taskId: task.id,
          taskName: task.name,
          assigneeId: newAssigneeId,
          changerId: req.userId,
          oldDueDate: oldDueDate,
          newDueDate: newDueDate,
          projectId: task.project_id,
          workspaceId: access.workspace_id,
        });
      }

      if (name !== undefined && String(access.current_name || '') !== String(task.name || '')) {
        changeFragments.push('title updated');
      }
      if (status !== undefined && String(access.status || '') !== String(task.status || '')) {
        changeFragments.push(`status set to ${task.status}`);
      }
      if (stage !== undefined && String(access.stage || '') !== String(task.stage || '')) {
        changeFragments.push(`stage moved to ${task.stage}`);
      }
      if (service_id !== undefined) {
        changeFragments.push('service updated');
      }
      if (worked_hours !== undefined || start_time !== undefined || end_time !== undefined) {
        changeFragments.push('work log details updated');
      }
      if (hasCollaboratorUpdate && addedCollaboratorIds.length > 0) {
        changeFragments.push(`collaborators added (${addedCollaboratorIds.length})`);
      }

      for (const collaboratorId of addedCollaboratorIds) {
        if (collaboratorId !== req.userId) {
          await notificationService.notifyTaskCollaboratorAdded({
            taskId: task.id,
            taskName: task.name,
            collaboratorId,
            adderId: req.userId,
            projectId: task.project_id,
            workspaceId: access.workspace_id,
          });
        }
      }
      
      // Notify followers when task is marked complete
      if (finalStatus && (finalStatus.toLowerCase() === 'closed' || finalStatus.toLowerCase() === 'completed')) {
        const followers = await notificationService.getTaskFollowers(task.id, req.userId);
        await notificationService.notifyTaskCompleted({
          taskId: task.id,
          taskName: task.name,
          completerId: req.userId,
          projectId: task.project_id,
          workspaceId: access.workspace_id,
          followers,
        });
      }
      
      // Check for @mentions in description
      if (description) {
        const mentionedUserIds = notificationService.parseMentionsFromText(description);
        for (const mentionedUserId of mentionedUserIds) {
          if (mentionedUserId !== req.userId) {
            await notificationService.notifyTaskMentioned({
              taskId: task.id,
              taskName: task.name,
              mentionedUserId,
              mentionerId: req.userId,
              projectId: task.project_id,
              workspaceId: access.workspace_id,
              context: 'description',
            });
          }
        }
      }

      if (changeFragments.length > 0) {
        const followers = await notificationService.getTaskFollowers(task.id, req.userId);
        if (followers.length > 0) {
          await notificationService.notifyTaskStatusChanged({
            taskId: task.id,
            taskName: task.name,
            changerId: req.userId,
            projectId: task.project_id,
            workspaceId: access.workspace_id,
            followers,
            title: 'Task Updated',
            message: changeFragments.join(', '),
            metadata: { changes: changeFragments },
          });
        }
      }
    } catch (notifErr) {
      console.error('Failed to send task update notifications:', notifErr);
    }
    
    await client.query('COMMIT');
    
    res.json(task);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  } finally {
    client.release();
  }
});

router.get('/:taskId/details', async (req, res) => {
  try {
    const task = await getTaskDetailById(pool, req.params.taskId, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    console.error('Get task details error:', err);
    res.status(500).json({ error: 'Failed to fetch task details' });
  }
});

router.get('/:taskId/comments', async (req, res) => {
  try {
    const task = await getTaskDetailById(pool, req.params.taskId, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task.comments || []);
  } catch (err) {
    console.error('Get task comments error:', err);
    res.status(500).json({ error: 'Failed to fetch task comments' });
  }
});

router.post('/:taskId/comments', async (req, res) => {
  const comment = String(req.body.comment || '').trim();
  if (!comment) {
    return res.status(400).json({ error: 'Comment is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const task = await getTaskDetailById(client, req.params.taskId, req.userId);
    if (!task) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

    const insertResult = await client.query(
      `INSERT INTO task_comments (task_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.taskId, req.userId, comment]
    );

    await client.query(
      `INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, type, action, item_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.userId, task.workspace_id, task.project_id, task.id, 'Task', 'Comment Added', task.name, 'Added a task comment']
    );

    await client.query('COMMIT');

    const followers = await notificationService.getTaskFollowers(task.id, req.userId);
    await notificationService.notifyTaskComment({
      taskId: task.id,
      taskName: task.name,
      commentPreview: comment,
      commenterId: req.userId,
      projectId: task.project_id,
      workspaceId: task.workspace_id,
      followers,
    });

    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add task comment error:', err);
    res.status(500).json({ error: 'Failed to add task comment' });
  } finally {
    client.release();
  }
});

router.put('/:taskId/comments/:commentId', async (req, res) => {
  const comment = String(req.body.comment || '').trim();
  if (!comment) {
    return res.status(400).json({ error: 'Comment is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE task_comments
       SET comment = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND task_id = $3
         AND deleted_at IS NULL
         AND (user_id = $4 OR EXISTS (
           SELECT 1
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $4
           WHERE t.id = $3 AND (p.created_by = $4 OR pm.role IN ('Owner', 'Admin'))
         ))
       RETURNING *`,
      [comment, req.params.commentId, req.params.taskId, req.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Comment not found or not editable' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update task comment error:', err);
    res.status(500).json({ error: 'Failed to update task comment' });
  }
});

router.delete('/:taskId/comments/:commentId', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE task_comments
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND task_id = $2
         AND deleted_at IS NULL
         AND (user_id = $3 OR EXISTS (
           SELECT 1
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $3
           WHERE t.id = $2 AND (p.created_by = $3 OR pm.role IN ('Owner', 'Admin'))
         ))
       RETURNING id`,
      [req.params.commentId, req.params.taskId, req.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Comment not found or not removable' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete task comment error:', err);
    res.status(500).json({ error: 'Failed to delete task comment' });
  }
});

router.get('/:taskId/worklogs', async (req, res) => {
  try {
    const task = await getTaskDetailById(pool, req.params.taskId, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task.work_logs || []);
  } catch (err) {
    console.error('Get task work logs error:', err);
    res.status(500).json({ error: 'Failed to fetch task work logs' });
  }
});

router.post('/:taskId/worklogs', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const task = await getTaskDetailById(client, req.params.taskId, req.userId);
    if (!task) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

    const canLogForOthers = ['Owner', 'Admin', 'ProjectAdmin'].includes(await getWorkspaceRole(client, task.workspace_id, req.userId));
    const targetUserId = normalizeNumericInput(req.body.user_id) || req.userId;
    if (targetUserId !== req.userId && !canLogForOthers) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only log your own work' });
    }

    const payload = normalizeWorkLogInput(req.body || {});
    const result = await client.query(
      `INSERT INTO task_work_logs (task_id, user_id, work_date, start_time, end_time, hours, notes)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7)
       RETURNING *`,
      [req.params.taskId, targetUserId, payload.work_date, payload.start_time, payload.end_time, payload.hours, payload.notes]
    );

    await syncTaskWorkedHours(client, req.params.taskId);
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add task work log error:', err);
    res.status(500).json({ error: 'Failed to add work log' });
  } finally {
    client.release();
  }
});

router.get('/:taskId/reminders', async (req, res) => {
  try {
    const task = await getTaskDetailById(pool, req.params.taskId, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task.reminders || []);
  } catch (err) {
    console.error('Get task reminders error:', err);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

router.post('/:taskId/reminders', async (req, res) => {
  const recipientIds = Array.isArray(req.body.recipient_ids) ? req.body.recipient_ids.map(Number).filter(Number.isInteger) : [];
  const message = String(req.body.message || '').trim();
  const deliveryChannels = Array.isArray(req.body.delivery_channels) && req.body.delivery_channels.length
    ? req.body.delivery_channels
    : ['in_app'];

  if (!recipientIds.length) {
    return res.status(400).json({ error: 'At least one recipient is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const task = await getTaskDetailById(client, req.params.taskId, req.userId);
    if (!task) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

      const workspaceMemberCheck = await client.query(
        `SELECT wm.user_id, u.email,
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS name
         FROM workspace_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = $1 AND wm.user_id = ANY($2::int[])`,
        [task.workspace_id, recipientIds]
      );
      const validRecipients = workspaceMemberCheck.rows;
      const validRecipientIds = validRecipients.map((row) => row.user_id);
      if (!validRecipientIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No valid recipients found in workspace' });
      }

    const values = [];
    const placeholders = validRecipientIds.map((recipientId, index) => {
      const base = index * 5;
      values.push(task.id, req.userId, recipientId, message || null, JSON.stringify(deliveryChannels));
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb)`;
    });

    await client.query(
      `INSERT INTO task_reminders (task_id, sender_id, recipient_id, message, delivery_channels)
       VALUES ${placeholders.join(', ')}`,
      values
    );

      await client.query(
        'UPDATE tasks SET last_reminder_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [task.id]
      );

      await client.query('COMMIT');

      const shouldSendEmail = deliveryChannels.includes('email');
      const emailResults = await Promise.all(validRecipients.map(async (recipient) => {
        if (!shouldSendEmail || !recipient.email) {
          return {
            recipient_id: recipient.user_id,
            email: recipient.email || null,
            delivered: false,
            status: shouldSendEmail ? 'missing_email' : 'skipped',
          };
        }

        try {
          const emailText = message || `Reminder for task "${task.name}"`;
          const mailResult = await sendMail({
            to: recipient.email,
            subject: `Task reminder: ${task.name}`,
            text: `${emailText}\n\nTask: ${task.name}\nProject: ${task.project_name || 'N/A'}\nDue date: ${task.due_date || 'Not set'}`,
            html: `
              <p>${emailText}</p>
              <p><strong>Task:</strong> ${task.name}</p>
              <p><strong>Project:</strong> ${task.project_name || 'N/A'}</p>
              <p><strong>Due date:</strong> ${task.due_date || 'Not set'}</p>
            `,
          });
          return {
            recipient_id: recipient.user_id,
            email: recipient.email,
            delivered: mailResult.delivered,
            status: mailResult.status,
          };
        } catch (mailErr) {
          console.error('Task reminder email failed:', mailErr);
          return {
            recipient_id: recipient.user_id,
            email: recipient.email,
            delivered: false,
            status: 'failed',
          };
        }
      }));

      await Promise.all(validRecipientIds.map((recipientId) =>
        notificationService.createNotification({
          userId: recipientId,
          senderId: req.userId,
          type: notificationService.NOTIFICATION_TYPES.TASK_MENTIONED,
          title: 'Task Reminder',
          message: message || `Reminder for task "${task.name}"`,
          workspaceId: task.workspace_id,
          projectId: task.project_id,
          taskId: task.id,
          metadata: {
            reminder: true,
            delivery_channels: deliveryChannels,
            email_results: emailResults,
          },
        })
      ));

      res.status(201).json({
        success: true,
        recipients: validRecipientIds.length,
        email_results: emailResults,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Send task reminder error:', err);
      res.status(500).json({ error: 'Failed to send reminder' });
  } finally {
    client.release();
  }
});

// Delete task (soft delete)
router.delete('/:taskId', async (req, res) => {
  try {
    const accessRes = await pool.query(
      `SELECT t.id,
        p.created_by AS project_owner,
        pm.role as user_project_role
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [req.params.taskId, req.userId]
    );

    if (accessRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or already deleted' });
    }

    const access = accessRes.rows[0];
    const isProjectOwner = Number(access.project_owner) === Number(req.userId);
    const isProjectAdmin = access.user_project_role === 'Admin' || access.user_project_role === 'Owner';

    if (!isProjectOwner && !isProjectAdmin) {
      return res.status(403).json({ error: 'Only project owners and admins can delete tasks' });
    }

    const result = await pool.query(
      'UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *', 
      [req.params.taskId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or already deleted' });
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Add collaborator to task
router.post('/:taskId/collaborators', async (req, res) => {
  const { user_id } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const taskResult = await client.query(
      `SELECT t.id, t.name, t.project_id, p.workspace_id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [req.params.taskId]
    );

    if (!taskResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];
    await ensureProjectMembersAccessible(client, {
      projectId: task.project_id,
      userIds: [Number(user_id)],
    });

    await client.query(
      'INSERT INTO task_collaborators (task_id, user_id) VALUES ($1, $2)',
      [req.params.taskId, user_id]
    );

    await client.query('COMMIT');

    if (Number(user_id) !== Number(req.userId)) {
      await notificationService.notifyTaskCollaboratorAdded({
        taskId: task.id,
        taskName: task.name,
        collaboratorId: Number(user_id),
        adderId: req.userId,
        projectId: task.project_id,
        workspaceId: task.workspace_id,
      });
    }
    
    res.status(201).json({ message: 'Collaborator added successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ error: 'User is already a collaborator' });
    }
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Add collaborator error:', err);
    res.status(500).json({ error: 'Failed to add collaborator' });
  } finally {
    client.release();
  }
});

// Archive/Unarchive task
router.put('/:taskId/archive', async (req, res) => {
  const { archive } = req.body; // true to archive, false to unarchive
  
  try {
    const result = await pool.query(
      'UPDATE tasks SET archived_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [archive ? new Date() : null, req.params.taskId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Archive task error:', err);
    res.status(500).json({ error: 'Failed to archive/unarchive task' });
  }
});

module.exports = router;
