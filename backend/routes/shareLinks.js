const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

const DEFAULT_EXPIRY_DAYS = 15;
const SLUG_BYTES = 18;
const SHARE_LINK_MODE = 'snapshot';

const SHAREABLE_FIELDS = {
  name: (row) => row.name,
  description: (row) => row.description,
  stage: (row) => row.stage,
  status: (row) => row.status,
  priority: (row) => row.priority,
  due_date: (row) => row.due_date,
  target_date: (row) => row.target_date,
  notes: (row) => row.notes,
  category: (row) => row.category,
  section: (row) => row.section,
  estimated_hours: (row) => row.estimated_hours,
  actual_hours: (row) => row.actual_hours,
  completion_percentage: (row) => row.completion_percentage,
  tags: (row) => row.tags,
  external_id: (row) => row.external_id,
  created_at: (row) => row.created_at,
  updated_at: (row) => row.updated_at,
  assignee_name: (row) => {
    const first = row.assignee_first_name || '';
    const last = row.assignee_last_name || '';
    const name = `${first} ${last}`.trim();
    return name || null;
  },
  assignee_email: (row) => row.assignee_email,
  project_name: (row) => row.project_name,
  client_name: (row) => row.client_name,
  client_legal_name: (row) => row.client_legal_name,
  client_series_no: (row) => row.client_series_no,
};

const SHAREABLE_FIELD_KEYS = new Set(Object.keys(SHAREABLE_FIELDS));
const ADMIN_ONLY_FIELDS = new Set([
  'notes',
  'description',
  'estimated_hours',
  'actual_hours',
  'assignee_email',
  'external_id',
  'client_legal_name',
  'client_series_no',
]);

function getPublicShareBaseUrl() {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const frontendLocalUrl = process.env.FRONTEND_URL_LOCAL || 'http://localhost:3000';
  const base = process.env.PUBLIC_SHARE_BASE_URL
    || (process.env.NODE_ENV === 'production' ? frontendUrl : frontendLocalUrl);
  return base.replace(/\/+$/, '');
}

function generateSlug() {
  return crypto.randomBytes(SLUG_BYTES)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parseExpiresAt(input) {
  if (input === undefined) {
    const date = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    return { date, usedDefault: true };
  }
  if (input === null || input === '') {
    return { date: null, usedDefault: false };
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return { error: 'Invalid expiresAt' };
  }
  return { date, usedDefault: false };
}

function parseExplicitExpiresAt(input) {
  if (input === null || input === '') {
    return { date: null };
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return { error: 'Invalid expiresAt' };
  }
  return { date };
}

function parseBooleanFlag(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function normalizeTaskIds(rawIds) {
  if (!Array.isArray(rawIds)) {
    return { error: 'taskIds must be an array', ids: [] };
  }
  if (rawIds.length === 0) {
    return { error: 'taskIds must be a non-empty array', ids: [] };
  }
  const ids = rawIds.map((value) => Number(value));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    return { error: 'taskIds must be integers', ids: [] };
  }
  const seen = new Set();
  const ordered = [];
  ids.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  });
  return { ids: ordered };
}

function normalizeColumns(rawColumns) {
  if (!Array.isArray(rawColumns)) {
    return { error: 'allowedColumns must be an array', columns: [] };
  }
  const cleaned = rawColumns
    .map((column) => String(column || '').trim().toLowerCase())
    .filter((column) => column.length > 0);
  const seen = new Set();
  const columns = [];
  cleaned.forEach((column) => {
    if (!seen.has(column)) {
      seen.add(column);
      columns.push(column);
    }
  });
  if (columns.length === 0) {
    return { error: 'allowedColumns must be a non-empty array', columns: [] };
  }
  const invalid = columns.filter((column) => !SHAREABLE_FIELD_KEYS.has(column));
  if (invalid.length > 0) {
    return { error: `Invalid columns: ${invalid.join(', ')}`, columns: [] };
  }
  return { columns };
}

function buildSnapshot(row, columns) {
  const snapshot = {};
  columns.forEach((column) => {
    const getter = SHAREABLE_FIELDS[column];
    const value = getter ? getter(row) : null;
    snapshot[column] = value === undefined ? null : value;
  });
  return snapshot;
}

