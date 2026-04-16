const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const notificationService = require('../services/notificationService');

const SUPPORT_CATEGORIES = ['Technical', 'HR', 'General', 'Billing', 'Access', 'Suggestion', 'Feedback'];
const SUPPORT_STATUSES = ['Open', 'In Progress', 'Resolved'];
const SUPPORT_STAFF_ROLES = ['Owner', 'Admin', 'Manager', 'ProjectAdmin'];

const normalizeCategory = (value) => {
  const input = String(value || '').trim();
  if (!input) return null;
  return SUPPORT_CATEGORIES.find((category) => category.toLowerCase() === input.toLowerCase()) || null;
};

const normalizeStatus = (value) => {
  const input = String(value || '').trim();
  if (!input) return null;
  return SUPPORT_STATUSES.find((status) => status.toLowerCase() === input.toLowerCase()) || null;
};

const canManageTickets = (role) => SUPPORT_STAFF_ROLES.includes(role);

async function logActivity(dbClient, { userId, workspaceId, type, action, itemName, details }) {
  await dbClient.query(
    `INSERT INTO activity_logs
      (user_id, workspace_id, type, action, item_name, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, workspaceId, type, action, itemName, details]
  );
}

async function getWorkspaceMembership(dbClient, workspaceId, userId) {
  const result = await dbClient.query(
    `SELECT wm.role
     FROM workspace_members wm
     WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
    [workspaceId, userId]
  );
  return result.rows[0] || null;
}

async function getTicketAccessContext(dbClient, ticketId, userId) {
  const result = await dbClient.query(
    `SELECT
       st.*,
       wm.role AS workspace_role,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS creator_name
     FROM support_tickets st
     JOIN workspace_members wm
       ON wm.workspace_id = st.workspace_id
      AND wm.user_id = $2
     JOIN users u ON u.id = st.created_by
     WHERE st.id = $1`,
    [ticketId, userId]
  );

  if (result.rows.length === 0) return null;

  const context = result.rows[0];
  context.can_manage = canManageTickets(context.workspace_role);
  context.can_view = context.can_manage || Number(context.created_by) === Number(userId);
  return context;
}

async function getSupportStaffIds(dbClient, workspaceId, excludeUserId = null) {
  const params = [workspaceId, SUPPORT_STAFF_ROLES];
  let query = `
    SELECT DISTINCT user_id
    FROM workspace_members
    WHERE workspace_id = $1
      AND role = ANY($2::text[])`;

  if (excludeUserId) {
    query += ' AND user_id != $3';
    params.push(excludeUserId);
  }

  const result = await dbClient.query(query, params);
  return result.rows.map((row) => row.user_id);
}

async function getTicketParticipantIds(dbClient, ticketId, excludeUserId = null) {
  const params = [ticketId];
  let query = `
    SELECT DISTINCT user_id
    FROM (
      SELECT created_by AS user_id FROM support_tickets WHERE id = $1
      UNION
      SELECT user_id FROM support_ticket_comments WHERE ticket_id = $1
    ) participants
    WHERE user_id IS NOT NULL`;

  if (excludeUserId) {
    query += ' AND user_id != $2';
    params.push(excludeUserId);
  }

  const result = await dbClient.query(query, params);
  return result.rows.map((row) => row.user_id);
}

router.get('/meta/options', async (_req, res) => {
  res.json({ categories: SUPPORT_CATEGORIES, statuses: SUPPORT_STATUSES });
});

