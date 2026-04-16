const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const MODERATOR_ROLES = ['Owner', 'Admin', 'Manager', 'ProjectAdmin'];
const ANNOUNCEMENT_CATEGORIES = ['Meeting', 'Fest', 'Event', 'Update', 'Holiday'];
const DISPLAY_NAME_SQL = "COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email)";

function canModerate(role) {
  return MODERATOR_ROLES.includes(role);
}

function normalizeCategory(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  return ANNOUNCEMENT_CATEGORIES.find((category) => category.toLowerCase() === input.toLowerCase()) || null;
}

async function getWorkspaceContext(dbClient, workspaceId, userId) {
  const result = await dbClient.query(
    `SELECT wm.role, w.name, w.created_by
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
    [workspaceId, userId]
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    ...row,
    is_personal: row.name === 'Personal' && Number(row.created_by) === Number(userId),
    can_moderate: canModerate(row.role),
  };
}

async function getAnnouncementContext(dbClient, announcementId, userId) {
  const result = await dbClient.query(
    `SELECT
       wa.*,
       wm.role AS viewer_role,
       ${DISPLAY_NAME_SQL} AS creator_name
     FROM workspace_announcements wa
     JOIN workspace_members wm
       ON wm.workspace_id = wa.workspace_id
      AND wm.user_id = $2
     JOIN users u ON u.id = wa.created_by
     WHERE wa.id = $1`,
    [announcementId, userId]
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    ...row,
    can_moderate: canModerate(row.viewer_role),
  };
}

async function logActivity(dbClient, { userId, workspaceId, type, action, itemName, details }) {
  await dbClient.query(
    `INSERT INTO activity_logs
      (user_id, workspace_id, type, action, item_name, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, workspaceId, type, action, itemName, details]
  );
}

router.get('/workspace/:workspaceId', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  if (!Number.isInteger(workspaceId)) {
    return res.status(400).json({ error: 'Invalid workspace id' });
  }

  try {
    const workspace = await getWorkspaceContext(pool, workspaceId, req.userId);
    if (!workspace) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    if (workspace.is_personal) {
      return res.status(403).json({ error: 'Announcements are not available for personal workspaces' });
    }

    const result = await pool.query(
      `SELECT
         wa.*,
         ${DISPLAY_NAME_SQL} AS creator_name
       FROM workspace_announcements wa
       JOIN users u ON u.id = wa.created_by
       WHERE wa.workspace_id = $1
       ORDER BY wa.is_pinned DESC, COALESCE(wa.event_date, wa.created_at) DESC, wa.id DESC`,
      [workspaceId]
    );

    return res.json({
      announcements: result.rows.map((row) => ({
        ...row,
        can_moderate: workspace.can_moderate,
      })),
      categories: ANNOUNCEMENT_CATEGORIES,
      can_moderate: workspace.can_moderate,
    });
  } catch (err) {
    console.error('List announcements error:', err);
    return res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/workspace/:workspaceId', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const category = normalizeCategory(req.body.category || 'Update');
  const eventDate = req.body.event_date ? new Date(req.body.event_date) : null;
  const isPinned = req.body.is_pinned === true;

  if (!Number.isInteger(workspaceId)) {
    return res.status(400).json({ error: 'Invalid workspace id' });
  }
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }
  if (!category) {
    return res.status(400).json({ error: `Category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(', ')}` });
  }
  if (eventDate && Number.isNaN(eventDate.getTime())) {
    return res.status(400).json({ error: 'Invalid event date' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const workspace = await getWorkspaceContext(client, workspaceId, req.userId);
    if (!workspace) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    if (workspace.is_personal) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Announcements are not available for personal workspaces' });
    }
    if (!workspace.can_moderate) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only managers and admins can post announcements' });
    }

    const result = await client.query(
      `INSERT INTO workspace_announcements
        (workspace_id, created_by, title, description, category, event_date, is_pinned)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [workspaceId, req.userId, title, description, category, eventDate, isPinned]
    );

    await logActivity(client, {
      userId: req.userId,
      workspaceId,
      type: 'Announcement',
      action: 'Created',
      itemName: title,
      details: `Posted a ${category.toLowerCase()} announcement`,
    });

    await client.query('COMMIT');
    const full = await getAnnouncementContext(pool, result.rows[0].id, req.userId);
    return res.status(201).json(full || result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create announcement error:', err);
    return res.status(500).json({ error: 'Failed to create announcement' });
  } finally {
    client.release();
  }
});

router.get('/:announcementId', async (req, res) => {
  const announcementId = Number(req.params.announcementId);
  if (!Number.isInteger(announcementId)) {
    return res.status(400).json({ error: 'Invalid announcement id' });
  }

  try {
    const announcement = await getAnnouncementContext(pool, announcementId, req.userId);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    return res.json(announcement);
  } catch (err) {
    console.error('Get announcement error:', err);
    return res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

router.put('/:announcementId', async (req, res) => {
  const announcementId = Number(req.params.announcementId);
  const nextTitle = req.body.title !== undefined ? String(req.body.title || '').trim() : undefined;
  const nextDescription = req.body.description !== undefined ? String(req.body.description || '').trim() : undefined;
  const nextCategory = req.body.category !== undefined ? normalizeCategory(req.body.category) : undefined;
  const nextPinned = req.body.is_pinned !== undefined ? req.body.is_pinned === true : undefined;
  const nextEventDate =
    req.body.event_date !== undefined
      ? (req.body.event_date ? new Date(req.body.event_date) : null)
      : undefined;

  if (!Number.isInteger(announcementId)) {
    return res.status(400).json({ error: 'Invalid announcement id' });
  }
  if (req.body.title !== undefined && !nextTitle) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (req.body.description !== undefined && !nextDescription) {
    return res.status(400).json({ error: 'Description is required' });
  }
  if (req.body.category !== undefined && !nextCategory) {
    return res.status(400).json({ error: `Category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(', ')}` });
  }
  if (nextEventDate instanceof Date && Number.isNaN(nextEventDate.getTime())) {
    return res.status(400).json({ error: 'Invalid event date' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const announcement = await getAnnouncementContext(client, announcementId, req.userId);
    if (!announcement) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Announcement not found' });
    }
    if (!announcement.can_moderate) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only managers and admins can update announcements' });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (nextTitle !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(nextTitle);
    }
    if (nextDescription !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(nextDescription);
    }
    if (nextCategory !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(nextCategory);
    }
    if (nextPinned !== undefined) {
      fields.push(`is_pinned = $${paramIndex++}`);
      values.push(nextPinned);
    }
    if (nextEventDate !== undefined) {
      fields.push(`event_date = $${paramIndex++}`);
      values.push(nextEventDate);
    }

    if (!fields.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No valid changes provided' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(announcementId);

    await client.query(
      `UPDATE workspace_announcements
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}`,
      values
    );

    await logActivity(client, {
      userId: req.userId,
      workspaceId: announcement.workspace_id,
      type: 'Announcement',
      action: 'Updated',
      itemName: nextTitle || announcement.title,
      details: 'Updated announcement details',
    });

    await client.query('COMMIT');
    const updated = await getAnnouncementContext(pool, announcementId, req.userId);
    return res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update announcement error:', err);
    return res.status(500).json({ error: 'Failed to update announcement' });
  } finally {
    client.release();
  }
});

module.exports = router;
