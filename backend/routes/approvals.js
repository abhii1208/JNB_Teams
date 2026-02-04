const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const notificationService = require('../services/notificationService');

// Get approvals (filter by status, workspace, or all)
router.get('/', async (req, res) => {
  const { status, workspace_id, task_id } = req.query;

  // Visibility: User can see approvals if they are:
  // 1. The requester
  // 2. Project owner
  // 3. Project Admin/Owner (if allowed by project settings)
  // 4. One of the tagged approvers for the project (from project_approvers table)
  // 5. Legacy: approval_tagged_member_id (for backwards compatibility)
  const reviewableClause = `(
    p.created_by = $1 
    OR ((pm.role = 'Admin' OR pm.role = 'Owner') AND COALESCE(p.only_owner_approves, false) = false AND COALESCE(p.admins_can_approve, true) = true) 
    OR p.approval_tagged_member_id = $1
    OR EXISTS (SELECT 1 FROM project_approvers pa WHERE pa.project_id = p.id AND pa.user_id = $1 AND pa.is_active = TRUE)
  )`;
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
        p.approval_tagged_member_id,
        t.assignee_id as task_assignee_id,
        t.created_by as task_created_by,
        pm.role as user_project_role,
        -- Check if user is a designated approver
        EXISTS (SELECT 1 FROM project_approvers pa WHERE pa.project_id = p.id AND pa.user_id = $1 AND pa.is_active = TRUE) as is_designated_approver,
        -- Check if this is user's own work (they are requester, assignee, or task creator)
        (COALESCE(t.assignee_id, 0) = $1 OR COALESCE(t.created_by, 0) = $1 OR COALESCE(a.requester_id, 0) = $1) as is_own_work,
        CASE
          -- Project owner can ALWAYS approve (including their own work)
          WHEN p.created_by = $1 THEN true
          
          -- BLOCK: Tagged/Designated approver cannot approve their own work
          -- This check must come BEFORE the Admin check to ensure tagged approvers
          -- who are also admins cannot approve their own work
          WHEN (p.approval_tagged_member_id = $1 
                OR EXISTS (SELECT 1 FROM project_approvers pa WHERE pa.project_id = p.id AND pa.user_id = $1 AND pa.is_active = TRUE))
               AND (COALESCE(t.assignee_id, 0) = $1
                    OR COALESCE(t.created_by, 0) = $1
                    OR COALESCE(a.requester_id, 0) = $1) THEN false
          
          -- Admin/Owner role can approve if allowed by project settings
          -- (This runs only if user is NOT a tagged/designated approver with own work)
          WHEN (pm.role = 'Admin' OR pm.role = 'Owner') 
               AND COALESCE(p.only_owner_approves, false) = false 
               AND COALESCE(p.admins_can_approve, true) = true THEN true
          
          -- Designated approver (from project_approvers table) can approve others' work
          WHEN EXISTS (SELECT 1 FROM project_approvers pa WHERE pa.project_id = p.id AND pa.user_id = $1 AND pa.is_active = TRUE)
               AND COALESCE(t.assignee_id, 0) != $1
               AND COALESCE(t.created_by, 0) != $1
               AND COALESCE(a.requester_id, 0) != $1 THEN true
          
          -- Legacy: Tagged approver can approve others' work
          WHEN p.approval_tagged_member_id = $1 
               AND COALESCE(t.assignee_id, 0) != $1
               AND COALESCE(t.created_by, 0) != $1
               AND COALESCE(a.requester_id, 0) != $1 THEN true
          
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

// Get pending approval count (includes count for tagged approvers)
router.get('/count', async (req, res) => {
  const { workspace_id } = req.query;

  // Count approvals that the user can review
  // IMPORTANT: Tagged/designated approvers cannot review their own work
  // But admins who are NOT tagged approvers can review anything (if settings allow)
  const reviewableClause = `(
    -- Project owner can always review
    p.created_by = $1 
    
    -- EXCLUDE: Tagged/designated approver's own work (must come before admin check)
    OR (
      NOT (
        (p.approval_tagged_member_id = $1 
         OR EXISTS (SELECT 1 FROM project_approvers pa WHERE pa.project_id = p.id AND pa.user_id = $1 AND pa.is_active = TRUE))
        AND (COALESCE(t.assignee_id, 0) = $1 
             OR COALESCE(t.created_by, 0) = $1 
             OR COALESCE(a.requester_id, 0) = $1)
      )
      AND (
        -- Admin can review if allowed by settings
        ((pm.role = 'Admin' OR pm.role = 'Owner') 
         AND COALESCE(p.only_owner_approves, false) = false 
         AND COALESCE(p.admins_can_approve, true) = true)
        
        -- Designated approver can review others' work
        OR (EXISTS (SELECT 1 FROM project_approvers pa WHERE pa.project_id = p.id AND pa.user_id = $1 AND pa.is_active = TRUE)
            AND COALESCE(t.assignee_id, 0) != $1
            AND COALESCE(t.created_by, 0) != $1
            AND COALESCE(a.requester_id, 0) != $1)
        
        -- Tagged approver can review others' work
        OR (p.approval_tagged_member_id = $1 
            AND COALESCE(t.assignee_id, 0) != $1
            AND COALESCE(t.created_by, 0) != $1
            AND COALESCE(a.requester_id, 0) != $1)
      )
    )
  )`;

  try {
    let query = `
      SELECT COUNT(*) as count
      FROM approvals a
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN tasks t ON a.task_id = t.id
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get escalation settings for the project
    const settingsResult = await client.query(`
      SELECT COALESCE(pes.first_escalation_hours, 24) as first_escalation_hours
      FROM projects p
      LEFT JOIN project_escalation_settings pes ON pes.project_id = p.id
      WHERE p.id = $1
    `, [project_id]);
    
    const escalationHours = settingsResult.rows[0]?.first_escalation_hours || 24;
    
    // Create approval with escalation deadline
    const result = await client.query(
      `INSERT INTO approvals (type, task_id, project_id, requester_id, reason, details, escalation_deadline) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + INTERVAL '${escalationHours} hours') 
       RETURNING *`,
      [type, task_id, project_id, req.userId, reason, details]
    );
    
    const approval = result.rows[0];
    
    // Log to audit trail
    await client.query(`
      INSERT INTO approval_audit_log (approval_id, action, performed_by, new_status, notes, metadata)
      VALUES ($1, 'created', $2, 'Pending', $3, $4)
    `, [
      approval.id,
      req.userId,
      `Approval request created for ${type}`,
      JSON.stringify({ type, task_id, project_id, escalation_deadline: approval.escalation_deadline })
    ]);
    
    // Notify approvers
    const approvers = await client.query(`
      SELECT user_id FROM project_approvers 
      WHERE project_id = $1 AND is_active = TRUE
    `, [project_id]);
    
    for (const approver of approvers.rows) {
      if (approver.user_id !== req.userId) {
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, task_id, project_id)
          VALUES ($1, 'Approval', $2, $3, $4, $5)
        `, [
          approver.user_id,
          'New Approval Request',
          `A new ${type} approval request has been submitted and requires your review.`,
          task_id,
          project_id
        ]);
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(approval);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create approval error:', err);
    res.status(500).json({ error: 'Failed to create approval' });
  } finally {
    client.release();
  }
});

