const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { checkWorkspaceMember } = require('./workspaces');
const notificationService = require('../services/notificationService');

const CLIENT_ROLE_VALUES = new Set(['Primary', 'Billing', 'Stakeholder', 'Partner']);

function normalizeProjectClients({ clientIds, primaryClientId, projectClients }) {
  const cleaned = [];

  if (Array.isArray(projectClients) && projectClients.length > 0) {
    projectClients.forEach((entry) => {
      const clientId = parseInt(entry?.client_id, 10);
      if (!Number.isFinite(clientId)) return;
      const role = CLIENT_ROLE_VALUES.has(entry?.role) ? entry.role : 'Stakeholder';
      cleaned.push({
        client_id: clientId,
        role,
        is_primary: Boolean(entry?.is_primary),
      });
    });
  } else if (Array.isArray(clientIds)) {
    const ids = [...new Set(clientIds.map((id) => parseInt(id, 10)).filter(Number.isFinite))];
    const primaryId = Number.isFinite(parseInt(primaryClientId, 10))
      ? parseInt(primaryClientId, 10)
      : null;
    const resolvedPrimaryId = ids.includes(primaryId) ? primaryId : ids[0];
    ids.forEach((id) => {
      cleaned.push({
        client_id: id,
        role: id === resolvedPrimaryId ? 'Primary' : 'Stakeholder',
        is_primary: id === resolvedPrimaryId,
      });
    });
  }

  if (cleaned.length === 0) return [];

  const primaryIndex = cleaned.findIndex((item) => item.is_primary);
  if (primaryIndex === -1) {
    cleaned[0].is_primary = true;
    cleaned[0].role = 'Primary';
  } else {
    cleaned.forEach((item, index) => {
      if (index !== primaryIndex) item.is_primary = false;
    });
    cleaned[primaryIndex].role = 'Primary';
  }

  const seen = new Set();
  return cleaned.filter((item) => {
    if (seen.has(item.client_id)) return false;
    seen.add(item.client_id);
    return true;
  });
}

