const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { checkWorkspaceMember } = require('./workspaces');

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
           LIMIT 5) as members
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
  const { name, description, workspace_id, icon = 'folder', color = '#0f766e' } = req.body;

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
  const { name, description, icon, color, status } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE projects 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description),
           icon = COALESCE($3, icon),
           color = COALESCE($4, color),
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 
       RETURNING *`,
      [name, description, icon, color, status, req.params.projectId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project' });
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

    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions to update project member' });

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

    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions to remove project member' });

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
