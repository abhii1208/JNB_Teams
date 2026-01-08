/**
 * Saved Views Routes
 * CRUD for task view configurations
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all saved views for a workspace
router.get('/workspace/:workspaceId', async (req, res) => {
    const { workspaceId } = req.params;

    try {
        const result = await pool.query(`
            SELECT sv.*, 
                   u.first_name || ' ' || u.last_name as created_by_name
            FROM saved_views sv
            LEFT JOIN users u ON sv.user_id = u.id
            WHERE sv.workspace_id = $1
              AND (sv.user_id = $2 OR sv.visibility IN ('team', 'org'))
            ORDER BY sv.is_default DESC, sv.name ASC
        `, [workspaceId, req.userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Get saved views error:', err);
        res.status(500).json({ error: 'Failed to fetch saved views' });
    }
});

// Create a saved view
router.post('/workspace/:workspaceId', async (req, res) => {
    const { workspaceId } = req.params;
    const { name, description, view_type, config, visibility = 'personal' } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'name is required' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO saved_views (workspace_id, user_id, name, description, view_type, config, visibility)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [workspaceId, req.userId, name, description, view_type || 'table', config || {}, visibility]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create saved view error:', err);
        res.status(500).json({ error: 'Failed to create saved view' });
    }
});

// Update a saved view
router.put('/:viewId', async (req, res) => {
    const { viewId } = req.params;
    const { name, description, view_type, config, visibility, is_default } = req.body;

    try {
        // Check ownership or admin access
        const existing = await pool.query(
            'SELECT * FROM saved_views WHERE id = $1',
            [viewId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'View not found' });
        }

        const view = existing.rows[0];
        if (view.user_id !== req.userId && view.visibility !== 'org') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // If setting as default, unset other defaults for this user
        if (is_default) {
            await pool.query(`
                UPDATE saved_views 
                SET is_default = false 
                WHERE workspace_id = $1 AND user_id = $2
            `, [view.workspace_id, req.userId]);
        }

        const result = await pool.query(`
            UPDATE saved_views
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                view_type = COALESCE($3, view_type),
                config = COALESCE($4, config),
                visibility = COALESCE($5, visibility),
                is_default = COALESCE($6, is_default),
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [name, description, view_type, config, visibility, is_default, viewId]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update saved view error:', err);
        res.status(500).json({ error: 'Failed to update saved view' });
    }
});

// Delete a saved view
router.delete('/:viewId', async (req, res) => {
    const { viewId } = req.params;

    try {
        const existing = await pool.query(
            'SELECT * FROM saved_views WHERE id = $1',
            [viewId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'View not found' });
        }

        const view = existing.rows[0];
        if (view.user_id !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await pool.query('DELETE FROM saved_views WHERE id = $1', [viewId]);
        res.json({ message: 'View deleted successfully' });
    } catch (err) {
        console.error('Delete saved view error:', err);
        res.status(500).json({ error: 'Failed to delete saved view' });
    }
});

// Get user preferences
router.get('/workspace/:workspaceId/preferences', async (req, res) => {
    const { workspaceId } = req.params;

    try {
        let result = await pool.query(`
            SELECT * FROM task_user_preferences
            WHERE user_id = $1 AND workspace_id = $2
        `, [req.userId, workspaceId]);

        if (result.rows.length === 0) {
            // Create default preferences
            result = await pool.query(`
                INSERT INTO task_user_preferences (user_id, workspace_id)
                VALUES ($1, $2)
                RETURNING *
            `, [req.userId, workspaceId]);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get preferences error:', err);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

// Update user preferences
router.put('/workspace/:workspaceId/preferences', async (req, res) => {
    const { workspaceId } = req.params;
    const { default_view_id, default_view_type, selected_projects, column_order, column_visibility } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO task_user_preferences (user_id, workspace_id, default_view_id, default_view_type, selected_projects, column_order, column_visibility)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, workspace_id) 
            DO UPDATE SET
                default_view_id = COALESCE($3, task_user_preferences.default_view_id),
                default_view_type = COALESCE($4, task_user_preferences.default_view_type),
                selected_projects = COALESCE($5, task_user_preferences.selected_projects),
                column_order = COALESCE($6, task_user_preferences.column_order),
                column_visibility = COALESCE($7, task_user_preferences.column_visibility),
                updated_at = NOW()
            RETURNING *
        `, [req.userId, workspaceId, default_view_id, default_view_type, selected_projects, column_order, column_visibility]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update preferences error:', err);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

module.exports = router;