// Approve approval
router.put('/:approvalId/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load approval with project context including tagged member and task details
    const apprRes = await client.query(
      `SELECT a.*, 
              p.created_by AS project_owner, 
              p.admins_can_approve, 
              p.only_owner_approves,
              p.approval_tagged_member_id,
              t.assignee_id as task_assignee_id,
              t.created_by as task_created_by
       FROM approvals a
       LEFT JOIN projects p ON a.project_id = p.id
       LEFT JOIN tasks t ON a.task_id = t.id
       WHERE a.id = $1`,
      [req.params.approvalId]
    );

    if (apprRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval not found' });
    }

    const approvalRow = apprRes.rows[0];

    // Check various roles
    const isProjectOwner = approvalRow.project_owner && approvalRow.project_owner === req.userId;
    const isTaggedApprover = approvalRow.approval_tagged_member_id && approvalRow.approval_tagged_member_id === req.userId;

    // Check if user is a designated approver (from project_approvers table)
    const designatedApproverRes = await client.query(
      'SELECT 1 FROM project_approvers WHERE project_id = $1 AND user_id = $2 AND is_active = TRUE',
      [approvalRow.project_id, req.userId]
    );
    const isDesignatedApprover = designatedApproverRes.rows.length > 0;

    // Check project member role
    const pmRes = await client.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [approvalRow.project_id, req.userId]);
    const userProjectRole = pmRes.rows.length > 0 ? pmRes.rows[0].role : null;
    const isProjectAdmin = userProjectRole === 'Admin' || userProjectRole === 'Owner';

    const adminsCanApprove = approvalRow.admins_can_approve !== null ? approvalRow.admins_can_approve : true;
    const onlyOwnerApproves = approvalRow.only_owner_approves !== null ? approvalRow.only_owner_approves : false;

    // Check if this is the user's own work (they are requester, task assignee, or task creator)
    const isOwnWork = (
      (approvalRow.task_assignee_id && approvalRow.task_assignee_id === req.userId) ||
      (approvalRow.task_created_by && approvalRow.task_created_by === req.userId) ||
      (approvalRow.requester_id && approvalRow.requester_id === req.userId)
    );

    let allowed = false;
    let errorReason = '';
    
    // RULE 1: Project owner can ALWAYS approve (including their own work)
    if (isProjectOwner) {
      allowed = true;
    }
    // RULE 2: Tagged/Designated approver CANNOT approve their own work
    // This must be checked BEFORE the admin check to prevent tagged admins from approving own work
    else if ((isTaggedApprover || isDesignatedApprover) && isOwnWork) {
      allowed = false;
      errorReason = 'You cannot approve your own work. Only the Project Owner can approve this request.';
    }
    // RULE 3: Admin can approve if settings allow (but not own work if they are tagged/designated)
    else if (!onlyOwnerApproves && adminsCanApprove && isProjectAdmin) {
      allowed = true;
    }
    // RULE 4: Designated approver can approve others' work
    else if (isDesignatedApprover && !isOwnWork) {
      allowed = true;
    }
    // RULE 5: Tagged approver can approve others' work
    else if (isTaggedApprover && !isOwnWork) {
      allowed = true;
    }

    if (!allowed) {
      await client.query('ROLLBACK');
      const errorMsg = errorReason || 'Insufficient permissions to approve this request';
      return res.status(403).json({ error: errorMsg });
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

    // Log to audit trail
    await client.query(`
      INSERT INTO approval_audit_log (approval_id, action, performed_by, previous_status, new_status, notes)
      VALUES ($1, 'approved', $2, 'Pending', 'Approved', $3)
    `, [approval.id, req.userId, req.body.notes || null]);

    await client.query(
      'INSERT INTO notifications (user_id, type, title, message, task_id, project_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [approval.requester_id, 'Approval', 'Approval Approved', `Your ${approval.type} approval request has been approved`, approval.task_id, approval.project_id]
    );
    
    // Send enhanced notification with action URL
    try {
      const taskNameRes = await client.query('SELECT name FROM tasks WHERE id = $1', [approval.task_id]);
      const taskName = taskNameRes.rows[0]?.name || 'Unknown Task';
      const projectRes = await client.query('SELECT workspace_id FROM projects WHERE id = $1', [approval.project_id]);
      const workspaceId = projectRes.rows[0]?.workspace_id;
      
      await notificationService.notifyApprovalApproved({
        taskId: approval.task_id,
        taskName: taskName,
        requesterId: approval.requester_id,
        approverId: req.userId,
        projectId: approval.project_id,
        workspaceId: workspaceId,
      });
    } catch (notifErr) {
      console.error('Failed to send approval notification:', notifErr);
    }
    
    // If this approval relates to a task, update the task status/stage and archive it
    if (approval.task_id) {
      try {
        await client.query(
          `UPDATE tasks
           SET status = $1,
               stage = $2,
               archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
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

    // Load approval with project context including tagged member and task details
    const apprRes = await client.query(
      `SELECT a.*, 
              p.created_by AS project_owner, 
              p.admins_can_approve, 
              p.only_owner_approves,
              p.approval_tagged_member_id,
              t.assignee_id as task_assignee_id,
              t.created_by as task_created_by
       FROM approvals a
       LEFT JOIN projects p ON a.project_id = p.id
       LEFT JOIN tasks t ON a.task_id = t.id
       WHERE a.id = $1`,
      [req.params.approvalId]
    );

    if (apprRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approval not found' });
    }

    const approvalRow = apprRes.rows[0];

    // Check various roles
    const isProjectOwner = approvalRow.project_owner && approvalRow.project_owner === req.userId;
    const isTaggedApprover = approvalRow.approval_tagged_member_id && approvalRow.approval_tagged_member_id === req.userId;

    // Check if user is a designated approver (from project_approvers table)
    const designatedApproverRes = await client.query(
      'SELECT 1 FROM project_approvers WHERE project_id = $1 AND user_id = $2 AND is_active = TRUE',
      [approvalRow.project_id, req.userId]
    );
    const isDesignatedApprover = designatedApproverRes.rows.length > 0;

    // Check project member role
    const pmRes = await client.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [approvalRow.project_id, req.userId]);
    const userProjectRole = pmRes.rows.length > 0 ? pmRes.rows[0].role : null;
    const isProjectAdmin = userProjectRole === 'Admin' || userProjectRole === 'Owner';

    const adminsCanApprove = approvalRow.admins_can_approve !== null ? approvalRow.admins_can_approve : true;
    const onlyOwnerApproves = approvalRow.only_owner_approves !== null ? approvalRow.only_owner_approves : false;

    // Check if this is the user's own work (they are requester, task assignee, or task creator)
    const isOwnWork = (
      (approvalRow.task_assignee_id && approvalRow.task_assignee_id === req.userId) ||
      (approvalRow.task_created_by && approvalRow.task_created_by === req.userId) ||
      (approvalRow.requester_id && approvalRow.requester_id === req.userId)
    );

    let allowed = false;
    let errorReason = '';
    
    // RULE 1: Project owner can ALWAYS reject (including their own work)
    if (isProjectOwner) {
      allowed = true;
    }
    // RULE 2: Tagged/Designated approver CANNOT reject their own work
    // This must be checked BEFORE the admin check to prevent tagged admins from rejecting own work
    else if ((isTaggedApprover || isDesignatedApprover) && isOwnWork) {
      allowed = false;
      errorReason = 'You cannot reject your own work. Only the Project Owner can reject this request.';
    }
    // RULE 3: Admin can reject if settings allow (but not own work if they are tagged/designated)
    else if (!onlyOwnerApproves && adminsCanApprove && isProjectAdmin) {
      allowed = true;
    }
    // RULE 4: Designated approver can reject others' work
    else if (isDesignatedApprover && !isOwnWork) {
      allowed = true;
    }
    // RULE 5: Tagged approver can reject others' work
    else if (isTaggedApprover && !isOwnWork) {
      allowed = true;
    }

    if (!allowed) {
      await client.query('ROLLBACK');
      const errorMsg = errorReason || 'Insufficient permissions to reject this request';
      return res.status(403).json({ error: errorMsg });
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

    // Log to audit trail
    await client.query(`
      INSERT INTO approval_audit_log (approval_id, action, performed_by, previous_status, new_status, notes)
      VALUES ($1, 'rejected', $2, 'Pending', 'Rejected', $3)
    `, [approval.id, req.userId, reject_reason || null]);

    await client.query(
      'INSERT INTO notifications (user_id, type, title, message, task_id, project_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [approval.requester_id, 'Approval', 'Approval Rejected', `Your ${approval.type} approval request has been rejected${reject_reason ? ': ' + reject_reason : ''}`, approval.task_id, approval.project_id]
    );
    
    // Send enhanced notification with action URL
    try {
      const taskNameRes = await client.query('SELECT name FROM tasks WHERE id = $1', [approval.task_id]);
      const taskName = taskNameRes.rows[0]?.name || 'Unknown Task';
      const projectRes = await client.query('SELECT workspace_id FROM projects WHERE id = $1', [approval.project_id]);
      const workspaceId = projectRes.rows[0]?.workspace_id;
      
      await notificationService.notifyApprovalRejected({
        taskId: approval.task_id,
        taskName: taskName,
        requesterId: approval.requester_id,
        rejecterId: req.userId,
        projectId: approval.project_id,
        workspaceId: workspaceId,
        reason: reject_reason,
      });
    } catch (notifErr) {
      console.error('Failed to send rejection notification:', notifErr);
    }
    
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

// ============================================
// AUDIT TRAIL ENDPOINTS
// ============================================

// Get audit trail for an approval
router.get('/:approvalId/audit', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT aal.*, 
             u.first_name || ' ' || u.last_name as performed_by_name,
             u.username as performed_by_username
      FROM approval_audit_log aal
      JOIN users u ON aal.performed_by = u.id
      WHERE aal.approval_id = $1
      ORDER BY aal.performed_at DESC
    `, [req.params.approvalId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get audit trail error:', err);
    res.status(500).json({ error: 'Failed to get audit trail' });
  }
});

// ============================================
// MULTIPLE APPROVERS MANAGEMENT
// ============================================

// Get all approvers for a project
router.get('/project/:projectId/approvers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pa.*, 
             u.first_name || ' ' || u.last_name as user_name,
             u.username,
             u.email,
             adder.first_name || ' ' || adder.last_name as added_by_name
      FROM project_approvers pa
      JOIN users u ON pa.user_id = u.id
      LEFT JOIN users adder ON pa.added_by = adder.id
      WHERE pa.project_id = $1 AND pa.is_active = TRUE
      ORDER BY pa.priority ASC, pa.added_at ASC
    `, [req.params.projectId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get project approvers error:', err);
    res.status(500).json({ error: 'Failed to get approvers' });
  }
});

// Add an approver to a project
router.post('/project/:projectId/approvers', async (req, res) => {
  const { user_id, priority } = req.body;
  const projectId = req.params.projectId;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user has permission (must be project owner or admin)
    const permCheck = await client.query(`
      SELECT p.created_by, pm.role 
      FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE p.id = $2
    `, [req.userId, projectId]);
    
    if (permCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const isOwner = permCheck.rows[0].created_by === req.userId;
    const isAdmin = permCheck.rows[0].role === 'Admin' || permCheck.rows[0].role === 'Owner';
    
    if (!isOwner && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only project owner or admin can manage approvers' });
    }
    
    // Check if approver already exists
    const existingCheck = await client.query(
      'SELECT id, is_active FROM project_approvers WHERE project_id = $1 AND user_id = $2',
      [projectId, user_id]
    );
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Reactivate if inactive, or update priority
      result = await client.query(`
        UPDATE project_approvers 
        SET is_active = TRUE, priority = $1, added_at = CURRENT_TIMESTAMP, added_by = $2
        WHERE project_id = $3 AND user_id = $4
        RETURNING *
      `, [priority || 1, req.userId, projectId, user_id]);
    } else {
      // Insert new approver
      result = await client.query(`
        INSERT INTO project_approvers (project_id, user_id, priority, added_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [projectId, user_id, priority || 1, req.userId]);
    }
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add approver error:', err);
    res.status(500).json({ error: 'Failed to add approver' });
  } finally {
    client.release();
  }
});

