const express = require('express');
const router = express.Router();
const { pool } = require('../db');

async function getWorkspaceRoleForService(workspaceId, userId) {
  const result = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return result.rows[0]?.role || null;
}

function canManageServices(role) {
  return ['Owner', 'Admin', 'ProjectAdmin'].includes(role);
}

function isMissingServiceSchema(err) {
  return err?.code === '42P01' || err?.code === '42703';
}

router.get('/workspace/:workspaceId', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRoleForService(workspaceId, req.userId);
    if (!role) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const includeInactive = req.query.include_inactive === 'true';
    const result = await pool.query(
      `SELECT
         s.*,
         COALESCE(u.first_name || ' ' || u.last_name, u.username) AS created_by_name,
         (SELECT COUNT(*) FROM projects p WHERE p.service_id = s.id) AS project_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.service_id = s.id AND t.deleted_at IS NULL) AS task_count
       FROM services s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.workspace_id = $1
         AND s.deleted_at IS NULL
         AND ($2::boolean = true OR s.status = 'active')
       ORDER BY s.name ASC`,
      [workspaceId, includeInactive]
    );

    res.json(result.rows);
  } catch (err) {
    if (isMissingServiceSchema(err)) {
      return res.json([]);
    }
    console.error('Get services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.post('/workspace/:workspaceId', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim() || null;
  const category = String(req.body.category || '').trim() || null;
  const status = req.body.status === 'inactive' ? 'inactive' : 'active';

  if (!name) {
    return res.status(400).json({ error: 'Service name is required' });
  }

  try {
    const role = await getWorkspaceRoleForService(workspaceId, req.userId);
    if (!canManageServices(role)) {
      return res.status(403).json({ error: 'Insufficient permissions to manage services' });
    }

    const result = await pool.query(
      `INSERT INTO services (workspace_id, name, description, category, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`,
      [workspaceId, name, description, category, status, req.userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (isMissingServiceSchema(err)) {
      return res.status(503).json({ error: 'Services module is not ready until the latest database migration is applied' });
    }
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A service with this name already exists' });
    }
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

router.get('/:serviceId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         s.*,
         COALESCE(u.first_name || ' ' || u.last_name, u.username) AS created_by_name
       FROM services s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [req.params.serviceId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = result.rows[0];
    const role = await getWorkspaceRoleForService(service.workspace_id, req.userId);
    if (!role) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    res.json(service);
  } catch (err) {
    if (isMissingServiceSchema(err)) {
      return res.status(503).json({ error: 'Services module is not ready until the latest database migration is applied' });
    }
    console.error('Get service detail error:', err);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

router.put('/:serviceId', async (req, res) => {
  try {
    const serviceResult = await pool.query(
      'SELECT * FROM services WHERE id = $1 AND deleted_at IS NULL',
      [req.params.serviceId]
    );
    if (!serviceResult.rows.length) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = serviceResult.rows[0];
    const role = await getWorkspaceRoleForService(service.workspace_id, req.userId);
    if (!canManageServices(role)) {
      return res.status(403).json({ error: 'Insufficient permissions to manage services' });
    }

    const result = await pool.query(
      `UPDATE services
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           category = COALESCE($4, category),
           status = COALESCE($5, status),
           updated_by = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        req.params.serviceId,
        req.body.name ? String(req.body.name).trim() : null,
        req.body.description !== undefined ? (String(req.body.description || '').trim() || null) : null,
        req.body.category !== undefined ? (String(req.body.category || '').trim() || null) : null,
        req.body.status ? String(req.body.status).trim().toLowerCase() : null,
        req.userId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    if (isMissingServiceSchema(err)) {
      return res.status(503).json({ error: 'Services module is not ready until the latest database migration is applied' });
    }
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

router.delete('/:serviceId', async (req, res) => {
  try {
    const serviceResult = await pool.query(
      'SELECT * FROM services WHERE id = $1 AND deleted_at IS NULL',
      [req.params.serviceId]
    );
    if (!serviceResult.rows.length) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = serviceResult.rows[0];
    const role = await getWorkspaceRoleForService(service.workspace_id, req.userId);
    if (!canManageServices(role)) {
      return res.status(403).json({ error: 'Insufficient permissions to manage services' });
    }

    await pool.query(
      `UPDATE services
       SET deleted_at = CURRENT_TIMESTAMP, updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [req.params.serviceId, req.userId]
    );

    res.json({ success: true });
  } catch (err) {
    if (isMissingServiceSchema(err)) {
      return res.status(503).json({ error: 'Services module is not ready until the latest database migration is applied' });
    }
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
