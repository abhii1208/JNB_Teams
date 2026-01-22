const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

const SHARE_LINK_JWT_SECRET = process.env.SHARE_LINK_JWT_SECRET || process.env.JWT_SECRET || 'dev-secret';
const SHARE_LINK_JWT_TTL = process.env.SHARE_LINK_JWT_TTL || '20m';
const SHARE_LINK_IP_SALT = process.env.SHARE_LINK_IP_SALT || SHARE_LINK_JWT_SECRET;

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.params.slug || ''}`,
});

function sendNotFound(res) {
  return res.status(404).json({ error: 'Not found' });
}

function isLinkActive(link) {
  if (!link) return false;
  if (link.revoked_at) return false;
  if (link.expires_at && new Date(link.expires_at) < new Date()) return false;
  return true;
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || '';
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto
    .createHash('sha256')
    .update(`${ip}|${SHARE_LINK_IP_SALT}`)
    .digest('hex');
}

async function fetchShareLinkBySlug(slug) {
  const result = await pool.query(
    `SELECT l.id, l.slug, l.workspace_id, l.created_at, l.expires_at, l.revoked_at,
            l.is_protected, l.password_hash, l.allowed_columns, l.task_count, l.mode, l.name,
            w.name as workspace_name, w.logo_url as workspace_logo_url
     FROM task_share_links l
     JOIN workspaces w ON w.id = l.workspace_id
     WHERE l.slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

router.get('/:slug/meta', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) return sendNotFound(res);

  try {
    const link = await fetchShareLinkBySlug(slug);
    if (!isLinkActive(link)) return sendNotFound(res);

    return res.json({
      is_protected: link.is_protected,
      expires_at: link.expires_at,
      allowed_columns: link.allowed_columns,
      task_count: link.task_count,
      mode: link.mode,
      link_name: link.name,
      workspace_name: link.workspace_name,
      workspace_logo_url: link.workspace_logo_url,
    });
  } catch (err) {
    console.error('Public share meta error:', err);
    return sendNotFound(res);
  }
});

router.post('/:slug/unlock', unlockLimiter, async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) return sendNotFound(res);

  try {
    const link = await fetchShareLinkBySlug(slug);
    if (!isLinkActive(link) || !link.is_protected) return sendNotFound(res);

    const password = String(req.body.password || '');
    const valid = await bcrypt.compare(password, link.password_hash || '');
    const ipHash = hashIp(getRequestIp(req));
    await pool.query(
      `UPDATE task_share_links
       SET unlock_attempts = unlock_attempts + 1,
           last_unlock_attempt_at = CURRENT_TIMESTAMP,
           last_unlock_attempt_ip_hash = $2,
           last_unlocked_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE last_unlocked_at END
       WHERE id = $1`,
      [link.id, ipHash, valid]
    );

    if (!valid) return sendNotFound(res);

    const token = jwt.sign(
      { shareLinkId: link.id, slug: link.slug },
      SHARE_LINK_JWT_SECRET,
      { expiresIn: SHARE_LINK_JWT_TTL }
    );

    const decoded = jwt.decode(token) || {};
    const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : null;

    return res.json({
      token,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    });
  } catch (err) {
    console.error('Public share unlock error:', err);
    return sendNotFound(res);
  }
});

router.get('/:slug/tasks', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) return sendNotFound(res);

  try {
    const link = await fetchShareLinkBySlug(slug);
    if (!isLinkActive(link)) return sendNotFound(res);

    if (link.is_protected) {
      const token = getBearerToken(req);
      if (!token) return sendNotFound(res);
      try {
        const payload = jwt.verify(token, SHARE_LINK_JWT_SECRET);
        if (Number(payload.shareLinkId) !== Number(link.id) || payload.slug !== link.slug) {
          return sendNotFound(res);
        }
      } catch (err) {
        return sendNotFound(res);
      }
    }

    const tasksResult = await pool.query(
      `SELECT s.snapshot
       FROM task_share_link_tasks lt
       JOIN task_share_link_snapshots s
         ON s.share_link_id = lt.share_link_id AND s.task_id = lt.task_id
       WHERE lt.share_link_id = $1
       ORDER BY lt.sort_order ASC, lt.task_id ASC`,
      [link.id]
    );

    const accessIpHash = hashIp(getRequestIp(req));
    await pool.query(
      `UPDATE task_share_links
       SET view_count = view_count + 1,
           last_accessed_at = CURRENT_TIMESTAMP,
           last_accessed_ip_hash = $2
       WHERE id = $1`,
      [link.id, accessIpHash]
    );

    return res.json({
      columns: link.allowed_columns,
      tasks: tasksResult.rows.map((row) => row.snapshot),
      mode: link.mode,
    });
  } catch (err) {
    console.error('Public share tasks error:', err);
    return sendNotFound(res);
  }
});

module.exports = router;
