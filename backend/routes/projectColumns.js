const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// =====================================================
// PROJECT COLUMN OPTIONS (Category/Section dropdowns)
// =====================================================

/**
 * GET /api/projects/:projectId/column-options
 * Get all column options for a project
 */
router.get('/:projectId/column-options', async (req, res) => {
  const { projectId } = req.params;
  const { column_name } = req.query; // Optional filter by column name
  
  try {
    // Verify user has access to project
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a project member' });
    }
    
    let query = `
      SELECT id, column_name, option_value, display_order, color, created_at
      FROM project_column_options
      WHERE project_id = $1
    `;
    const params = [projectId];
    
    if (column_name) {
      query += ' AND column_name = $2';
      params.push(column_name);
    }
    
    query += ' ORDER BY column_name, display_order, option_value';
    
    const result = await pool.query(query, params);
    
    // Group by column name for convenience
    const grouped = {
      category: [],
      section: []
    };
    
    result.rows.forEach(row => {
      if (grouped[row.column_name]) {
        grouped[row.column_name].push(row);
      }
    });
    
    res.json({
      options: result.rows,
      grouped
    });
  } catch (err) {
    console.error('Error fetching column options:', err);
    res.status(500).json({ error: 'Failed to fetch column options' });
  }
});

/**
 * POST /api/projects/:projectId/column-options
 * Create a new column option (Owner only)
 */
