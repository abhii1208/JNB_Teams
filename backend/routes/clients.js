const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { checkWorkspaceMember } = require('./workspaces');

const MANAGE_ROLES = new Set(['owner', 'admin']);
const VIEW_ROLES = new Set(['owner', 'admin', 'projectadmin']);
const STATUS_VALUES = new Set(['Active', 'Inactive']);
const GSTIN_REGEX = /^[0-9A-Z]{15}$/;
const PAYMENT_TERMS_ALLOWED = new Set([7, 15, 30]);

function normalizeTags(input) {
  if (Array.isArray(input)) {
    return input.map((tag) => String(tag || '').trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function toBool(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function normalizeClientName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeRole(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-z]/gi, '')
    .toLowerCase();
}

function canManageRole(value) {
  return MANAGE_ROLES.has(normalizeRole(value));
}

function canViewRole(value) {
  return VIEW_ROLES.has(normalizeRole(value));
}

function normalizeGstin(value) {
  if (value === undefined) return undefined;
  const cleaned = String(value || '').replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return null;
  if (!GSTIN_REGEX.test(cleaned)) {
    throw new Error('GSTIN must be 15 alphanumeric characters');
  }
  return cleaned;
}

function normalizePaymentTerms(value) {
  if (value === undefined) return undefined;
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  if (!match) {
    throw new Error('Payment terms must be Net 7, Net 15, or Net 30');
  }
  const days = Number.parseInt(match[1], 10);
  if (!PAYMENT_TERMS_ALLOWED.has(days)) {
    throw new Error('Payment terms must be Net 7, Net 15, or Net 30');
  }
  return `Net ${days}`;
}

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, '\\$&');
}

function normalizeOptionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

async function findSimilarClients(workspaceId, name, excludeId = null) {
  const pattern = `%${escapeLike(name.toLowerCase())}%`;
  const params = [workspaceId, pattern];
  let excludeSql = '';
  if (excludeId) {
    excludeSql = 'AND c.id != $3';
    params.push(excludeId);
  }
  const result = await pool.query(
    `SELECT c.id, c.client_name as name, c.client_code as code
     FROM clients c
     WHERE c.workspace_id = $1
       AND LOWER(c.client_name) LIKE $2 ESCAPE '\\'
       ${excludeSql}
     ORDER BY c.client_name ASC
     LIMIT 5`,
    params
  );
  return result.rows;
}

async function ensureClientCodeCounters(dbClient) {
  await dbClient.query(
    `CREATE TABLE IF NOT EXISTS client_code_counters (
      workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
      next_value INTEGER NOT NULL DEFAULT 1
    )`
  );
}

async function getNextClientCode(dbClient, workspaceId) {
  try {
    const result = await dbClient.query(
      `INSERT INTO client_code_counters (workspace_id, next_value)
       VALUES ($1, 1)
       ON CONFLICT (workspace_id) DO UPDATE
         SET next_value = client_code_counters.next_value + 1
       RETURNING next_value`,
      [workspaceId]
    );
    const nextValue = result.rows[0]?.next_value || 1;
    return `CL-${String(nextValue).padStart(6, '0')}`;
  } catch (err) {
    if (err.code === '42P01') {
      await ensureClientCodeCounters(dbClient);
      const result = await dbClient.query(
        `INSERT INTO client_code_counters (workspace_id, next_value)
         VALUES ($1, 1)
         ON CONFLICT (workspace_id) DO UPDATE
           SET next_value = client_code_counters.next_value + 1
         RETURNING next_value`,
        [workspaceId]
      );
      const nextValue = result.rows[0]?.next_value || 1;
      return `CL-${String(nextValue).padStart(6, '0')}`;
    }
    throw err;
  }
}

async function getClientAccess(clientId, userId) {
  const result = await pool.query(
    `SELECT c.workspace_id, wm.role
     FROM clients c
     JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
     WHERE c.id = $1 AND wm.user_id = $2`,
    [clientId, userId]
  );
  return result.rows[0] || null;
}

async function getWorkspaceOwnerId(workspaceId) {
  const res = await pool.query(
    'SELECT created_by FROM workspaces WHERE id = $1',
    [workspaceId]
  );
  return res.rows[0]?.created_by || null;
}