// Get all projects in a workspace
router.get('/workspace/:workspaceId', checkWorkspaceMember, async (req, res) => {
  const { include_archived } = req.query;
  try {
      const result = await pool.query(`
        SELECT p.*, pm.role,
          u.first_name || ' ' || u.last_name as created_by_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL) as task_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND stage = 'Completed' AND deleted_at IS NULL) as completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'Open' AND deleted_at IS NULL) as open_tasks,
          (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'Pending') as pending_approval,
          (SELECT json_agg(json_build_object('id', u2.id, 'avatar', SUBSTRING(u2.first_name, 1, 1) || SUBSTRING(u2.last_name, 1, 1)))
           FROM project_members pm2
           JOIN users u2 ON pm2.user_id = u2.id
           WHERE pm2.project_id = p.id
           LIMIT 5) as members,
          (SELECT COALESCE(json_agg(json_build_object(
            'id', c.id,
            'name', c.client_name,
            'code', c.client_code,
            'status', c.status,
            'role', pc.role,
            'is_primary', pc.is_primary
          ) ORDER BY pc.is_primary DESC, c.client_name ASC), '[]'::json)
           FROM project_clients pc
           JOIN clients c ON pc.client_id = c.id
           WHERE pc.project_id = p.id) as clients,
          (SELECT json_build_object(
            'id', c.id,
            'name', c.client_name,
            'code', c.client_code,
            'status', c.status
          )
           FROM project_clients pc
           JOIN clients c ON pc.client_id = c.id
           WHERE pc.project_id = p.id AND pc.is_primary = TRUE
           LIMIT 1) as primary_client
        FROM projects p
        JOIN users u ON p.created_by = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
        WHERE p.workspace_id = $1
          AND ($3::boolean OR p.archived = FALSE)
          AND EXISTS (
            SELECT 1 FROM project_members pm_check
            WHERE pm_check.project_id = p.id AND pm_check.user_id = $2
          )
        ORDER BY p.last_accessed_at DESC NULLS LAST, p.created_at DESC
      `, [req.params.workspaceId, req.userId, include_archived === 'true']);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create project
router.post('/', async (req, res) => {
  const {
    name,
    description,
    workspace_id,
    icon = 'folder',
    color = '#0f766e',
    client_ids,
    primary_client_id,
    project_clients,
  } = req.body;

  if (!name || !workspace_id) {
    return res.status(400).json({ error: 'Name and workspace_id are required' });
  }

  // Check that the requester has permission to create a project in this workspace
  try {
    const roleRes = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspace_id, req.userId]
    );

    if (roleRes.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const role = roleRes.rows[0].role;
    const allowed = ['Owner', 'Admin', 'ProjectAdmin'];
    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions to create a project' });
    }
  } catch (err) {
    console.error('Permission check error:', err);
    return res.status(500).json({ error: 'Permission check failed' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projectResult = await client.query(
      'INSERT INTO projects (name, description, workspace_id, icon, color, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description, workspace_id, icon, color, req.userId]
    );

    const project = projectResult.rows[0];

    await client.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, req.userId, 'Owner']
    );

    const clientLinks = normalizeProjectClients({
      clientIds: client_ids,
      primaryClientId: primary_client_id,
      projectClients: project_clients,
    });

    if (clientLinks.length > 0) {
      const clientIdList = clientLinks.map((link) => link.client_id);
      const validClients = await client.query(
        'SELECT id, status FROM clients WHERE workspace_id = $1 AND id = ANY($2::int[])',
        [workspace_id, clientIdList]
      );

      if (validClients.rows.length !== clientIdList.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid client selection for workspace' });
      }

      const inactiveClients = validClients.rows.filter((row) => row.status !== 'Active');
      if (inactiveClients.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Inactive clients cannot be linked to new projects' });
      }

      const values = [];
      const placeholders = clientLinks.map((link, index) => {
        const base = index * 4;
        values.push(project.id, link.client_id, link.role, link.is_primary);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      });

      await client.query(
        `INSERT INTO project_clients (project_id, client_id, role, is_primary) VALUES ${placeholders}`,
        values
      );

      const namesResult = await client.query(
        'SELECT client_name FROM clients WHERE id = ANY($1::int[]) ORDER BY client_name ASC',
        [clientIdList]
      );
      const clientNames = namesResult.rows.map((row) => row.client_name).join(', ');
      await client.query(
        'INSERT INTO activity_logs (user_id, workspace_id, project_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [req.userId, workspace_id, project.id, 'Project', 'Clients Linked', name, `Linked clients: ${clientNames}`]
      );
    }

    await client.query(
      'INSERT INTO activity_logs (user_id, workspace_id, project_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.userId, workspace_id, project.id, 'Project', 'Created', name, 'Created new project']
    );

    await client.query('COMMIT');

    res.status(201).json(project);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  } finally {
    client.release();
  }
});

// Update project
router.put('/:projectId', async (req, res) => {
  const {
    name,
    description,
    icon,
    color,
    status,
    members_can_create_tasks,
    members_can_close_tasks,
    admins_can_approve,
    only_owner_approves,
    require_rejection_reason,
    auto_close_after_days,
    member_task_approval,
    admin_task_approval,
    auto_approve_owner_tasks,
    auto_approve_admin_tasks,
    task_approval_required,
    show_settings_to_admin,
    enable_multi_project_links,
    freeze_columns,
    client_ids,
    primary_client_id,
    project_clients,
    approval_tagged_member_id,
  } = req.body;

  const hasClientListUpdate = client_ids !== undefined || project_clients !== undefined;
  const hasPrimaryOnlyUpdate = !hasClientListUpdate && primary_client_id !== undefined;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedFreezeColumns = freeze_columns !== undefined && freeze_columns !== null && typeof freeze_columns === 'object'
      ? JSON.stringify(freeze_columns)
      : freeze_columns;
    
    // Handle approval_tagged_member_id - verify member belongs to project
    let normalizedApprovalTaggedMemberId = undefined;
    if (approval_tagged_member_id !== undefined) {
      if (approval_tagged_member_id === null || approval_tagged_member_id === '') {
        normalizedApprovalTaggedMemberId = null;
      } else {
        const memberId = parseInt(approval_tagged_member_id, 10);
        if (!Number.isFinite(memberId)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid approval_tagged_member_id' });
        }
        // Verify user is a project member
        const memberCheck = await client.query(
          'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
          [req.params.projectId, memberId]
        );
        if (memberCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Tagged member must be a project member' });
        }
        normalizedApprovalTaggedMemberId = memberId;
      }
    }

    const result = await client.query(
      `UPDATE projects 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description),
           icon = COALESCE($3, icon),
           color = COALESCE($4, color),
           status = COALESCE($5, status),
           members_can_create_tasks = COALESCE($6, members_can_create_tasks),
           members_can_close_tasks = COALESCE($7, members_can_close_tasks),
           admins_can_approve = COALESCE($8, admins_can_approve),
           only_owner_approves = COALESCE($9, only_owner_approves),
           require_rejection_reason = COALESCE($10, require_rejection_reason),
           auto_close_after_days = COALESCE($11, auto_close_after_days),
           member_task_approval = COALESCE($12, member_task_approval),
           admin_task_approval = COALESCE($13, admin_task_approval),
           auto_approve_owner_tasks = COALESCE($14, auto_approve_owner_tasks),
           auto_approve_admin_tasks = COALESCE($15, auto_approve_admin_tasks),
           task_approval_required = COALESCE($16, task_approval_required),
           show_settings_to_admin = COALESCE($17, show_settings_to_admin),
           enable_multi_project_links = COALESCE($18, enable_multi_project_links),
           freeze_columns = COALESCE($19::jsonb, freeze_columns),
           approval_tagged_member_id = COALESCE($21, approval_tagged_member_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $20 
       RETURNING *`,
      [
        name,
        description,
        icon,
        color,
        status,
        members_can_create_tasks,
        members_can_close_tasks,
        admins_can_approve,
        only_owner_approves,
        require_rejection_reason,
        auto_close_after_days,
        member_task_approval,
        admin_task_approval,
        auto_approve_owner_tasks,
        auto_approve_admin_tasks,
        task_approval_required,
        show_settings_to_admin,
        enable_multi_project_links,
        normalizedFreezeColumns,
        req.params.projectId,
        normalizedApprovalTaggedMemberId,
      ]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectRow = result.rows[0];

    if (hasClientListUpdate) {
      const clientLinks = normalizeProjectClients({
        clientIds: client_ids,
        primaryClientId: primary_client_id,
        projectClients: project_clients,
      });
      const existingLinksResult = await client.query(
        'SELECT client_id, role, is_primary FROM project_clients WHERE project_id = $1 ORDER BY client_id ASC',
        [req.params.projectId]
      );
      const existingLinks = existingLinksResult.rows.map((row) => ({
        client_id: row.client_id,
        role: row.is_primary ? 'Primary' : (row.role === 'Primary' ? 'Stakeholder' : row.role),
        is_primary: row.is_primary,
      }));

      if (clientLinks.length > 0) {
        const clientIdList = clientLinks.map((link) => link.client_id);
        const validClients = await client.query(
          'SELECT id, status FROM clients WHERE workspace_id = $1 AND id = ANY($2::int[])',
          [projectRow.workspace_id, clientIdList]
        );

        if (validClients.rows.length !== clientIdList.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid client selection for workspace' });
        }

        const inactiveIds = validClients.rows.filter((row) => row.status !== 'Active').map((row) => row.id);
        if (inactiveIds.length > 0) {
          const existingInactive = await client.query(
            'SELECT client_id FROM project_clients WHERE project_id = $1 AND client_id = ANY($2::int[])',
            [req.params.projectId, inactiveIds]
          );
          const existingSet = new Set(existingInactive.rows.map((row) => row.client_id));
          const blocked = inactiveIds.filter((id) => !existingSet.has(id));
          if (blocked.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Inactive clients cannot be linked to the project' });
          }
        }
      }

      const normalizedNextLinks = clientLinks
        .map((link) => ({
          client_id: link.client_id,
          role: link.is_primary ? 'Primary' : (link.role === 'Primary' ? 'Stakeholder' : link.role),
          is_primary: link.is_primary,
        }))
        .sort((a, b) => a.client_id - b.client_id);
      const linksChanged = JSON.stringify(existingLinks) !== JSON.stringify(normalizedNextLinks);

      if (linksChanged) {
        await client.query('DELETE FROM project_clients WHERE project_id = $1', [req.params.projectId]);

        if (clientLinks.length > 0) {
          const values = [];
          const placeholders = clientLinks.map((link, index) => {
            const base = index * 4;
            values.push(req.params.projectId, link.client_id, link.role, link.is_primary);
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
          });

          await client.query(
            `INSERT INTO project_clients (project_id, client_id, role, is_primary) VALUES ${placeholders}`,
            values
          );
        }

        let details = 'Updated project clients';
        if (clientLinks.length === 0) {
          details = 'Removed all clients from project';
        } else {
          const clientIdList = clientLinks.map((link) => link.client_id);
          const namesResult = await client.query(
            'SELECT client_name FROM clients WHERE id = ANY($1::int[]) ORDER BY client_name ASC',
            [clientIdList]
          );
          const clientNames = namesResult.rows.map((row) => row.client_name).join(', ');
          details = `Linked clients: ${clientNames}`;
        }

        await client.query(
          'INSERT INTO activity_logs (user_id, workspace_id, project_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [req.userId, projectRow.workspace_id, req.params.projectId, 'Project', 'Clients Updated', projectRow.name, details]
        );
      }
    } else if (hasPrimaryOnlyUpdate) {
      const primaryId = parseInt(primary_client_id, 10);
      if (!Number.isFinite(primaryId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid primary client' });
      }

      const currentPrimary = await client.query(
        'SELECT client_id FROM project_clients WHERE project_id = $1 AND is_primary = TRUE',
        [req.params.projectId]
      );
      const currentPrimaryId = currentPrimary.rows[0]?.client_id || null;

      const existing = await client.query(
        'SELECT 1 FROM project_clients WHERE project_id = $1 AND client_id = $2',
        [req.params.projectId, primaryId]
      );

      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Primary client must be linked to the project' });
      }

      await client.query(
        `UPDATE project_clients
         SET is_primary = FALSE,
             role = CASE WHEN role = 'Primary' THEN 'Stakeholder' ELSE role END
         WHERE project_id = $1`,
        [req.params.projectId]
      );

      await client.query(
        `UPDATE project_clients
         SET is_primary = TRUE,
             role = 'Primary'
         WHERE project_id = $1 AND client_id = $2`,
        [req.params.projectId, primaryId]
      );

      if (currentPrimaryId !== primaryId) {
        const clientNameResult = await client.query(
          'SELECT client_name FROM clients WHERE id = $1',
          [primaryId]
        );
        const primaryName = clientNameResult.rows[0]?.client_name || 'Primary Client';
        await client.query(
          'INSERT INTO activity_logs (user_id, workspace_id, project_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [req.userId, projectRow.workspace_id, req.params.projectId, 'Project', 'Primary Client Updated', projectRow.name, `Primary client set to ${primaryName}`]
        );
        
        // Notify about client change
        await notificationService.notifyClientAdded({
          projectId: parseInt(req.params.projectId),
          projectName: projectRow.name,
          clientName: primaryName,
          adderId: req.userId,
          workspaceId: projectRow.workspace_id,
        });
      }
    }
    
    // Send notifications for project settings changes
    try {
      // Determine what changed for notification
      const settingsChanged = [];
      if (admins_can_approve !== undefined) settingsChanged.push('approval permissions');
      if (only_owner_approves !== undefined) settingsChanged.push('owner-only approval');
      if (task_approval_required !== undefined) settingsChanged.push('approval requirement');
      if (members_can_create_tasks !== undefined) settingsChanged.push('task creation permissions');
      if (members_can_close_tasks !== undefined) settingsChanged.push('task closure permissions');
      if (approval_tagged_member_id !== undefined) settingsChanged.push('approval reviewer');
      
      if (settingsChanged.length > 0) {
        const changeDescription = settingsChanged.join(', ');
        
        // Get user's role to determine if they are admin or owner
        const roleResult = await client.query(
          'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
          [req.params.projectId, req.userId]
        );
        const userRole = roleResult.rows[0]?.role;
        
        if (userRole === 'Admin') {
          // Notify owner when admin makes changes
          await notificationService.notifyOwnerOfAdminChanges({
            projectId: parseInt(req.params.projectId),
            projectName: projectRow.name,
            adminId: req.userId,
            workspaceId: projectRow.workspace_id,
            changeDescription,
          });
        }
        
        // Notify all admins and owner about settings changes
        await notificationService.notifyProjectSettingsChanged({
          projectId: parseInt(req.params.projectId),
          projectName: projectRow.name,
          changerId: req.userId,
          workspaceId: projectRow.workspace_id,
          changeDescription,
        });
      }
    } catch (notifErr) {
      console.error('Failed to send project settings notifications:', notifErr);
    }

    await client.query('COMMIT');
    res.json(projectRow);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  } finally {
    client.release();
  }
});

// Get project members
router.get('/:projectId/members', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, pm.role
      FROM users u
      JOIN project_members pm ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.joined_at ASC
    `, [req.params.projectId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get project members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Add project member
router.post('/:projectId/members', async (req, res) => {
  const { user_id, email, role = 'Member' } = req.body;
  const projectId = req.params.projectId;

  if (!user_id && !email) {
    return res.status(400).json({ error: 'user_id or email is required' });
  }

  try {
    // resolve user id by email if needed
    let uid = user_id;
    if (!uid && email) {
      const ures = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (ures.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      uid = ures.rows[0].id;
    }

    // permission check: requester must be project member (Owner/Admin) or workspace Owner/Admin/ProjectAdmin
    const projRes = await pool.query('SELECT workspace_id FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const workspaceId = projRes.rows[0].workspace_id;

    const pmRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, req.userId]);
    let allowed = false;
    if (pmRes.rows.length > 0) {
      const r = pmRes.rows[0].role;
      if (r === 'Owner' || r === 'Admin') allowed = true;
    }

    if (!allowed) {
      const wmRes = await pool.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, req.userId]);
      if (wmRes.rows.length > 0) {
        const wr = wmRes.rows[0].role;
        if (['Owner','Admin','ProjectAdmin'].includes(wr)) allowed = true;
      }
    }

    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions to add project member' });

    await pool.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)', [projectId, uid, role]);
    res.status(201).json({ message: 'Project member added' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'User already a project member' });
    console.error('Add project member error:', err);
    res.status(500).json({ error: 'Failed to add project member' });
  }
});

// Update project member role
router.put('/:projectId/members/:userId', async (req, res) => {
  const { role } = req.body;
  const { projectId, userId } = req.params;
  const targetUserId = parseInt(userId, 10);

  try {
    // Prevent users from changing their own role
    if (targetUserId === req.userId) {
      return res.status(403).json({ error: 'You cannot change your own role. Ask another admin or owner to do this.' });
    }

    // permission: only project Owner/Admin or workspace Owner/Admin/ProjectAdmin
    const projRes = await pool.query('SELECT workspace_id FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const workspaceId = projRes.rows[0].workspace_id;

    const pmRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, req.userId]);
    const requesterProjectRole = pmRes.rows[0]?.role;
    const isRequesterProjectOwner = requesterProjectRole === 'Owner';
    const isRequesterProjectAdmin = requesterProjectRole === 'Admin';

    const wmRes = await pool.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, req.userId]);
    const requesterWorkspaceRole = wmRes.rows[0]?.role;
    const hasWorkspaceAccess = ['Owner','Admin','ProjectAdmin'].includes(requesterWorkspaceRole);
    const isRequesterWorkspaceOwner = requesterWorkspaceRole === 'Owner';
    const isRequesterWorkspaceAdmin = requesterWorkspaceRole === 'Admin';

    const allowed = isRequesterProjectOwner || isRequesterProjectAdmin || hasWorkspaceAccess;
    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions to update project member' });

    const targetRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, targetUserId]);
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Project member not found' });
    const targetRole = targetRes.rows[0].role;

    // Owner role cannot be changed (only transferred)
    if (targetRole === 'Owner') {
      return res.status(403).json({ error: 'Owner role cannot be changed. Use ownership transfer instead.' });
    }

    // Only Owner (project or workspace) can assign Owner role
    if (role === 'Owner' && !isRequesterProjectOwner && !isRequesterWorkspaceOwner) {
      return res.status(403).json({ error: 'Only project or workspace owners can assign owner role' });
    }

    // Project Admin cannot modify other Project Admins (only Owner can)
    if (targetRole === 'Admin' && isRequesterProjectAdmin && !isRequesterProjectOwner && !isRequesterWorkspaceOwner) {
      return res.status(403).json({ error: 'Project admins cannot change other admins\' access. Only Owner can modify admin roles.' });
    }

    // Workspace Admin cannot modify Project Admins (only Workspace Owner or Project Owner can)
    if (targetRole === 'Admin' && isRequesterWorkspaceAdmin && !isRequesterWorkspaceOwner && !isRequesterProjectOwner) {
      return res.status(403).json({ error: 'Workspace admins cannot change project admin access. Only Workspace Owner or Project Owner can.' });
    }

    await pool.query('UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3', [role, projectId, targetUserId]);
    res.json({ message: 'Project member updated' });
  } catch (err) {
    console.error('Update project member error:', err);
    res.status(500).json({ error: 'Failed to update project member' });
  }
});

// Remove project member
router.delete('/:projectId/members/:userId', async (req, res) => {
  const { projectId, userId } = req.params;
  const targetUserId = parseInt(userId, 10);

  try {
    // Prevent users from removing themselves
    if (targetUserId === req.userId) {
      return res.status(403).json({ error: 'You cannot remove yourself from the project.' });
    }

    const projRes = await pool.query('SELECT workspace_id FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const workspaceId = projRes.rows[0].workspace_id;

    const pmRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, req.userId]);
    const requesterProjectRole = pmRes.rows[0]?.role;
    const isRequesterProjectOwner = requesterProjectRole === 'Owner';
    const isRequesterProjectAdmin = requesterProjectRole === 'Admin';

    const wmRes = await pool.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, req.userId]);
    const requesterWorkspaceRole = wmRes.rows[0]?.role;
    const hasWorkspaceAccess = ['Owner','Admin','ProjectAdmin'].includes(requesterWorkspaceRole);
    const isRequesterWorkspaceOwner = requesterWorkspaceRole === 'Owner';
    const isRequesterWorkspaceAdmin = requesterWorkspaceRole === 'Admin';

    const allowed = isRequesterProjectOwner || isRequesterProjectAdmin || hasWorkspaceAccess;
    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions to remove project member' });

    const targetRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, targetUserId]);
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Project member not found' });
    const targetRole = targetRes.rows[0].role;

    // Cannot remove Owner (must transfer ownership first)
    if (targetRole === 'Owner') {
      return res.status(403).json({ error: 'Cannot remove project owner. Transfer ownership first.' });
    }

    // Project Admin cannot remove other Project Admins (only Owner can)
    if (targetRole === 'Admin' && isRequesterProjectAdmin && !isRequesterProjectOwner && !isRequesterWorkspaceOwner) {
      return res.status(403).json({ error: 'Project admins cannot remove other admins. Only Owner can remove admin members.' });
    }

    // Workspace Admin cannot remove Project Admins (only Workspace Owner or Project Owner can)
    if (targetRole === 'Admin' && isRequesterWorkspaceAdmin && !isRequesterWorkspaceOwner && !isRequesterProjectOwner) {
      return res.status(403).json({ error: 'Workspace admins cannot remove project admins. Only Workspace Owner or Project Owner can.' });
    }

    await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, targetUserId]);
    res.json({ message: 'Project member removed' });
  } catch (err) {
    console.error('Remove project member error:', err);
    res.status(500).json({ error: 'Failed to remove project member' });
  }
});

// Archive project
router.put('/:projectId/archive', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE projects 
       SET archived = TRUE, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [req.params.projectId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Archive project error:', err);
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

// Unarchive project
router.put('/:projectId/unarchive', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE projects 
       SET archived = FALSE, archived_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [req.params.projectId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Unarchive project error:', err);
    res.status(500).json({ error: 'Failed to unarchive project' });
  }
});

// Update last accessed timestamp
router.put('/:projectId/access', async (req, res) => {
  try {
    await pool.query(
      'UPDATE projects SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.params.projectId]
    );
    res.json({ message: 'Last accessed updated' });
  } catch (err) {
    console.error('Update last accessed error:', err);
    res.status(500).json({ error: 'Failed to update last accessed' });
  }
});

// Transfer project ownership
router.post('/:projectId/transfer-ownership', async (req, res) => {
  const { projectId } = req.params;
  const { new_owner_id, reason } = req.body;

  if (!new_owner_id) {
    return res.status(400).json({ error: 'new_owner_id is required' });
  }

  const newOwnerId = parseInt(new_owner_id, 10);
  if (!Number.isFinite(newOwnerId)) {
    return res.status(400).json({ error: 'Invalid new_owner_id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get project info
    const projRes = await client.query(
      'SELECT id, workspace_id, created_by, name FROM projects WHERE id = $1',
      [projectId]
    );
    if (projRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projRes.rows[0];

    // Check if requester is current project owner or workspace owner
    const pmRes = await client.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    const isProjectOwner = pmRes.rows[0]?.role === 'Owner';

    const wmRes = await client.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [project.workspace_id, req.userId]
    );
    const isWorkspaceOwner = wmRes.rows[0]?.role === 'Owner';

    if (!isProjectOwner && !isWorkspaceOwner) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only project owner or workspace owner can transfer ownership' });
    }

    // Verify new owner is a project member
    const newOwnerRes = await client.query(
      'SELECT user_id, role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, newOwnerId]
    );
    if (newOwnerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'New owner must be an existing project member' });
    }

    // Cannot transfer to yourself
    if (newOwnerId === req.userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot transfer ownership to yourself' });
    }

    // Find current owner
    const currentOwnerRes = await client.query(
      'SELECT user_id FROM project_members WHERE project_id = $1 AND role = $2',
      [projectId, 'Owner']
    );
    const currentOwnerId = currentOwnerRes.rows[0]?.user_id;

    // Update current owner to Admin (if exists and not the new owner)
    if (currentOwnerId && currentOwnerId !== newOwnerId) {
      await client.query(
        'UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3',
        ['Admin', projectId, currentOwnerId]
      );
    }

    // Update new owner to Owner
    await client.query(
      'UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3',
      ['Owner', projectId, newOwnerId]
    );

    // Update project created_by to reflect new owner
    await client.query(
      'UPDATE projects SET created_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newOwnerId, projectId]
    );

    // Log transfer history
    await client.query(
      `INSERT INTO project_ownership_transfers 
       (project_id, from_user_id, to_user_id, transferred_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, currentOwnerId || req.userId, newOwnerId, req.userId, reason || null]
    );

    // Log activity
    await client.query(
      `INSERT INTO activity_logs 
       (user_id, workspace_id, project_id, type, action, item_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.userId,
        project.workspace_id,
        projectId,
        'Project',
        'Ownership Transferred',
        project.name,
        `Project ownership transferred to new owner`
      ]
    );

    // Notify new owner
    await client.query(
      `INSERT INTO notifications 
       (user_id, type, title, message, project_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newOwnerId,
        'Project',
        'Project Ownership Transferred',
        `You are now the owner of project "${project.name}"`,
        projectId
      ]
    );

    await client.query('COMMIT');

    res.json({ message: 'Project ownership transferred successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transfer ownership error:', err);
    res.status(500).json({ error: 'Failed to transfer project ownership' });
  } finally {
    client.release();
  }
});

// Get project ownership transfer history
router.get('/:projectId/transfer-history', async (req, res) => {
  const { projectId } = req.params;

  try {
    // Verify access
    const accessRes = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    if (accessRes.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT 
        pot.*,
        from_user.first_name || ' ' || from_user.last_name as from_user_name,
        to_user.first_name || ' ' || to_user.last_name as to_user_name,
        transferred_by_user.first_name || ' ' || transferred_by_user.last_name as transferred_by_name
      FROM project_ownership_transfers pot
      JOIN users from_user ON pot.from_user_id = from_user.id
      JOIN users to_user ON pot.to_user_id = to_user.id
      JOIN users transferred_by_user ON pot.transferred_by = transferred_by_user.id
      WHERE pot.project_id = $1
      ORDER BY pot.transferred_at DESC
    `, [projectId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Get transfer history error:', err);
    res.status(500).json({ error: 'Failed to fetch transfer history' });
  }
});

module.exports = router;