router.post('/:projectId/column-options', async (req, res) => {
  const { projectId } = req.params;
  const { column_name, option_value, display_order = 0, color = '#64748b' } = req.body;
  
  if (!column_name || !option_value) {
    return res.status(400).json({ error: 'column_name and option_value are required' });
  }
  
  if (!['category', 'section'].includes(column_name)) {
    return res.status(400).json({ error: 'column_name must be "category" or "section"' });
  }
  
  try {
    // Verify user is Owner
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'Owner') {
      return res.status(403).json({ error: 'Only project owner can manage column options' });
    }
    
    const result = await pool.query(`
      INSERT INTO project_column_options 
        (project_id, column_name, option_value, display_order, color, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [projectId, column_name, option_value.trim(), display_order, color, req.userId]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'This option already exists' });
    }
    console.error('Error creating column option:', err);
    res.status(500).json({ error: 'Failed to create column option' });
  }
});

/**
 * PUT /api/projects/:projectId/column-options/:optionId
 * Update a column option (Owner only)
 */
router.put('/:projectId/column-options/:optionId', async (req, res) => {
  const { projectId, optionId } = req.params;
  const { option_value, display_order, color } = req.body;
  
  try {
    // Verify user is Owner
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'Owner') {
      return res.status(403).json({ error: 'Only project owner can manage column options' });
    }
    
    const updates = [];
    const values = [optionId, projectId];
    let paramIndex = 3;
    
    if (option_value !== undefined) {
      updates.push(`option_value = $${paramIndex}`);
      values.push(option_value.trim());
      paramIndex++;
    }
    
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex}`);
      values.push(display_order);
      paramIndex++;
    }
    
    if (color !== undefined) {
      updates.push(`color = $${paramIndex}`);
      values.push(color);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    const result = await pool.query(`
      UPDATE project_column_options
      SET ${updates.join(', ')}
      WHERE id = $1 AND project_id = $2
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Option not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This option already exists' });
    }
    console.error('Error updating column option:', err);
    res.status(500).json({ error: 'Failed to update column option' });
  }
});

/**
 * DELETE /api/projects/:projectId/column-options/:optionId
 * Delete a column option (Owner only)
 */
router.delete('/:projectId/column-options/:optionId', async (req, res) => {
  const { projectId, optionId } = req.params;
  
  try {
    // Verify user is Owner
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'Owner') {
      return res.status(403).json({ error: 'Only project owner can manage column options' });
    }
    
    // Get the option details before deleting (to clear tasks using it)
    const optionResult = await pool.query(
      'SELECT column_name, option_value FROM project_column_options WHERE id = $1 AND project_id = $2',
      [optionId, projectId]
    );
    
    if (optionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Option not found' });
    }
    
    const { column_name, option_value } = optionResult.rows[0];
    
    // Clear this value from tasks (set to NULL)
    await pool.query(`
      UPDATE tasks 
      SET ${column_name} = NULL 
      WHERE project_id = $1 AND ${column_name} = $2
    `, [projectId, option_value]);
    
    // Delete the option
    await pool.query(
      'DELETE FROM project_column_options WHERE id = $1 AND project_id = $2',
      [optionId, projectId]
    );
    
    res.json({ success: true, message: 'Option deleted' });
  } catch (err) {
    console.error('Error deleting column option:', err);
    res.status(500).json({ error: 'Failed to delete column option' });
  }
});

/**
 * POST /api/projects/:projectId/column-options/bulk
 * Bulk create column options (Owner only)
 */
router.post('/:projectId/column-options/bulk', async (req, res) => {
  const { projectId } = req.params;
  const { column_name, options } = req.body;
  
  if (!column_name || !Array.isArray(options)) {
    return res.status(400).json({ error: 'column_name and options array are required' });
  }
  
  try {
    // Verify user is Owner
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'Owner') {
      return res.status(403).json({ error: 'Only project owner can manage column options' });
    }
    
    const results = [];
    
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const value = typeof opt === 'string' ? opt : opt.value;
      const color = typeof opt === 'object' ? opt.color || '#64748b' : '#64748b';
      
      try {
        const result = await pool.query(`
          INSERT INTO project_column_options 
            (project_id, column_name, option_value, display_order, color, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (project_id, column_name, option_value) DO NOTHING
          RETURNING *
        `, [projectId, column_name, value.trim(), i, color, req.userId]);
        
        if (result.rows[0]) {
          results.push(result.rows[0]);
        }
      } catch (innerErr) {
        console.error('Error inserting option:', innerErr);
      }
    }
    
    res.status(201).json({ created: results.length, options: results });
  } catch (err) {
    console.error('Error bulk creating column options:', err);
    res.status(500).json({ error: 'Failed to bulk create column options' });
  }
});

/**
 * POST /api/projects/:projectId/column-options/copy
 * Copy column options from another project (Owner of both projects only)
 */
router.post('/:projectId/column-options/copy', async (req, res) => {
  const { projectId: targetProjectId } = req.params;
  const { source_project_id, column_name } = req.body;
  
  if (!source_project_id || !column_name) {
    return res.status(400).json({ error: 'source_project_id and column_name are required' });
  }
  
  try {
    // Verify user is Owner of BOTH projects
    const ownerCheck = await pool.query(`
      SELECT project_id FROM project_members 
      WHERE user_id = $1 AND role = 'Owner' AND project_id = ANY($2::int[])
    `, [req.userId, [source_project_id, targetProjectId]]);
    
    const ownedProjects = ownerCheck.rows.map(r => r.project_id);
    
    if (!ownedProjects.includes(parseInt(source_project_id)) || 
        !ownedProjects.includes(parseInt(targetProjectId))) {
      return res.status(403).json({ 
        error: 'You must be the owner of both source and target projects to copy options' 
      });
    }
    
    // Get options from source project
    const sourceOptions = await pool.query(`
      SELECT option_value, display_order, color
      FROM project_column_options
      WHERE project_id = $1 AND column_name = $2
      ORDER BY display_order
    `, [source_project_id, column_name]);
    
    if (sourceOptions.rows.length === 0) {
      return res.status(400).json({ error: 'No options to copy from source project' });
    }
    
    // Insert into target project
    let copied = 0;
    for (const opt of sourceOptions.rows) {
      try {
        await pool.query(`
          INSERT INTO project_column_options 
            (project_id, column_name, option_value, display_order, color, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (project_id, column_name, option_value) DO NOTHING
        `, [targetProjectId, column_name, opt.option_value, opt.display_order, opt.color, req.userId]);
        copied++;
      } catch (innerErr) {
        console.error('Error copying option:', innerErr);
      }
    }
    
    // Log the copy action
    await pool.query(`
      INSERT INTO column_copy_history 
        (source_project_id, target_project_id, column_name, copied_by, options_copied)
      VALUES ($1, $2, $3, $4, $5)
    `, [source_project_id, targetProjectId, column_name, req.userId, copied]);
    
    res.json({ 
      success: true, 
      copied,
      total_available: sourceOptions.rows.length 
    });
  } catch (err) {
    console.error('Error copying column options:', err);
    res.status(500).json({ error: 'Failed to copy column options' });
  }
});

/**
 * GET /api/projects/:projectId/column-options/copyable-projects
 * Get list of projects user can copy options FROM (projects where user is Owner)
 */
router.get('/:projectId/column-options/copyable-projects', async (req, res) => {
  const { projectId } = req.params;
  
  try {
    // Verify user is Owner of current project
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'Owner') {
      return res.status(403).json({ error: 'Only project owner can copy options' });
    }
    
    // Get other projects where user is Owner (excluding current project)
    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.color,
        (SELECT COUNT(*) FROM project_column_options WHERE project_id = p.id AND column_name = 'category') as category_count,
        (SELECT COUNT(*) FROM project_column_options WHERE project_id = p.id AND column_name = 'section') as section_count
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = $1 
        AND pm.role = 'Owner'
        AND p.id != $2
        AND p.archived_at IS NULL
      ORDER BY p.name
    `, [req.userId, projectId]);
    
    // Filter to only projects that have at least one option
    const projectsWithOptions = result.rows.filter(
      p => parseInt(p.category_count) > 0 || parseInt(p.section_count) > 0
    );
    
    res.json(projectsWithOptions);
  } catch (err) {
    console.error('Error fetching copyable projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// =====================================================
// PROJECT COLUMN SETTINGS
// =====================================================

/**
 * GET /api/projects/:projectId/column-settings
 * Get project's custom column enable/disable settings
 */
router.get('/:projectId/column-settings', async (req, res) => {
  const { projectId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        enable_category,
        enable_section,
        enable_estimated_hours,
        enable_actual_hours,
        enable_tags,
        enable_external_id,
        enable_completion_percentage,
        custom_column_settings
      FROM projects
      WHERE id = $1
    `, [projectId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching column settings:', err);
    res.status(500).json({ error: 'Failed to fetch column settings' });
  }
});

/**
 * PUT /api/projects/:projectId/column-settings
 * Update project's custom column enable/disable settings (Owner only)
 */
router.put('/:projectId/column-settings', async (req, res) => {
  const { projectId } = req.params;
  const {
    enable_category,
    enable_section,
    enable_estimated_hours,
    enable_actual_hours,
    enable_tags,
    enable_external_id,
    enable_completion_percentage,
    custom_column_settings
  } = req.body;
  
  try {
    // Verify user is Owner
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'Owner') {
      return res.status(403).json({ error: 'Only project owner can update column settings' });
    }
    
    const updates = [];
    const values = [projectId];
    let paramIndex = 2;
    
    if (enable_category !== undefined) {
      updates.push(`enable_category = $${paramIndex}`);
      values.push(enable_category);
      paramIndex++;
    }
    
    if (enable_section !== undefined) {
      updates.push(`enable_section = $${paramIndex}`);
      values.push(enable_section);
      paramIndex++;
    }
    
    if (enable_estimated_hours !== undefined) {
      updates.push(`enable_estimated_hours = $${paramIndex}`);
      values.push(enable_estimated_hours);
      paramIndex++;
    }
    
    if (enable_actual_hours !== undefined) {
      updates.push(`enable_actual_hours = $${paramIndex}`);
      values.push(enable_actual_hours);
      paramIndex++;
    }
    
    if (enable_tags !== undefined) {
      updates.push(`enable_tags = $${paramIndex}`);
      values.push(enable_tags);
      paramIndex++;
    }
    
    if (enable_external_id !== undefined) {
      updates.push(`enable_external_id = $${paramIndex}`);
      values.push(enable_external_id);
      paramIndex++;
    }
    
    if (enable_completion_percentage !== undefined) {
      updates.push(`enable_completion_percentage = $${paramIndex}`);
      values.push(enable_completion_percentage);
      paramIndex++;
    }
    
    if (custom_column_settings !== undefined) {
      updates.push(`custom_column_settings = $${paramIndex}`);
      values.push(JSON.stringify(custom_column_settings));
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    const result = await pool.query(`
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING 
        enable_category,
        enable_section,
        enable_estimated_hours,
        enable_actual_hours,
        enable_tags,
        enable_external_id,
        enable_completion_percentage,
        custom_column_settings
    `, values);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating column settings:', err);
    res.status(500).json({ error: 'Failed to update column settings' });
  }
});

module.exports = router;
