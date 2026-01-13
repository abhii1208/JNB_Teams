const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get approvals (filter by status, workspace, or all)
router.get('/', async (req, res) => {
  const { status, workspace_id, task_id } = req.query;

  const reviewableClause = `(p.created_by = $1 OR ((pm.role = 'Admin' OR pm.role = 'Owner') AND COALESCE(p.only_owner_approves, false) = false AND COALESCE(p.admins_can_approve, true) = true))`;
  const visibilityClause = `(a.requester_id = $1 OR ${reviewableClause})`;

  try {
    let query = `
      SELECT a.*,
        u.first_name || ' ' || u.last_name as requester_name,
        u.username as requester_username,
        reviewer.first_name || ' ' || reviewer.last_name as reviewer_name,
        p.name as project_name,
        t.name as task_name,
        p.created_by AS project_owner,
        p.admins_can_approve,
        p.only_owner_approves,
        pm.role as user_project_role,
        CASE
          WHEN p.created_by = $1 THEN true
          WHEN (pm.role = 'Admin' OR pm.role = 'Owner') AND COALESCE(p.only_owner_approves, false) = false AND COALESCE(p.admins_can_approve, true) = true THEN true
          ELSE false
        END as can_review
      FROM approvals a
      JOIN users u ON a.requester_id = u.id
      LEFT JOIN users reviewer ON a.reviewed_by = reviewer.id
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN tasks t ON a.task_id = t.id
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE ${visibilityClause}
    `;

    const params = [req.userId];

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (workspace_id) {
      params.push(workspace_id);
      query += ` AND p.workspace_id = $${params.length}`;
    }

    if (task_id) {
      params.push(task_id);
      query += ` AND a.task_id = $${params.length}`;
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

  const reviewableClause = `(p.created_by = $1 OR ((pm.role = 'Admin' OR pm.role = 'Owner') AND COALESCE(p.only_owner_approves, false) = false AND COALESCE(p.admins_can_approve, true) = true))`;

  try {
    let query = `
      SELECT COUNT(*) as count
      FROM approvals a
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE a.status = 'Pending'
        AND ${reviewableClause}
    `;

    const params = [req.userId];
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

    // Load approval with project context
    const apprRes = await client.query(
      `SELECT a.*, p.created_by AS project_owner, p.admins_can_approve, p.only_owner_approves
       FROM approvals a
       LEFT JOIN projects p ON a.project_id = p.id
       WHERE a.id = $1`,
      [req.params.approvalId]
    );

    if (apprRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval not found' });
    }

    const approvalRow = apprRes.rows[0];

    // Only allow approver, project owner, or (when enabled) project admin to approve
    const isExplicitApprover = approvalRow.approver_id && approvalRow.approver_id === req.userId;
    const isProjectOwner = approvalRow.project_owner && approvalRow.project_owner === req.userId;

    // Check project member role
    const pmRes = await client.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [approvalRow.project_id, req.userId]);
    const userProjectRole = pmRes.rows.length > 0 ? pmRes.rows[0].role : null;
    const isProjectAdmin = userProjectRole === 'Admin' || userProjectRole === 'Owner';

    const adminsCanApprove = approvalRow.admins_can_approve !== null ? approvalRow.admins_can_approve : true;
    const onlyOwnerApproves = approvalRow.only_owner_approves !== null ? approvalRow.only_owner_approves : false;

    let allowed = false;
    if (isExplicitApprover) allowed = true;
    else if (isProjectOwner) allowed = true;
    else if (!onlyOwnerApproves && adminsCanApprove && isProjectAdmin) allowed = true;

    if (!allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Insufficient permissions to approve this request' });
    }

    // Now perform the status update only if still pending
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

    // Load approval with project context
    const apprRes = await client.query(
      `SELECT a.*, p.created_by AS project_owner, p.admins_can_approve, p.only_owner_approves
       FROM approvals a
       LEFT JOIN projects p ON a.project_id = p.id
       WHERE a.id = $1`,
      [req.params.approvalId]
    );

    if (apprRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval not found' });
    }

    const approvalRow = apprRes.rows[0];

    // Only allow explicit approver, project owner, or (when enabled) project admin to reject
    const isExplicitApprover = approvalRow.approver_id && approvalRow.approver_id === req.userId;
    const isProjectOwner = approvalRow.project_owner && approvalRow.project_owner === req.userId;

    // Check project member role
    const pmRes = await client.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [approvalRow.project_id, req.userId]);
    const userProjectRole = pmRes.rows.length > 0 ? pmRes.rows[0].role : null;
    const isProjectAdmin = userProjectRole === 'Admin' || userProjectRole === 'Owner';

    const adminsCanApprove = approvalRow.admins_can_approve !== null ? approvalRow.admins_can_approve : true;
    const onlyOwnerApproves = approvalRow.only_owner_approves !== null ? approvalRow.only_owner_approves : false;

    let allowed = false;
    if (isExplicitApprover) allowed = true;
    else if (isProjectOwner) allowed = true;
    else if (!onlyOwnerApproves && adminsCanApprove && isProjectAdmin) allowed = true;

    if (!allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Insufficient permissions to reject this request' });
    }

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