// Remove an approver from a project (soft delete)
router.delete('/project/:projectId/approvers/:userId', async (req, res) => {
  const { projectId, userId } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check permissions
    const permCheck = await client.query(`
      SELECT p.created_by, pm.role 
      FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE p.id = $2
    `, [req.userId, projectId]);
    
    if (permCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const isOwner = permCheck.rows[0].created_by === req.userId;
    const isAdmin = permCheck.rows[0].role === 'Admin' || permCheck.rows[0].role === 'Owner';
    
    if (!isOwner && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only project owner or admin can manage approvers' });
    }
    
    // Soft delete the approver
    await client.query(
      'UPDATE project_approvers SET is_active = FALSE WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    
    await client.query('COMMIT');
    res.json({ message: 'Approver removed successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Remove approver error:', err);
    res.status(500).json({ error: 'Failed to remove approver' });
  } finally {
    client.release();
  }
});

// ============================================
// ESCALATION SETTINGS MANAGEMENT
// ============================================

// Get escalation settings for a project
router.get('/project/:projectId/escalation', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM project_escalation_settings WHERE project_id = $1',
      [req.params.projectId]
    );
    
    if (result.rows.length === 0) {
      // Return default settings
      res.json({
        project_id: req.params.projectId,
        escalation_enabled: true,
        escalation_hours: 24,
        escalation_levels: 2,
        notify_requester_on_escalation: true
      });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Get escalation settings error:', err);
    res.status(500).json({ error: 'Failed to get escalation settings' });
  }
});

