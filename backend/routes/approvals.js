const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get approvals (filter by status, workspace, or all)
router.get('/', async (req, res) => {
  const { status, workspace_id } = req.query;
  
  try {
    let query = `
      SELECT a.*,
        u.first_name || ' ' || u.last_name as requester_name,
        u.username as requester_username,
        reviewer.first_name || ' ' || reviewer.last_name as reviewer_name,
        p.name as project_name,
        t.name as task_name
      FROM approvals a
      JOIN users u ON a.requester_id = u.id
      LEFT JOIN users reviewer ON a.reviewed_by = reviewer.id
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN tasks t ON a.task_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }
    
    if (workspace_id) {
      params.push(workspace_id);
      query += ` AND p.workspace_id = $${params.length}`;
    }
    
    query += ' ORDER BY a.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get approvals error:', err);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

// Get pending approval count
router.get('/count', async (req, res) => {
  const { workspace_id } = req.query;
  
  try {
    let query = `
      SELECT COUNT(*) as count
      FROM approvals a
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE a.status = 'Pending'
    `;
    
    const params = [];
    if (workspace_id) {
      params.push(workspace_id);
      query += ` AND p.workspace_id = $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Get approval count error:', err);
    res.status(500).json({ error: 'Failed to get approval count' });
  }
});

// Create approval
router.post('/', async (req, res) => {
  const { type, task_id, project_id, reason, details } = req.body;
  
  if (!type || (!task_id && !project_id)) {
    return res.status(400).json({ error: 'Type and either task_id or project_id are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO approvals (type, task_id, project_id, requester_id, reason, details) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [type, task_id, project_id, req.userId, reason, details]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create approval error:', err);
    res.status(500).json({ error: 'Failed to create approval' });
  }
});

// Approve approval
router.put('/:approvalId/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      'UPDATE approvals SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3 AND status = $4 RETURNING *',
      ['Approved', req.userId, req.params.approvalId, 'Pending']
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval not found or already reviewed' });
    }
    
    const approval = result.rows[0];
    
    await client.query(
      'INSERT INTO notifications (user_id, type, title, message, task_id, project_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [approval.requester_id, 'Approval', 'Approval Approved', `Your ${approval.type} approval request has been approved`, approval.task_id, approval.project_id]
    );
    // If this approval relates to a task, update the task status/stage
    if (approval.task_id) {
      try {
        await client.query(
          `UPDATE tasks SET status = $1, stage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          ['Closed', 'Completed', approval.task_id]
        );
      } catch (err) {
        console.error('Failed to update task after approval:', err);
      }
    }
    
    await client.query('COMMIT');
    
    res.json(approval);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve approval error:', err);
    res.status(500).json({ error: 'Failed to approve' });
  } finally {
    client.release();
  }
});

// Reject approval
router.put('/:approvalId/reject', async (req, res) => {
  const { reject_reason } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      'UPDATE approvals SET status = $1, reject_reason = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP WHERE id = $4 AND status = $5 RETURNING *',
      ['Rejected', reject_reason, req.userId, req.params.approvalId, 'Pending']
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval not found or already reviewed' });
    }
    
    const approval = result.rows[0];
    
    await client.query(
      'INSERT INTO notifications (user_id, type, title, message, task_id, project_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [approval.requester_id, 'Approval', 'Approval Rejected', `Your ${approval.type} approval request has been rejected${reject_reason ? ': ' + reject_reason : ''}`, approval.task_id, approval.project_id]
    );
    // If this approval relates to a task, update the task status/stage
    if (approval.task_id) {
      try {
        await client.query(
          `UPDATE tasks SET status = $1, stage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          ['Rejected', 'In-process', approval.task_id]
        );
      } catch (err) {
        console.error('Failed to update task after rejection:', err);
      }
    }
    
    await client.query('COMMIT');
    
    res.json(approval);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reject approval error:', err);
    res.status(500).json({ error: 'Failed to reject' });
  } finally {
    client.release();
  }
});

module.exports = router;