// GET /clients/workspace/:workspaceId
router.get('/workspace/:workspaceId', checkWorkspaceMember, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { status } = req.query;
    if (!canViewRole(req.workspaceRole)) {
      return res.status(403).json({ error: 'Insufficient permissions to view clients' });
    }
    const params = [workspaceId];
    let statusFilter = '';
    if (status) {
      statusFilter = 'AND c.status = $2';
      params.push(status);
    }

    const result = await pool.query(
      `SELECT
         c.id,
         c.client_name as name,
         c.client_code as code,
         c.status,
         c.owner_user_id,
         c.client_group,
         c.series_no,
         c.notes,
         c.legal_name,
         c.gstin,
         c.billing_address,
         c.default_payment_terms,
         c.tags,
         c.created_at,
         c.updated_at,
         u.first_name || ' ' || u.last_name as owner_name,
         (SELECT COUNT(DISTINCT pc.project_id)
          FROM project_clients pc
          JOIN projects p ON pc.project_id = p.id
          WHERE pc.client_id = c.id AND p.workspace_id = c.workspace_id) as project_count
       FROM clients c
       LEFT JOIN users u ON c.owner_user_id = u.id
       WHERE c.workspace_id = $1
       ${statusFilter}
       ORDER BY c.client_name ASC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET /clients/:clientId
router.get('/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId, 10);
    if (!Number.isFinite(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const access = await getClientAccess(clientId, req.userId);
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!canViewRole(access.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to view client' });
    }

    const clientResult = await pool.query(
      `SELECT
         c.id,
         c.client_name as name,
         c.client_code as code,
         c.status,
         c.owner_user_id,
         c.client_group,
         c.series_no,
         c.notes,
         c.legal_name,
         c.gstin,
         c.billing_address,
         c.default_payment_terms,
         c.tags,
         c.created_at,
         c.updated_at,
         u.first_name || ' ' || u.last_name as owner_name
       FROM clients c
       LEFT JOIN users u ON c.owner_user_id = u.id
       WHERE c.id = $1`,
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const projectsResult = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.color,
         p.icon,
         pc.role,
         pc.is_primary
       FROM project_clients pc
       JOIN projects p ON pc.project_id = p.id
       WHERE pc.client_id = $1
       ORDER BY pc.is_primary DESC, p.name ASC`,
      [clientId]
    );

    res.json({
      ...clientResult.rows[0],
      projects: projectsResult.rows,
    });
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ error: 'Failed to fetch client details' });
  }
});