router.get('/workspace/:workspaceId/tickets', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  if (!Number.isInteger(workspaceId)) {
    return res.status(400).json({ error: 'Invalid workspace id' });
  }

  try {
    const membership = await getWorkspaceMembership(pool, workspaceId, req.userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const canManage = canManageTickets(membership.role);
    const params = [workspaceId];
    let visibilityClause = '';

    if (!canManage) {
      params.push(req.userId);
      visibilityClause = 'AND st.created_by = $2';
    }

    const result = await pool.query(
      `SELECT
         st.*,
         COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS creator_name,
         COUNT(stc.id)::int AS comment_count,
         MAX(stc.created_at) AS last_comment_at
       FROM support_tickets st
       JOIN users u ON u.id = st.created_by
       LEFT JOIN support_ticket_comments stc ON stc.ticket_id = st.id
       WHERE st.workspace_id = $1
         ${visibilityClause}
       GROUP BY st.id, u.id
       ORDER BY
         CASE st.status
           WHEN 'Open' THEN 0
           WHEN 'In Progress' THEN 1
           ELSE 2
         END,
         st.updated_at DESC,
         st.id DESC`,
      params
    );

    res.json({
      tickets: result.rows,
      categories: SUPPORT_CATEGORIES,
      statuses: SUPPORT_STATUSES,
      can_manage: canManage,
    });
  } catch (err) {
    console.error('List support tickets error:', err);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

router.post('/workspace/:workspaceId/tickets', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  const category = normalizeCategory(req.body.category);
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();

  if (!Number.isInteger(workspaceId)) {
    return res.status(400).json({ error: 'Invalid workspace id' });
  }
  if (!category) {
    return res.status(400).json({ error: `Category must be one of: ${SUPPORT_CATEGORIES.join(', ')}` });
  }
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const membership = await getWorkspaceMembership(client, workspaceId, req.userId);
    if (!membership) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const ticketResult = await client.query(
      `INSERT INTO support_tickets (workspace_id, created_by, category, title, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [workspaceId, req.userId, category, title, description]
    );

    const ticket = ticketResult.rows[0];

    await logActivity(client, {
      userId: req.userId,
      workspaceId,
      type: 'Support Ticket',
      action: 'Created',
      itemName: title,
      details: `Raised a ${category} support ticket`,
    });

    await client.query('COMMIT');

    try {
      const supportStaffIds = await getSupportStaffIds(pool, workspaceId, req.userId);
      await notificationService.createBulkNotifications(
        supportStaffIds.map((userId) => ({
          userId,
          type: notificationService.NOTIFICATION_TYPES.SUPPORT_TICKET_CREATED,
          title: `New ${category} ticket`,
          message: title,
          workspaceId,
          supportTicketId: ticket.id,
          senderId: req.userId,
          metadata: { category, title },
        }))
      );
    } catch (notifyErr) {
      console.error('Support ticket create notification error:', notifyErr);
    }

    res.status(201).json(ticket);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create support ticket error:', err);
    res.status(500).json({ error: 'Failed to create support ticket' });
  } finally {
    client.release();
  }
});

router.get('/:ticketId', async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  try {
    const context = await getTicketAccessContext(pool, ticketId, req.userId);
    if (!context || !context.can_view) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    const counts = await pool.query(
      `SELECT COUNT(*)::int AS comment_count
       FROM support_ticket_comments
       WHERE ticket_id = $1`,
      [ticketId]
    );

    res.json({
      ...context,
      comment_count: counts.rows[0]?.comment_count || 0,
    });
  } catch (err) {
    console.error('Get support ticket error:', err);
    res.status(500).json({ error: 'Failed to fetch support ticket' });
  }
});

router.put('/:ticketId', async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  const title = req.body.title !== undefined ? String(req.body.title || '').trim() : undefined;
  const description = req.body.description !== undefined ? String(req.body.description || '').trim() : undefined;
  const category = req.body.category !== undefined ? normalizeCategory(req.body.category) : undefined;
  const status = req.body.status !== undefined ? normalizeStatus(req.body.status) : undefined;

  if (req.body.title !== undefined && !title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (req.body.description !== undefined && !description) {
    return res.status(400).json({ error: 'Description is required' });
  }
  if (req.body.category !== undefined && !category) {
    return res.status(400).json({ error: `Category must be one of: ${SUPPORT_CATEGORIES.join(', ')}` });
  }
  if (req.body.status !== undefined && !status) {
    return res.status(400).json({ error: `Status must be one of: ${SUPPORT_STATUSES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const context = await getTicketAccessContext(client, ticketId, req.userId);
    if (!context || !context.can_view) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    const isCreator = Number(context.created_by) === Number(req.userId);
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    if (status !== undefined) {
      if (!context.can_manage && !isCreator) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'You cannot update ticket status' });
      }
      if (!context.can_manage && !['Open', 'Resolved'].includes(status)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Only support staff can move tickets to In Progress' });
      }
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (fields.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No valid changes provided' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(ticketId);

    const updatedResult = await client.query(
      `UPDATE support_tickets
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    const updated = updatedResult.rows[0];

    await logActivity(client, {
      userId: req.userId,
      workspaceId: context.workspace_id,
      type: 'Support Ticket',
      action: 'Updated',
      itemName: updated.title,
      details: 'Updated ticket details',
    });

    await client.query('COMMIT');

    if (status && status !== context.status) {
      try {
        const participantIds = await getTicketParticipantIds(pool, ticketId, req.userId);
        await notificationService.createBulkNotifications(
          participantIds.map((userId) => ({
            userId,
            type: notificationService.NOTIFICATION_TYPES.SUPPORT_TICKET_STATUS_CHANGED,
            title: `Ticket status changed to ${status}`,
            message: updated.title,
            workspaceId: context.workspace_id,
            supportTicketId: ticketId,
            senderId: req.userId,
            metadata: { status, title: updated.title },
          }))
        );
      } catch (notifyErr) {
        console.error('Support ticket status notification error:', notifyErr);
      }
    }

    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update support ticket error:', err);
    res.status(500).json({ error: 'Failed to update support ticket' });
  } finally {
    client.release();
  }
});

router.delete('/:ticketId', async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const context = await getTicketAccessContext(client, ticketId, req.userId);
    if (!context || !context.can_view) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    const isCreator = Number(context.created_by) === Number(req.userId);
    if (!context.can_manage && !isCreator) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You cannot delete this ticket' });
    }

    await logActivity(client, {
      userId: req.userId,
      workspaceId: context.workspace_id,
      type: 'Support Ticket',
      action: 'Deleted',
      itemName: context.title,
      details: `Deleted support ticket "${context.title}"`,
    });

    await client.query('DELETE FROM support_tickets WHERE id = $1', [ticketId]);
    await client.query('COMMIT');

    res.json({ message: 'Support ticket deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete support ticket error:', err);
    res.status(500).json({ error: 'Failed to delete support ticket' });
  } finally {
    client.release();
  }
});

router.get('/:ticketId/comments', async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  try {
    const context = await getTicketAccessContext(pool, ticketId, req.userId);
    if (!context || !context.can_view) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    const result = await pool.query(
      `SELECT
         stc.*,
         COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS user_name
       FROM support_ticket_comments stc
       JOIN users u ON u.id = stc.user_id
       WHERE stc.ticket_id = $1
       ORDER BY stc.created_at ASC, stc.id ASC`,
      [ticketId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get support ticket comments error:', err);
    res.status(500).json({ error: 'Failed to fetch ticket comments' });
  }
});

router.post('/:ticketId/comments', async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  const comment = String(req.body.comment || '').trim();

  if (!Number.isInteger(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }
  if (!comment) {
    return res.status(400).json({ error: 'Comment is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const context = await getTicketAccessContext(client, ticketId, req.userId);
    if (!context || !context.can_view) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    const commentResult = await client.query(
      `INSERT INTO support_ticket_comments (ticket_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [ticketId, req.userId, comment]
    );

    await client.query(
      `UPDATE support_tickets
       SET updated_at = CURRENT_TIMESTAMP,
           status = CASE
             WHEN status = 'Resolved' AND created_by = $2 THEN 'Open'
             ELSE status
           END
       WHERE id = $1`,
      [ticketId, req.userId]
    );

    await logActivity(client, {
      userId: req.userId,
      workspaceId: context.workspace_id,
      type: 'Support Ticket',
      action: 'Commented',
      itemName: context.title,
      details: 'Added a support ticket reply',
    });

    await client.query('COMMIT');

    try {
      const participantIds = await getTicketParticipantIds(pool, ticketId, req.userId);
      const supportStaffIds = await getSupportStaffIds(pool, context.workspace_id, req.userId);
      const recipientIds = Array.from(new Set([...participantIds, ...supportStaffIds]));
      const preview = comment.length > 140 ? `${comment.slice(0, 137)}...` : comment;

      await notificationService.createBulkNotifications(
        recipientIds.map((userId) => ({
          userId,
          type: notificationService.NOTIFICATION_TYPES.SUPPORT_TICKET_RESPONSE,
          title: `New reply on "${context.title}"`,
          message: preview,
          workspaceId: context.workspace_id,
          supportTicketId: ticketId,
          senderId: req.userId,
          metadata: { comment: preview, title: context.title },
        }))
      );
    } catch (notifyErr) {
      console.error('Support ticket comment notification error:', notifyErr);
    }

    res.status(201).json(commentResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add support ticket comment error:', err);
    res.status(500).json({ error: 'Failed to add ticket comment' });
  } finally {
    client.release();
  }
});

module.exports = router;
