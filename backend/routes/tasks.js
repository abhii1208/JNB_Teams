const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const normalizeNumericInput = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    due_date_from,
    due_date_to,
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
        u.first_name || ' ' || u.last_name as assignee_name,
        u.email as assignee_email,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        rs.id as series_id,
        rs.title as series_title,
        (SELECT json_agg(json_build_object('id', u2.id, 'name', u2.first_name || ' ' || u2.last_name, 'email', u2.email))
         FROM task_collaborators tc
         JOIN users u2 ON tc.user_id = u2.id
         WHERE tc.task_id = t.id) as collaborators,
        CASE WHEN t.due_date < CURRENT_DATE AND t.status NOT IN ('Closed', 'Completed') THEN true ELSE false END as is_overdue,
        CASE WHEN rs.id IS NOT NULL THEN true ELSE false END as is_recurring,
        (SELECT status FROM approvals WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1) as latest_approval_status
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN recurring_series rs ON t.series_id = rs.id
      WHERE p.workspace_id = $1 
        AND t.deleted_at IS NULL
        AND t.project_id = ANY($2::int[])
    `;

    const params = [workspaceId, userProjectIds];
    let paramIndex = 3;

    // Apply filters
    if (!include_archived || include_archived !== 'true') {
      query += ` AND t.archived_at IS NULL`;
    }

    if (projects) {
      const projectIds = projects.split(',').map(Number).filter(id => userProjectIds.includes(id));
      if (projectIds.length > 0) {
        query += ` AND t.project_id = ANY($${paramIndex}::int[])`;
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

    if (recurring === 'true') {
      query += ` AND t.series_id IS NOT NULL`;
    } else if (recurring === 'false') {
      query += ` AND t.series_id IS NULL`;
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
      SELECT p.id, p.name, COUNT(t.id) as task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL AND t.archived_at IS NULL
      WHERE p.id = ANY($1::int[])
      GROUP BY p.id, p.name
      ORDER BY p.name
    `, [projectIds]);
    metadata.groups = result.rows;
  } else if (groupBy === 'status') {
    const result = await pool.query(`
      SELECT t.status, COUNT(*) as task_count
      FROM tasks t
      WHERE t.project_id = ANY($1::int[]) AND t.deleted_at IS NULL AND t.archived_at IS NULL
      GROUP BY t.status
      ORDER BY t.status
    `, [projectIds]);
    metadata.groups = result.rows;
  } else if (groupBy === 'assignee') {
    const result = await pool.query(`
      SELECT u.id, u.first_name || ' ' || u.last_name as name, COUNT(t.id) as task_count
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ANY($1::int[]) AND t.deleted_at IS NULL AND t.archived_at IS NULL
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY u.first_name NULLS LAST
    `, [projectIds]);
    metadata.groups = result.rows;
  } else if (groupBy === 'priority') {
    const result = await pool.query(`
      SELECT t.priority, COUNT(*) as task_count
      FROM tasks t
      WHERE t.project_id = ANY($1::int[]) AND t.deleted_at IS NULL AND t.archived_at IS NULL
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
      WHERE t.project_id = ANY($1::int[]) AND t.deleted_at IS NULL AND t.archived_at IS NULL
      GROUP BY bucket
    `, [projectIds]);
    metadata.groups = result.rows;
  }
  
  return metadata;
}