async function insertShareLink(client, {
  workspaceId,
  createdBy,
  expiresAt,
  isProtected,
  passwordHash,
  allowedColumns,
  taskCount,
  name,
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = generateSlug();
    const result = await client.query(
      `INSERT INTO task_share_links
        (slug, workspace_id, created_by, expires_at, is_protected, password_hash, allowed_columns, task_count, mode, name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id, slug, workspace_id, created_by, created_at, expires_at, revoked_at, name,
                 is_protected, allowed_columns, task_count, mode`,
      [
        slug,
        workspaceId,
        createdBy,
        expiresAt,
        isProtected,
        passwordHash,
        allowedColumns,
        taskCount,
        SHARE_LINK_MODE,
        name,
      ]
    );
    if (result.rows.length > 0) {
      return result.rows[0];
    }
  }
  const err = new Error('Failed to generate unique share link');
  err.status = 500;
  throw err;
}

async function insertShareLinkTasks(client, shareLinkId, taskIds) {
  const values = [];
  const params = [];
  let paramIndex = 1;
  taskIds.forEach((taskId, index) => {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
    params.push(shareLinkId, taskId, index);
    paramIndex += 3;
  });
  await client.query(
    `INSERT INTO task_share_link_tasks (share_link_id, task_id, sort_order)
     VALUES ${values.join(', ')}`,
    params
  );
}

async function insertShareLinkSnapshots(client, shareLinkId, taskIds, snapshots) {
  const values = [];
  const params = [];
  let paramIndex = 1;
  taskIds.forEach((taskId, index) => {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
    params.push(shareLinkId, taskId, snapshots[index]);
    paramIndex += 3;
  });
  await client.query(
    `INSERT INTO task_share_link_snapshots (share_link_id, task_id, snapshot)
     VALUES ${values.join(', ')}`,
    params
  );
}

