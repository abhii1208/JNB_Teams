const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getUserPreferences } = require('../services/notificationService');

// ========== STATIC ROUTES FIRST ==========

// Get notifications for current user
router.get('/', async (req, res) => {
  const { read, type, limit = 100, offset = 0 } = req.query;
  
  try {
    let query = `
      SELECT n.*,
        p.name as project_name,
        t.name as task_name,
        ct.name as thread_name,
        c.client_name,
        CASE 
          WHEN sender.first_name IS NOT NULL AND sender.last_name IS NOT NULL 
          THEN sender.first_name || ' ' || sender.last_name
          ELSE sender.username 
        END as sender_name,
        sender.email as sender_email
      FROM notifications n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN tasks t ON n.task_id = t.id
      LEFT JOIN chat_threads ct ON n.chat_thread_id = ct.id
      LEFT JOIN clients c ON n.client_id = c.id
      LEFT JOIN users sender ON n.sender_id = sender.id
      WHERE n.user_id = $1
    `;
    
    const params = [req.userId];
    let paramIndex = 2;
    
    if (read === 'true') {
      query += ' AND n.read = true';
    } else if (read === 'false') {
      query += ' AND n.read = false';
    }
    
    if (type) {
      query += ` AND n.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread count
router.get('/count', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false',
      [req.userId]
    );
    
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Get notification count error:', err);
    res.status(500).json({ error: 'Failed to get notification count' });
  }
});

// Get notification stats
router.get('/stats', async (req, res) => {
  try {
    // Simplified stats query
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE read = false)::int as unread_count,
        COUNT(*) FILTER (WHERE read = true)::int as read_count,
        COUNT(*)::int as total_count
       FROM notifications WHERE user_id = $1`,
      [req.userId]
    );
    
    const typeResult = await pool.query(
      `SELECT type, COUNT(*)::int as count
       FROM notifications WHERE user_id = $1
       GROUP BY type`,
      [req.userId]
    );
    
    const byType = {};
    typeResult.rows.forEach(row => {
      byType[row.type] = row.count;
    });
    
    res.json({
      ...statsResult.rows[0],
      by_type: byType
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

// Get notification preferences
router.get('/preferences', async (req, res) => {
  const { workspace_id } = req.query;
  
  try {
    const prefs = await getUserPreferences(req.userId, workspace_id ? parseInt(workspace_id) : null);
    res.json(prefs);
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [req.userId]
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all as read error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Update notification preferences
router.put('/preferences', async (req, res) => {
  const { workspace_id, ...preferences } = req.body;
  
  try {
    // Build dynamic update query
    const allowedFields = [
      'task_assigned', 'task_unassigned', 'task_due_date_changed', 'task_mentioned',
      'task_attachment', 'task_comment', 'task_completed', 'task_liked', 'task_dependency_changed',
      'comment_liked', 'attachment_liked',
      'chat_direct_message', 'chat_group_message', 'chat_mentioned',
      'project_settings_changed', 'project_member_added', 'project_member_removed', 'project_role_changed',
      'client_added', 'client_changed',
      'approval_requested', 'approval_approved', 'approval_rejected',
      'email_enabled', 'email_digest', 'push_enabled', 'in_app_enabled',
      'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end'
    ];
    
    const updates = {};
    for (const field of allowedFields) {
      if (preferences[field] !== undefined) {
        updates[field] = preferences[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid preferences to update' });
    }
    
    // Upsert preferences
    const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 3}`);
    const values = [req.userId, workspace_id || null, ...Object.values(updates)];
    
    const result = await pool.query(
      `INSERT INTO notification_preferences (user_id, workspace_id, ${Object.keys(updates).join(', ')})
       VALUES ($1, $2, ${Object.keys(updates).map((_, i) => `$${i + 3}`).join(', ')})
       ON CONFLICT (user_id, workspace_id) 
       DO UPDATE SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      values
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Delete all read notifications
router.delete('/clear-read', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 AND read = true RETURNING id',
      [req.userId]
    );
    
    res.json({ message: 'Read notifications cleared', count: result.rowCount });
  } catch (err) {
    console.error('Clear read notifications error:', err);
    res.status(500).json({ error: 'Failed to clear read notifications' });
  }
});

// ========== DYNAMIC/PARAMETERIZED ROUTES LAST ==========

// Mark notification as read
router.put('/:notificationId/read', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.notificationId, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Delete notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.notificationId, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