// POST /clients
router.post('/', checkWorkspaceMember, async (req, res) => {
  const {
    workspace_id,
    client_name,
    status = 'Active',
    notes,
    legal_name,
    gstin,
    billing_address,
    default_payment_terms,
    client_group,
    series_no,
    tags,
    allow_duplicate,
  } = req.body;

  const normalizedName = normalizeClientName(client_name);
  if (!workspace_id || !normalizedName) {
    return res.status(400).json({ error: 'workspace_id and client_name are required' });
  }

  if (!canManageRole(req.workspaceRole)) {
    return res.status(403).json({ error: 'Insufficient permissions to create client' });
  }

  if (!STATUS_VALUES.has(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  let resolvedOwnerId = null;
  let normalizedGstin = null;
  let normalizedPaymentTerms = null;
  try {
    normalizedGstin = normalizeGstin(gstin);
    normalizedPaymentTerms = normalizePaymentTerms(default_payment_terms);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  resolvedOwnerId = await getWorkspaceOwnerId(workspace_id);
  if (!resolvedOwnerId) {
    return res.status(400).json({ error: 'Workspace owner not found' });
  }

  const normalizedTags = normalizeTags(tags);
  const allowDuplicate = toBool(allow_duplicate);
  const normalizedGroup = normalizeOptionalString(client_group);
  const normalizedSeriesNo = normalizeOptionalString(series_no);

  if (!allowDuplicate) {
    const similarClients = await findSimilarClients(workspace_id, normalizedName);
    if (similarClients.length > 0) {
      return res.status(409).json({
        error: 'Similar client name exists',
        similar_clients: similarClients,
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const clientCode = await getNextClientCode(client, workspace_id);

    const result = await client.query(
      `INSERT INTO clients
        (workspace_id, client_name, client_code, status, owner_user_id, client_group, series_no, notes, legal_name, gstin, billing_address, default_payment_terms, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING
         id,
         client_name as name,
         client_code as code,
         status,
         owner_user_id,
         client_group,
         series_no,
         notes,
         legal_name,
         gstin,
         billing_address,
         default_payment_terms,
         tags,
         created_at,
         updated_at`,
      [
        workspace_id,
        normalizedName,
        clientCode,
        status,
        resolvedOwnerId,
        normalizedGroup,
        normalizedSeriesNo,
        notes || null,
        normalizeOptionalString(legal_name),
        normalizedGstin,
        normalizeOptionalString(billing_address),
        normalizedPaymentTerms,
        normalizedTags,
      ]
    );

    await client.query(
      'INSERT INTO activity_logs (user_id, workspace_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.userId, workspace_id, 'Client', 'Created', normalizedName, 'Created client']
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Client name/GSTIN already exists' });
    }
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Failed to create client' });
  } finally {
    client.release();
  }
});

// PUT /clients/:clientId
router.put('/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId, 10);
    if (!Number.isFinite(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const access = await getClientAccess(clientId, req.userId);
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!canManageRole(access.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to update client' });
    }

    const {
      client_name,
      status,
      notes,
      legal_name,
      gstin,
      billing_address,
      default_payment_terms,
      client_group,
      series_no,
      tags,
      allow_duplicate,
    } = req.body;

    const allowDuplicate = toBool(allow_duplicate);
    const nameProvided = Object.prototype.hasOwnProperty.call(req.body, 'client_name');
    const statusProvided = Object.prototype.hasOwnProperty.call(req.body, 'status');
    let normalizedName = null;
    let normalizedGstin = undefined;
    let normalizedPaymentTerms = undefined;

    try {
      normalizedGstin = normalizeGstin(gstin);
      normalizedPaymentTerms = normalizePaymentTerms(default_payment_terms);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    if (nameProvided) {
      normalizedName = normalizeClientName(client_name);
      if (!normalizedName) {
        return res.status(400).json({ error: 'Client name cannot be empty' });
      }
    }

    if (statusProvided && !STATUS_VALUES.has(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    if (nameProvided && !allowDuplicate) {
      const similarClients = await findSimilarClients(access.workspace_id, normalizedName, clientId);
      if (similarClients.length > 0) {
        return res.status(409).json({
          error: 'Similar client name exists',
          similar_clients: similarClients,
        });
      }
    }

    const tagsValue = tags !== undefined ? normalizeTags(tags) : null;
    const groupValue = normalizeOptionalString(client_group);
    const seriesValue = normalizeOptionalString(series_no);

    const result = await pool.query(
      `UPDATE clients
       SET client_name = COALESCE($1, client_name),
           status = COALESCE($2, status),
           client_group = COALESCE($3, client_group),
           series_no = COALESCE($4, series_no),
           notes = COALESCE($5, notes),
           legal_name = COALESCE($6, legal_name),
           gstin = COALESCE($7, gstin),
           billing_address = COALESCE($8, billing_address),
           default_payment_terms = COALESCE($9, default_payment_terms),
           tags = COALESCE($10, tags),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING
         id,
         client_name as name,
         client_code as code,
         status,
         owner_user_id,
         client_group,
         series_no,
         notes,
         legal_name,
         gstin,
         billing_address,
         default_payment_terms,
         tags,
         created_at,
         updated_at`,
      [
        nameProvided ? normalizedName : null,
        statusProvided ? status : null,
        groupValue,
        seriesValue,
        notes !== undefined ? notes : null,
        normalizeOptionalString(legal_name),
        normalizedGstin,
        normalizeOptionalString(billing_address),
        normalizedPaymentTerms,
        tagsValue,
        clientId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, workspace_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.userId, access.workspace_id, 'Client', 'Updated', result.rows[0].name, 'Updated client']
      );
    } catch (logErr) {
      console.error('Activity log insert failed:', logErr);
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Client name/GSTIN already exists' });
    }
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE /clients/:clientId (soft deactivate)
router.delete('/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId, 10);
    if (!Number.isFinite(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const access = await getClientAccess(clientId, req.userId);
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!canManageRole(access.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to deactivate client' });
    }

    const result = await pool.query(
      `UPDATE clients
       SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, client_name as name`,
      [clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, workspace_id, type, action, item_name, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.userId, access.workspace_id, 'Client', 'Deactivated', result.rows[0].name, 'Marked client inactive']
      );
    } catch (logErr) {
      console.error('Activity log insert failed:', logErr);
    }

    res.json({ message: 'Client marked inactive' });
  } catch (err) {
    console.error('Deactivate client error:', err);
    res.status(500).json({ error: 'Failed to deactivate client' });
  }
});

module.exports = router;