// Get tasks for calendar view (date-based)
router.get('/workspace/:workspaceId/calendar', async (req, res) => {
  const { workspaceId } = req.params;
  const { start_date, end_date, projects } = req.query;

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

    const result = await pool.query(`
      SELECT 
        t.id, t.name, t.due_date, t.target_date, t.status, t.stage, t.priority,
        p.id as project_id, p.name as project_name,
        u.first_name || ' ' || u.last_name as assignee_name,
        CASE WHEN rs.id IS NOT NULL THEN true ELSE false END as is_recurring
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN recurring_series rs ON t.series_id = rs.id
      WHERE t.project_id = ANY($1::int[])
        AND t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND (
          (t.due_date >= $2 AND t.due_date <= $3)
          OR (t.target_date >= $2 AND t.target_date <= $3)
        )
      ORDER BY t.due_date ASC NULLS LAST
    `, [projectIds, start_date, end_date]);

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

    if (normalizedUpdates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(normalizedUpdates.status);
      paramIndex++;
    }
    if (normalizedUpdates.stage !== undefined) {
      updateFields.push(`stage = $${paramIndex}`);
      params.push(normalizedUpdates.stage);
      paramIndex++;
    }
    if (normalizedUpdates.priority !== undefined) {
      updateFields.push(`priority = $${paramIndex}`);
      params.push(normalizedUpdates.priority);
      paramIndex++;
    }
    if (normalizedUpdates.assignee_id !== undefined) {
      updateFields.push(`assignee_id = $${paramIndex}`);
      params.push(normalizedUpdates.assignee_id);
      paramIndex++;
    }
    if (normalizedUpdates.due_date !== undefined) {
      updateFields.push(`due_date = $${paramIndex}`);
      params.push(normalizedUpdates.due_date);
      paramIndex++;
    }
    if (normalizedUpdates.target_date !== undefined) {
      updateFields.push(`target_date = $${paramIndex}`);
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
        u.first_name || ' ' || u.last_name as assignee_name,
        u.username as assignee_username,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        (SELECT json_agg(json_build_object('id', u2.id, 'name', u2.first_name || ' ' || u2.last_name))
         FROM task_collaborators tc
         JOIN users u2 ON tc.user_id = u2.id
         WHERE tc.task_id = t.id) as collaborators
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      JOIN users creator ON t.created_by = creator.id
      WHERE t.project_id = $1 AND t.deleted_at IS NULL ${archiveCondition}
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
  const {
    name,
    description,
    project_id,
    assignee_id,
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
  const normalizedExternalId = external_id ?? externalId ?? null;
  const normalizedTags = Array.isArray(tags) ? tags : null;
  
  if (!name || !project_id) {
    return res.status(400).json({ error: 'Name and project_id are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const taskResult = await client.query(
      `INSERT INTO tasks 
       (name, description, project_id, assignee_id, stage, status, priority, due_date, target_date, notes, category, section, estimated_hours, actual_hours, completion_percentage, tags, external_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        name,
        description,
        project_id,
        assignee_id,
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
        req.userId,
      ]
    );
    
    const task = taskResult.rows[0];
    
    const projectResult = await client.query(
      'SELECT workspace_id FROM projects WHERE id = $1',
      [project_id]
    );
    const workspaceId = projectResult.rows[0].workspace_id;
    
    await client.query(
      'INSERT INTO activity_logs (user_id, workspace_id, project_id, task_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [req.userId, workspaceId, project_id, task.id, 'Task', 'Created', name, `Created task "${name}"`]
    );
    
    if (assignee_id && assignee_id !== req.userId) {
      await client.query(
        'INSERT INTO notifications (user_id, type, title, message, task_id, project_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [assignee_id, 'Task', 'Task Assigned', `You have been assigned to task "${name}"`, task.id, project_id]
      );
    }

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
    
    res.status(201).json(task);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  } finally {
    client.release();
  }
});

// Update task
router.put('/:taskId', async (req, res) => {
  const {
    name,
    description,
    assignee_id,
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
  const normalizedExternalId = external_id ?? externalId ?? null;
  const normalizedTags = Array.isArray(tags) ? tags : null;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const accessRes = await client.query(
      `SELECT t.id, t.project_id, t.assignee_id,
        p.created_by AS project_owner,
        p.admins_can_approve,
        p.only_owner_approves,
        pm.role as user_project_role
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
       WHERE t.id = $1`,
      [req.params.taskId, req.userId]
    );

    if (accessRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

    const access = accessRes.rows[0];
    const isProjectOwner = Number(access.project_owner) === Number(req.userId);
    const userProjectRole = access.user_project_role;
    const isProjectAdmin = userProjectRole === 'Admin' || userProjectRole === 'Owner';
    const adminsCanApprove = access.admins_can_approve !== null ? access.admins_can_approve : true;
    const onlyOwnerApproves = access.only_owner_approves !== null ? access.only_owner_approves : false;
    const canApprove = isProjectOwner || (!onlyOwnerApproves && adminsCanApprove && isProjectAdmin);

    if (!isProjectOwner && !userProjectRole) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied to this task' });
    }

    const requestedStatus = typeof status === 'string' ? status.toLowerCase() : null;
    const isApprovalStatus = requestedStatus === 'closed' || requestedStatus === 'rejected';
    if (isApprovalStatus && !canApprove) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Insufficient permissions to approve or reject this task' });
    }
    
    // Auto-archive when task is closed
    const shouldArchive = status && status.toLowerCase() === 'closed';
    
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
           archived_at = CASE WHEN $18 THEN CURRENT_TIMESTAMP ELSE archived_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $17
       RETURNING *`,
      [
        name,
        description,
        assignee_id,
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
        req.params.taskId,
        shouldArchive,
      ]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = result.rows[0];
    
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
          await client.query(
            'INSERT INTO approvals (type, task_id, project_id, requester_id, reason, details) VALUES ($1, $2, $3, $4, $5, $6)',
            ['task', task.id, task.project_id, req.userId, 'Task completion approval', `Approval requested for task ${task.name}`]
          );
        }
      }
    } catch (err) {
      console.error('Failed to create approval for task update:', err);
    }
    
    await client.query('COMMIT');
    
    res.json(task);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
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

  try {
    await pool.query(
      'INSERT INTO task_collaborators (task_id, user_id) VALUES ($1, $2)',
      [req.params.taskId, user_id]
    );
    
    res.status(201).json({ message: 'Collaborator added successfully' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'User is already a collaborator' });
    }
    console.error('Add collaborator error:', err);
    res.status(500).json({ error: 'Failed to add collaborator' });
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