// Update escalation settings for a project
router.put('/project/:projectId/escalation', async (req, res) => {
  const { escalation_enabled, escalation_hours, escalation_levels, notify_requester_on_escalation } = req.body;
  const projectId = req.params.projectId;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check permissions
    const permCheck = await client.query(`
      SELECT p.created_by, pm.role 
      FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE p.id = $2
    `, [req.userId, projectId]);
    
    if (permCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const isOwner = permCheck.rows[0].created_by === req.userId;
    const isAdmin = permCheck.rows[0].role === 'Admin' || permCheck.rows[0].role === 'Owner';
    
    if (!isOwner && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only project owner or admin can manage escalation settings' });
    }
    
    // Upsert escalation settings
    const result = await client.query(`
      INSERT INTO project_escalation_settings (project_id, escalation_enabled, escalation_hours, escalation_levels, notify_requester_on_escalation, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (project_id) DO UPDATE SET
        escalation_enabled = EXCLUDED.escalation_enabled,
        escalation_hours = EXCLUDED.escalation_hours,
        escalation_levels = EXCLUDED.escalation_levels,
        notify_requester_on_escalation = EXCLUDED.notify_requester_on_escalation,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [projectId, escalation_enabled ?? true, escalation_hours ?? 24, escalation_levels ?? 2, notify_requester_on_escalation ?? true, req.userId]);
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update escalation settings error:', err);
    res.status(500).json({ error: 'Failed to update escalation settings' });
  } finally {
    client.release();
  }
});

// ============================================
// APPROVAL COMMENTS
// ============================================

// Get comments for an approval
router.get('/:approvalId/comments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ac.*, 
             u.first_name || ' ' || u.last_name as user_name,
             u.username
      FROM approval_comments ac
      JOIN users u ON ac.user_id = u.id
      WHERE ac.approval_id = $1
      ORDER BY ac.created_at ASC
    `, [req.params.approvalId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get approval comments error:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// Add a comment to an approval
router.post('/:approvalId/comments', async (req, res) => {
  const { comment } = req.body;
  
  if (!comment || comment.trim() === '') {
    return res.status(400).json({ error: 'Comment is required' });
  }
  
  try {
    const result = await pool.query(`
      INSERT INTO approval_comments (approval_id, user_id, comment)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.approvalId, req.userId, comment.trim()]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add approval comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;