router.post('/', async (req, res) => {
  const workspaceId = Number(req.body.workspaceId);
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  const { ids: taskIds, error: taskIdError } = normalizeTaskIds(req.body.taskIds);
  if (taskIdError) {
    return res.status(400).json({ error: taskIdError });
  }

  const { columns: allowedColumns, error: columnsError } = normalizeColumns(req.body.allowedColumns);
  if (columnsError) {
    return res.status(400).json({ error: columnsError });
  }

  const rawName = req.body.name ?? req.body.linkName;
  let linkName = null;
  if (rawName !== undefined) {
    linkName = String(rawName || '').trim();
    if (!linkName) {
      linkName = null;
    } else if (linkName.length > 120) {
      return res.status(400).json({ error: 'name must be 120 characters or less' });
    }
  }

  const protection = String(req.body.protection || 'open').toLowerCase();
  if (protection !== 'open' && protection !== 'password') {
    return res.status(400).json({ error: 'protection must be open or password' });
  }

  const isProtected = protection === 'password';
  const password = isProtected ? String(req.body.password || '') : null;
  if (isProtected && password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const { date: expiresAt, error: expiresError } = parseExpiresAt(req.body.expiresAt);
  if (expiresError) {
    return res.status(400).json({ error: expiresError });
  }
  if (expiresAt && expiresAt <= new Date()) {
    return res.status(400).json({ error: 'expiresAt must be in the future' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const memberRes = await client.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.userId]
    );
    if (memberRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    const memberRole = memberRes.rows[0].role;
    const isAdmin = memberRole === 'Owner' || memberRole === 'Admin';
    const restrictedColumns = allowedColumns.filter((column) => ADMIN_ONLY_FIELDS.has(column));
    if (restrictedColumns.length > 0 && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Selected columns require admin access' });
    }

    const taskRes = await client.query(
      `SELECT t.id, t.name, t.description, t.stage, t.status, t.priority, t.due_date, t.target_date,
              t.notes, t.category, t.section, t.estimated_hours, t.actual_hours, t.completion_percentage,
              t.tags, t.external_id, t.created_at, t.updated_at,
              p.name as project_name,
              u.first_name as assignee_first_name,
              u.last_name as assignee_last_name,
              u.email as assignee_email,
              c.client_name,
              c.legal_name as client_legal_name,
              c.series_no as client_series_no
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN clients c ON t.client_id = c.id
       WHERE t.id = ANY($1::int[])
         AND p.workspace_id = $3
         AND t.deleted_at IS NULL`,
      [taskIds, req.userId, workspaceId]
    );

    if (taskRes.rows.length !== taskIds.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied to one or more tasks' });
    }

    const taskMap = new Map(taskRes.rows.map((row) => [row.id, row]));
    const snapshots = taskIds.map((taskId) => buildSnapshot(taskMap.get(taskId), allowedColumns));

    const passwordHash = isProtected ? await bcrypt.hash(password, 12) : null;
    const shareLink = await insertShareLink(client, {
      workspaceId,
      createdBy: req.userId,
      expiresAt,
      isProtected,
      passwordHash,
      allowedColumns,
      taskCount: taskIds.length,
      name: linkName,
    });

    await insertShareLinkTasks(client, shareLink.id, taskIds);
    await insertShareLinkSnapshots(client, shareLink.id, taskIds, snapshots);

    await client.query('COMMIT');

    const baseUrl = getPublicShareBaseUrl();
    return res.status(201).json({
      ...shareLink,
      url: `${baseUrl}/share/${shareLink.slug}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create share link error:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: status === 500 ? 'Failed to create share link' : err.message });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const workspaceId = Number(req.query.workspaceId);
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  const includeAll = parseBooleanFlag(req.query.include_all);
  const includeCreator = parseBooleanFlag(req.query.include_creator);
  const status = req.query.status ? String(req.query.status).toLowerCase() : null;
  const search = req.query.q ? String(req.query.q).trim() : null;
  const sortByRaw = req.query.sort_by ? String(req.query.sort_by).toLowerCase() : 'created_at';
  const sortOrder = req.query.sort_order === 'asc' ? 'ASC' : 'DESC';
  const validSortBy = new Set([
    'created_at',
    'expires_at',
    'task_count',
    'status',
    'last_accessed_at',
    'view_count',
  ]);
  const sortBy = validSortBy.has(sortByRaw) ? sortByRaw : 'created_at';

  try {
    const memberRes = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.userId]
    );
    if (memberRes.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    const memberRole = memberRes.rows[0].role;
    const isAdmin = memberRole === 'Owner' || memberRole === 'Admin';
    if (includeAll && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed to view all share links' });
    }

    const params = [workspaceId];
    let paramIndex = 2;
    const creatorSelect = includeCreator
      ? ', u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.email AS created_by_email, u.username AS created_by_username'
      : '';
    const creatorJoin = includeCreator ? ' LEFT JOIN users u ON u.id = l.created_by' : '';
    let query = `
      SELECT l.id, l.slug, l.workspace_id, l.created_by, l.created_at, l.expires_at, l.revoked_at,
             l.is_protected, l.allowed_columns, l.task_count, l.mode, l.view_count, l.last_accessed_at, l.name,
             l.unlock_attempts, l.last_unlocked_at${creatorSelect},
             CASE
               WHEN l.revoked_at IS NOT NULL THEN 'revoked'
               WHEN l.expires_at IS NOT NULL AND l.expires_at < CURRENT_TIMESTAMP THEN 'expired'
               ELSE 'active'
             END AS status
      FROM task_share_links l
      ${creatorJoin}
      WHERE l.workspace_id = $1
    `;

    if (!includeAll) {
      query += ` AND l.created_by = $${paramIndex}`;
      params.push(req.userId);
      paramIndex += 1;
    }

    if (search) {
      query += ` AND (l.slug ILIKE $${paramIndex} OR l.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex += 1;
    }

    if (status === 'active') {
      query += ' AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at >= CURRENT_TIMESTAMP)';
    } else if (status === 'expired') {
      query += ' AND l.revoked_at IS NULL AND l.expires_at IS NOT NULL AND l.expires_at < CURRENT_TIMESTAMP';
    } else if (status === 'revoked') {
      query += ' AND l.revoked_at IS NOT NULL';
    }

    const statusOrder = `CASE
      WHEN l.revoked_at IS NOT NULL THEN 3
      WHEN l.expires_at IS NOT NULL AND l.expires_at < CURRENT_TIMESTAMP THEN 2
      ELSE 1
    END`;
    let orderExpr = 'l.created_at';
    if (sortBy === 'expires_at') orderExpr = 'l.expires_at';
    if (sortBy === 'task_count') orderExpr = 'l.task_count';
    if (sortBy === 'status') orderExpr = statusOrder;
    if (sortBy === 'last_accessed_at') orderExpr = 'l.last_accessed_at';
    if (sortBy === 'view_count') orderExpr = 'l.view_count';

    if (sortBy === 'expires_at') {
      query += ` ORDER BY ${orderExpr} ${sortOrder} NULLS LAST`;
    } else {
      query += ` ORDER BY ${orderExpr} ${sortOrder}`;
    }

    const result = await pool.query(query, params);
    const baseUrl = getPublicShareBaseUrl();
    const items = result.rows.map((row) => ({
      ...row,
      url: `${baseUrl}/share/${row.slug}`,
    }));
    return res.json({ items, total: items.length });
  } catch (err) {
    console.error('List share links error:', err);
    return res.status(500).json({ error: 'Failed to list share links' });
  }
});

router.delete('/:id', async (req, res) => {
  const linkId = Number(req.params.id);
  if (!Number.isInteger(linkId) || linkId <= 0) {
    return res.status(400).json({ error: 'Invalid share link id' });
  }

  try {
    const result = await pool.query(
      `SELECT l.id, l.created_by, wm.role
       FROM task_share_links l
       JOIN workspace_members wm ON wm.workspace_id = l.workspace_id AND wm.user_id = $2
       WHERE l.id = $1`,
      [linkId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    const link = result.rows[0];
    const isOwnerOrAdmin = link.role === 'Owner' || link.role === 'Admin';
    const isCreator = Number(link.created_by) === Number(req.userId);
    if (!isOwnerOrAdmin && !isCreator) {
      return res.status(403).json({ error: 'Not allowed to revoke this share link' });
    }

    await pool.query(
      'UPDATE task_share_links SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1',
      [linkId]
    );
    return res.status(204).send();
  } catch (err) {
    console.error('Revoke share link error:', err);
    return res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

router.patch('/:id', async (req, res) => {
  const linkId = Number(req.params.id);
  if (!Number.isInteger(linkId) || linkId <= 0) {
    return res.status(400).json({ error: 'Invalid share link id' });
  }

  if (!Object.prototype.hasOwnProperty.call(req.body, 'expiresAt')) {
    return res.status(400).json({ error: 'expiresAt is required' });
  }

  const { date: expiresAt, error: expiresError } = parseExplicitExpiresAt(req.body.expiresAt);
  if (expiresError) {
    return res.status(400).json({ error: expiresError });
  }
  if (expiresAt && expiresAt <= new Date()) {
    return res.status(400).json({ error: 'expiresAt must be in the future' });
  }

  try {
    const result = await pool.query(
      `SELECT l.id, l.created_by, l.revoked_at, wm.role
       FROM task_share_links l
       JOIN workspace_members wm ON wm.workspace_id = l.workspace_id AND wm.user_id = $2
       WHERE l.id = $1`,
      [linkId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    const link = result.rows[0];
    if (link.revoked_at) {
      return res.status(400).json({ error: 'Revoked links cannot be updated' });
    }

    const isOwnerOrAdmin = link.role === 'Owner' || link.role === 'Admin';
    const isCreator = Number(link.created_by) === Number(req.userId);
    if (!isOwnerOrAdmin && !isCreator) {
      return res.status(403).json({ error: 'Not allowed to update this share link' });
    }

    const updateRes = await pool.query(
      `UPDATE task_share_links
       SET expires_at = $2
       WHERE id = $1
       RETURNING id, slug, workspace_id, created_by, created_at, expires_at, revoked_at,
                 is_protected, allowed_columns, task_count, mode, view_count, last_accessed_at, name`,
      [linkId, expiresAt]
    );

    const row = updateRes.rows[0];
    const statusLabel = row.revoked_at
      ? 'revoked'
      : (row.expires_at && new Date(row.expires_at) < new Date() ? 'expired' : 'active');

    return res.json({ ...row, status: statusLabel });
  } catch (err) {
    console.error('Update share link error:', err);
    return res.status(500).json({ error: 'Failed to update share link' });
  }
});

module.exports = router;
