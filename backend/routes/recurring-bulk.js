/**
 * Bulk Operations for Recurring Series
 * Allows managing multiple series at once
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

/**
 * POST /recurring/bulk/pause - Pause multiple series
 */
router.post('/pause', async (req, res) => {
    const { series_ids } = req.body;
    
    if (!Array.isArray(series_ids) || series_ids.length === 0) {
        return res.status(400).json({ error: 'series_ids array is required' });
    }
    
    // Validate all IDs are integers
    const validatedIds = series_ids.map(id => {
        const parsed = parseInt(id, 10);
        if (isNaN(parsed)) {
            throw new Error(`Invalid series ID: ${id}`);
        }
        return parsed;
    });
    
    try {
        const result = await pool.query(`
            UPDATE recurring_series 
            SET paused_at = NOW()
            WHERE id = ANY($1::int[])
            AND paused_at IS NULL 
            AND deleted_at IS NULL
            RETURNING id, title
        `, [validatedIds]);
        
        res.json({
            message: `Paused ${result.rows.length} series`,
            paused: result.rows
        });
    } catch (err) {
        console.error('Bulk pause error:', err);
        res.status(500).json({ 
            error: 'Failed to pause series',
            details: err.message 
        });
    }
});

/**
 * POST /recurring/bulk/resume - Resume multiple series
 */
router.post('/resume', async (req, res) => {
    const { series_ids } = req.body;
    
    if (!Array.isArray(series_ids) || series_ids.length === 0) {
        return res.status(400).json({ error: 'series_ids array is required' });
    }
    
    const validatedIds = series_ids.map(id => {
        const parsed = parseInt(id, 10);
        if (isNaN(parsed)) {
            throw new Error(`Invalid series ID: ${id}`);
        }
        return parsed;
    });
    
    try {
        const result = await pool.query(`
            UPDATE recurring_series 
            SET paused_at = NULL
            WHERE id = ANY($1::int[])
            AND paused_at IS NOT NULL 
            AND deleted_at IS NULL
            RETURNING id, title
        `, [validatedIds]);
        
        res.json({
            message: `Resumed ${result.rows.length} series`,
            resumed: result.rows
        });
    } catch (err) {
        console.error('Bulk resume error:', err);
        res.status(500).json({ 
            error: 'Failed to resume series',
            details: err.message 
        });
    }
});

/**
 * POST /recurring/bulk/delete - Delete multiple series
 */
router.post('/delete', async (req, res) => {
    const { series_ids } = req.body;
    
    if (!Array.isArray(series_ids) || series_ids.length === 0) {
        return res.status(400).json({ error: 'series_ids array is required' });
    }
    
    const validatedIds = series_ids.map(id => {
        const parsed = parseInt(id, 10);
        if (isNaN(parsed)) {
            throw new Error(`Invalid series ID: ${id}`);
        }
        return parsed;
    });
    
    try {
        const result = await pool.query(`
            UPDATE recurring_series 
            SET deleted_at = NOW()
            WHERE id = ANY($1::int[])
            AND deleted_at IS NULL
            RETURNING id, title
        `, [validatedIds]);
        
        // Cancel future reminders for all deleted series
        if (result.rows.length > 0) {
            await pool.query(`
                UPDATE task_reminders 
                SET cancelled_at = NOW()
                WHERE task_id IN (
                    SELECT id FROM tasks 
                    WHERE series_id = ANY($1::int[])
                    AND due_date >= CURRENT_DATE
                )
                AND sent_at IS NULL
            `, [validatedIds]);
        }
        
        res.json({
            message: `Deleted ${result.rows.length} series`,
            deleted: result.rows
        });
    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ 
            error: 'Failed to delete series',
            details: err.message 
        });
    }
});

/**
 * PUT /recurring/bulk/update - Update multiple series
 */
