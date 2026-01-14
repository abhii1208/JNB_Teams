const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// =====================================================
// USER VIEW PREFERENCES
// =====================================================

/**
 * GET /api/preferences/workspace/:workspaceId
 * Get user's view preferences for a workspace
 */
router.get('/workspace/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  
  try {
    // First check if preferences exist
    let result = await pool.query(`
      SELECT *
      FROM user_view_preferences
      WHERE user_id = $1 AND workspace_id = $2
    `, [req.userId, workspaceId]);
    
    if (result.rows.length === 0) {
      // Create default preferences
      result = await pool.query(`
        INSERT INTO user_view_preferences (user_id, workspace_id)
        VALUES ($1, $2)
        RETURNING *
      `, [req.userId, workspaceId]);
    }
    
    // Update last_active_at
    await pool.query(`
      UPDATE user_view_preferences 
      SET last_active_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND workspace_id = $2
    `, [req.userId, workspaceId]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user preferences:', err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/preferences/workspace/:workspaceId
 * Update user's view preferences for a workspace
 */
router.put('/workspace/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  const {
    last_view_type,
    visible_columns,
    column_order,
    filters,
    sort_by,
    sort_order,
    group_by,
    calendar_view_mode,
    calendar_date_mode,
    calendar_density,
    board_group_by,
    page_size,
    selected_projects,
    active_saved_view_id
  } = req.body;
  
  try {
    // Upsert preferences
    const result = await pool.query(`
      INSERT INTO user_view_preferences (
        user_id, workspace_id,
        last_view_type, visible_columns, column_order, filters,
        sort_by, sort_order, group_by,
        calendar_view_mode, calendar_date_mode, calendar_density,
        board_group_by, page_size, selected_projects, active_saved_view_id,
        last_active_at
      ) VALUES (
        $1, $2,
        COALESCE($3, 'table'), COALESCE($4, '["name", "project_name", "stage", "status", "priority", "assignee_name", "due_date", "target_date", "created_at"]'::jsonb), COALESCE($5, '[]'::jsonb), COALESCE($6, '{}'::jsonb),
        COALESCE($7, 'created_at'), COALESCE($8, 'desc'), $9,
        COALESCE($10, 'month'), COALESCE($11, 'due'), COALESCE($12, 'comfortable'),
        COALESCE($13, 'status'), COALESCE($14, 50), COALESCE($15, '[]'::jsonb), $16,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, workspace_id) DO UPDATE SET
        last_view_type = COALESCE($3, user_view_preferences.last_view_type),
        visible_columns = COALESCE($4, user_view_preferences.visible_columns),
        column_order = COALESCE($5, user_view_preferences.column_order),
        filters = COALESCE($6, user_view_preferences.filters),
        sort_by = COALESCE($7, user_view_preferences.sort_by),
        sort_order = COALESCE($8, user_view_preferences.sort_order),
        group_by = COALESCE($9, user_view_preferences.group_by),
        calendar_view_mode = COALESCE($10, user_view_preferences.calendar_view_mode),
        calendar_date_mode = COALESCE($11, user_view_preferences.calendar_date_mode),
        calendar_density = COALESCE($12, user_view_preferences.calendar_density),
        board_group_by = COALESCE($13, user_view_preferences.board_group_by),
        page_size = COALESCE($14, user_view_preferences.page_size),
        selected_projects = COALESCE($15, user_view_preferences.selected_projects),
        active_saved_view_id = $16,
        last_active_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      req.userId, workspaceId,
      last_view_type, 
      visible_columns ? JSON.stringify(visible_columns) : null,
      column_order ? JSON.stringify(column_order) : null,
      filters ? JSON.stringify(filters) : null,
      sort_by, sort_order, group_by,
      calendar_view_mode, calendar_date_mode, calendar_density,
      board_group_by, page_size,
      selected_projects ? JSON.stringify(selected_projects) : null,
      active_saved_view_id
    ]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user preferences:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * PATCH /api/preferences/workspace/:workspaceId
 * Partially update user's view preferences (for quick updates)
 */
router.patch('/workspace/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  const updates = req.body;
  
  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }
  
  const allowedFields = [
    'last_view_type', 'visible_columns', 'column_order', 'filters',
    'sort_by', 'sort_order', 'group_by',
    'calendar_view_mode', 'calendar_date_mode', 'calendar_density',
    'board_group_by', 'page_size', 'selected_projects', 'active_saved_view_id'
  ];
  
  try {
    // First ensure record exists
    await pool.query(`
      INSERT INTO user_view_preferences (user_id, workspace_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, workspace_id) DO NOTHING
    `, [req.userId, workspaceId]);
    
    // Build dynamic update
    const setClauses = [];
    const values = [req.userId, workspaceId];
    let paramIndex = 3;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbValue = typeof value === 'object' && value !== null 
          ? JSON.stringify(value) 
          : value;
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(dbValue);
        paramIndex++;
      }
    }
    
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    setClauses.push('last_active_at = CURRENT_TIMESTAMP');
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    
    const result = await pool.query(`
      UPDATE user_view_preferences
      SET ${setClauses.join(', ')}
      WHERE user_id = $1 AND workspace_id = $2
      RETURNING *
    `, values);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error patching user preferences:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * DELETE /api/preferences/workspace/:workspaceId
 * Reset user's view preferences to defaults
 */
router.delete('/workspace/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  
  try {
    await pool.query(`
      DELETE FROM user_view_preferences
      WHERE user_id = $1 AND workspace_id = $2
    `, [req.userId, workspaceId]);
    
    res.json({ success: true, message: 'Preferences reset to defaults' });
  } catch (err) {
    console.error('Error resetting preferences:', err);
    res.status(500).json({ error: 'Failed to reset preferences' });
  }
});

module.exports = router;
