const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get tasks for a project
router.get('/project/:projectId', async (req, res) => {
  try {
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
      WHERE t.project_id = $1 AND t.deleted_at IS NULL
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
    name, description, project_id, assignee_id, stage = 'Planned',
    status = 'Not started', priority = 'Medium', due_date, target_date, notes
  } = req.body;
  
  if (!name || !project_id) {
    return res.status(400).json({ error: 'Name and project_id are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const taskResult = await client.query(
      `INSERT INTO tasks 
       (name, description, project_id, assignee_id, stage, status, priority, due_date, target_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [name, description, project_id, assignee_id, stage, status, priority, due_date, target_date, notes, req.userId]
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
    name, description, assignee_id, stage, status, priority,
    due_date, target_date, notes
  } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
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
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [name, description, assignee_id, stage, status, priority, due_date, target_date, notes, req.params.taskId]
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

module.exports = router;
