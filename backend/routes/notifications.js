const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get notifications for current user
router.get('/', async (req, res) => {
  const { read } = req.query;
  
  try {
    let query = `
      SELECT n.*,
        p.name as project_name,
        t.name as task_name
      FROM notifications n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.user_id = $1
    `;
    
    const params = [req.userId];
    
    if (read === 'true') {
      query += ' AND n.read = true';
    } else if (read === 'false') {
      query += ' AND n.read = false';
    }
    
    query += ' ORDER BY n.created_at DESC LIMIT 100';
    
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
