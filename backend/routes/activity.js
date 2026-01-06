const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get activity logs with filters
router.get('/', async (req, res) => {
  const { type, workspace_id, project_id, start_date, end_date, page = 1, limit = 50 } = req.query;
  
  try {
    let query = `
      SELECT a.*,
        u.first_name || ' ' || u.last_name as user_name,
        u.username
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (type) {
      params.push(type);
      query += ` AND a.type = $${params.length}`;
    }
    
    if (workspace_id) {
      params.push(workspace_id);
      query += ` AND a.workspace_id = $${params.length}`;
    }
    
    if (project_id) {
      params.push(project_id);
      query += ` AND a.project_id = $${params.length}`;
    }
    
    if (start_date) {
      params.push(start_date);
      query += ` AND a.created_at >= $${params.length}`;
    }
    
    if (end_date) {
      params.push(end_date);
      query += ` AND a.created_at <= $${params.length}`;
    }
    
    query += ' ORDER BY a.created_at DESC';
    
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await pool.query(query, params);
    
    const countQuery = query.split('ORDER BY')[0];
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${countQuery}) as count_query`,
      params.slice(0, -2)
    );
    
    res.json({
      activities: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    });
  } catch (err) {
    console.error('Get activity logs error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

module.exports = router;
