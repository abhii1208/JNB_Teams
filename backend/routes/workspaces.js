const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Middleware to check if user is member of workspace
async function checkWorkspaceMember(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [req.params.workspaceId || req.body.workspace_id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    req.workspaceRole = result.rows[0].role;
    next();
  } catch (err) {
    console.error('Check workspace member error:', err);
    res.status(500).json({ error: 'Access check failed' });
  }
}

// Get all workspaces for current user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, wm.role,
        (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as members,
        (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id) as projects,
        CASE WHEN w.name = 'Personal' AND w.created_by = $1 THEN true ELSE false END as is_personal
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
      ORDER BY w.created_at DESC
    `, [req.userId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get workspaces error:', err);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Create workspace
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Workspace name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const workspaceResult = await client.query(
      'INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING *',
      [name.trim(), req.userId]
    );
    
    const workspace = workspaceResult.rows[0];
    
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [workspace.id, req.userId, 'Owner']
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({ ...workspace, role: 'Owner', members: 1, projects: 0 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create workspace error:', err);
    res.status(500).json({ error: 'Failed to create workspace' });
  } finally {
    client.release();
  }
});

// Update workspace branding
router.patch('/:workspaceId', checkWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'Owner' && req.workspaceRole !== 'Admin') {
    return res.status(403).json({ error: 'Only owners and admins can update workspace branding' });
  }

  const rawLogoUrl = req.body.logo_url ?? req.body.logoUrl;
  if (rawLogoUrl === undefined) {
    return res.status(400).json({ error: 'logo_url is required' });
  }

  let logoUrl = rawLogoUrl;
  if (logoUrl === '' || logoUrl === null) {
    logoUrl = null;
  } else {
    logoUrl = String(logoUrl).trim();
    if (logoUrl.length > 500) {
      return res.status(400).json({ error: 'logo_url is too long' });
    }
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      return res.status(400).json({ error: 'logo_url must start with http:// or https://' });
    }
  }

  const workspaceId = parseInt(req.params.workspaceId, 10);
  if (Number.isNaN(workspaceId)) {
    return res.status(400).json({ error: 'Invalid workspace id' });
  }

  try {
    const result = await pool.query(
      `UPDATE workspaces
       SET logo_url = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, logo_url, updated_at`,
      [logoUrl, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Update workspace branding error:', err);
    return res.status(500).json({ error: 'Failed to update workspace branding' });
  }
});

// Get workspace members
router.get('/:workspaceId/members', checkWorkspaceMember, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.first_name, u.last_name,
        wm.role, wm.joined_at,
        (SELECT COUNT(DISTINCT pm.project_id) FROM project_members pm 
         JOIN projects p ON pm.project_id = p.id 
         WHERE p.workspace_id = $1 AND pm.user_id = u.id) as projects
      FROM users u
      JOIN workspace_members wm ON u.id = wm.user_id
      WHERE wm.workspace_id = $1
      ORDER BY wm.joined_at ASC
    `, [req.params.workspaceId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get workspace members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Add member to workspace
router.post('/:workspaceId/members', checkWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'Owner' && req.workspaceRole !== 'Admin') {
    return res.status(403).json({ error: 'Only owners and admins can add members' });
  }

  const { email, role = 'Member' } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    await pool.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [req.params.workspaceId, userId, role]
    );

    res.status(201).json({ message: 'Member added successfully' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'User is already a member' });
    }
    console.error('Add workspace member error:', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Update workspace member role
router.put('/:workspaceId/members/:userId', checkWorkspaceMember, async (req, res) => {
  // Only Owner and Admin can change roles
  if (req.workspaceRole !== 'Owner' && req.workspaceRole !== 'Admin') {
    return res.status(403).json({ error: 'Only owners and admins can change roles' });
  }

  const { userId } = req.params;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });

  try {
    if (role === 'Owner' && req.workspaceRole !== 'Owner') {
      return res.status(403).json({ error: 'Only Owner can assign Owner role' });
    }

    // Prevent changing the owner by non-owner
    const targetRes = await pool.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [req.params.workspaceId, userId]);
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    if (targetRes.rows[0].role === 'Owner' && req.workspaceRole !== 'Owner') {
      return res.status(403).json({ error: 'Only Owner can change Owner role' });
    }

    await pool.query('UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3', [role, req.params.workspaceId, userId]);
    res.json({ message: 'Role updated' });
  } catch (err) {
    console.error('Update workspace member role error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Remove workspace member
router.delete('/:workspaceId/members/:userId', checkWorkspaceMember, async (req, res) => {
  // Only Owner and Admin can remove members
  if (req.workspaceRole !== 'Owner' && req.workspaceRole !== 'Admin') {
    return res.status(403).json({ error: 'Only owners and admins can remove members' });
  }

  const { userId } = req.params;
  try {
    const targetRes = await pool.query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [req.params.workspaceId, userId]);
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    if (targetRes.rows[0].role === 'Owner') {
      return res.status(403).json({ error: 'Cannot remove the Owner from a workspace' });
    }

    await pool.query('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [req.params.workspaceId, userId]);
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Remove workspace member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = { router, checkWorkspaceMember };