router.put('/update', async (req, res) => {
    const { series_ids, updates } = req.body;
    
    if (!Array.isArray(series_ids) || series_ids.length === 0) {
        return res.status(400).json({ error: 'series_ids array is required' });
    }
    
    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'updates object is required' });
    }
    
    const validatedIds = series_ids.map(id => {
        const parsed = parseInt(id, 10);
        if (isNaN(parsed)) {
            throw new Error(`Invalid series ID: ${id}`);
        }
        return parsed;
    });
    
    // Build update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    const allowedFields = [
        'title', 'description', 'timezone', 'auto_close_after_days',
        'static_assignee_id', 'requires_approval', 'approver_id'
    ];
    
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            let value = updates[field];
            
            // Handle nullable integers
            if (['auto_close_after_days', 'static_assignee_id', 'approver_id'].includes(field)) {
                if (value === '' || value === null) {
                    value = null;
                } else {
                    const parsed = parseInt(value, 10);
                    if (isNaN(parsed)) {
                        return res.status(400).json({ 
                            error: `Invalid value for ${field}` 
                        });
                    }
                    value = parsed;
                }
            }
            
            updateFields.push(`${field} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }
    }
    
    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(validatedIds);
    
    try {
        const result = await pool.query(`
            UPDATE recurring_series 
            SET ${updateFields.join(', ')}, updated_at = NOW()
            WHERE id = ANY($${paramIndex}::int[])
            AND deleted_at IS NULL
            RETURNING id, title
        `, values);
        
        res.json({
            message: `Updated ${result.rows.length} series`,
            updated: result.rows
        });
    } catch (err) {
        console.error('Bulk update error:', err);
        res.status(500).json({ 
            error: 'Failed to update series',
            details: err.message 
        });
    }
});

/**
 * POST /recurring/bulk/generate - Generate instances for multiple series
 */
router.post('/generate', async (req, res) => {
    const { series_ids, maxInstances = 10 } = req.body;
    
    if (!Array.isArray(series_ids) || series_ids.length === 0) {
        return res.status(400).json({ error: 'series_ids array is required' });
    }
    
    const validatedIds = series_ids.map(id => {
        const parsed = parseInt(id, 10);
        if (isNaN(parsed)) {
            throw new Error(`Invalid series ID: ${id}`);
        }
        return parsed;
    });
    
    try {
        const { generateInstancesForSeries } = require('../services/instanceGenerator');
        
        const results = [];
        for (const seriesId of validatedIds) {
            try {
                const result = await generateInstancesForSeries(seriesId, { maxInstances });
                results.push({
                    seriesId,
                    success: true,
                    ...result
                });
            } catch (err) {
                results.push({
                    seriesId,
                    success: false,
                    error: err.message
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        res.json({
            message: `Generated instances for ${successCount}/${results.length} series`,
            successCount,
            failureCount,
            results
        });
    } catch (err) {
        console.error('Bulk generate error:', err);
        res.status(500).json({ 
            error: 'Failed to generate instances',
            details: err.message 
        });
    }
});

/**
 * GET /recurring/bulk/status - Get status of multiple series
 */
router.get('/status', async (req, res) => {
    const { series_ids } = req.query;
    
    if (!series_ids) {
        return res.status(400).json({ error: 'series_ids query parameter is required' });
    }
    
    // Parse comma-separated IDs
    const idsArray = series_ids.split(',').map(id => {
        const parsed = parseInt(id.trim(), 10);
        if (isNaN(parsed)) {
            throw new Error(`Invalid series ID: ${id}`);
        }
        return parsed;
    });
    
    try {
        const result = await pool.query(`
            SELECT 
                rs.id,
                rs.title,
                rs.paused_at IS NOT NULL as is_paused,
                rs.deleted_at IS NOT NULL as is_deleted,
                rs.last_generated_at,
                (SELECT COUNT(*) FROM tasks 
                 WHERE series_id::text = rs.id::text 
                 AND deleted_at IS NULL) as total_instances,
                (SELECT COUNT(*) FROM tasks 
                 WHERE series_id::text = rs.id::text 
                 AND status = 'Completed' 
                 AND deleted_at IS NULL) as completed_instances,
                (SELECT COUNT(*) FROM tasks 
                 WHERE series_id::text = rs.id::text 
                 AND due_date >= CURRENT_DATE 
                 AND deleted_at IS NULL) as future_instances
            FROM recurring_series rs
            WHERE rs.id = ANY($1::int[])
        `, [idsArray]);
        
        res.json({
            count: result.rows.length,
            series: result.rows
        });
    } catch (err) {
        console.error('Bulk status error:', err);
        res.status(500).json({ 
            error: 'Failed to get series status',
            details: err.message 
        });
    }
});

module.exports = router;
