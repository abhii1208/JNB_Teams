const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { checkWorkspaceMember } = require('./workspaces');

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
    show_settings_to_admin,
    freeze_columns,
    client_ids,
    primary_client_id,
    project_clients,
  } = req.body;

  const hasClientListUpdate = client_ids !== undefined || project_clients !== undefined;
  const hasPrimaryOnlyUpdate = !hasClientListUpdate && primary_client_id !== undefined;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedFreezeColumns = freeze_columns !== undefined && freeze_columns !== null && typeof freeze_columns === 'object'
      ? JSON.stringify(freeze_columns)
      : freeze_columns;
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
           show_settings_to_admin = COALESCE($14, show_settings_to_admin),
           freeze_columns = COALESCE($15::jsonb, freeze_columns),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $16 
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
        show_settings_to_admin,
        normalizedFreezeColumns,
        req.params.projectId,
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
      }
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

  try {
    // permission: only project Owner/Admin or workspace Owner/Admin/ProjectAdmin
    const projRes = await pool.query('SELECT workspace_id FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const workspaceId = projRes.rows[0].workspace_id;

    const pmRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, req.userId]);
    const requesterProjectRole = pmRes.rows[0]?.role;
    const isRequesterProjectOwner = requesterProjectRole === 'Owner';
    const isRequesterProjectAdmin = requesterProjectRole === 'Owner' || requesterProjectRole === 'Admin';

    const wmRes = await pool.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, req.userId]);
    const requesterWorkspaceRole = wmRes.rows[0]?.role;
    const hasWorkspaceAccess = ['Owner','Admin','ProjectAdmin'].includes(requesterWorkspaceRole);
    const isRequesterWorkspaceOwner = requesterWorkspaceRole === 'Owner';

    const allowed = isRequesterProjectAdmin || hasWorkspaceAccess;
    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions to update project member' });

    const targetRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Project member not found' });
    const targetRole = targetRes.rows[0].role;

    const canManageOwner = isRequesterProjectOwner || isRequesterWorkspaceOwner;
    if ((targetRole === 'Owner' || role === 'Owner') && !canManageOwner) {
      return res.status(403).json({ error: 'Only project owners can modify owner access' });
    }

    await pool.query('UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3', [role, projectId, userId]);
    res.json({ message: 'Project member updated' });
  } catch (err) {
    console.error('Update project member error:', err);
    res.status(500).json({ error: 'Failed to update project member' });
  }
});

// Remove project member
router.delete('/:projectId/members/:userId', async (req, res) => {
  const { projectId, userId } = req.params;

  try {
    const projRes = await pool.query('SELECT workspace_id FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const workspaceId = projRes.rows[0].workspace_id;

    const pmRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, req.userId]);
    const requesterProjectRole = pmRes.rows[0]?.role;
    const isRequesterProjectOwner = requesterProjectRole === 'Owner';
    const isRequesterProjectAdmin = requesterProjectRole === 'Owner' || requesterProjectRole === 'Admin';

    const wmRes = await pool.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, req.userId]);
    const requesterWorkspaceRole = wmRes.rows[0]?.role;
    const hasWorkspaceAccess = ['Owner','Admin','ProjectAdmin'].includes(requesterWorkspaceRole);
    const isRequesterWorkspaceOwner = requesterWorkspaceRole === 'Owner';

    const allowed = isRequesterProjectAdmin || hasWorkspaceAccess;
    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions to remove project member' });

    const targetRes = await pool.query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Project member not found' });
    const targetRole = targetRes.rows[0].role;

    const canManageOwner = isRequesterProjectOwner || isRequesterWorkspaceOwner;
    if (targetRole === 'Owner' && !canManageOwner) {
      return res.status(403).json({ error: 'Only project owners can modify owner access' });
    }

    await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
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

module.exports = router;
