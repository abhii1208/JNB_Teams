/**
 * Recurring Series Routes
 * CRUD operations for recurring task series
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateRecurrenceRule, getRuleSummary, RECURRENCE_PRESETS } = require('../validators/recurrenceRule');
const { generateInstancesForSeries, splitSeries } = require('../services/instanceGenerator');
const { previewOccurrences } = require('../services/recurrenceEngine');

const normalizeOptionalInt = (value) => {
    if (value === '' || value === undefined || value === null) return null;
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
};

const normalizeOptionalDate = (value) => {
    if (value === '' || value === undefined) return null;
    return value;
};

const normalizeJsonInput = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (err) {
            return value;
        }
    }
    return value;
};

// ============================================
// GET /recurring/presets - Get recurrence presets
// ============================================
router.get('/presets', (req, res) => {
    const presets = Object.entries(RECURRENCE_PRESETS).map(([key, value]) => ({
        id: key,
        ...value,
        summary: getRuleSummary(value.rule)
    }));
    res.json(presets);
});

// ============================================
// POST /recurring/validate - Validate a recurrence rule
// ============================================
router.post('/validate', (req, res) => {
    const { rule } = req.body;
    
    if (!rule) {
        return res.status(400).json({ error: 'rule is required' });
    }

    const validation = validateRecurrenceRule(rule);
    
    if (!validation.valid) {
        return res.status(400).json({
            valid: false,
            errors: validation.errors
        });
    }

    res.json({
        valid: true,
        normalized: validation.normalized,
        summary: getRuleSummary(validation.normalized)
    });
});

// ============================================
// POST /recurring/preview - Preview occurrences
// ============================================
router.post('/preview', (req, res) => {
    const { rule, startDate, timezone = 'UTC', count = 5 } = req.body;
    
    if (!rule || !startDate) {
        return res.status(400).json({ error: 'rule and startDate are required' });
    }

    const validation = validateRecurrenceRule(rule);
    if (!validation.valid) {
        return res.status(400).json({ 
            error: 'Invalid rule', 
            details: validation.errors 
        });
    }

    try {
        const preview = previewOccurrences(validation.normalized, startDate, timezone, count);
        res.json({
            rule: validation.normalized,
            summary: getRuleSummary(validation.normalized),
            occurrences: preview
        });
    } catch (err) {
        console.error('Preview error:', err);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

// ============================================
// GET /recurring/workspace/:workspaceId - List series in workspace
// ============================================
router.get('/workspace/:workspaceId', async (req, res) => {
    const { workspaceId } = req.params;
    const { includeDeleted = false, includePaused = true } = req.query;

    try {
        // Cast workspaceId to integer to prevent type mismatch
        const workspaceIdInt = parseInt(workspaceId, 10);
        if (isNaN(workspaceIdInt)) {
            return res.status(400).json({ error: 'Invalid workspace ID' });
        }

        let query = `
            SELECT 
                rs.*,
                u.first_name || ' ' || u.last_name as created_by_name,
                a.first_name || ' ' || a.last_name as assignee_name,
                p.name as project_name,
                (SELECT COUNT(*) FROM tasks WHERE series_id::text = rs.id::text AND deleted_at IS NULL) as total_instances,
                (SELECT COUNT(*) FROM tasks WHERE series_id::text = rs.id::text AND status = 'Completed' AND deleted_at IS NULL) as completed_instances
            FROM recurring_series rs
            LEFT JOIN users u ON rs.created_by::text = u.id::text
            LEFT JOIN users a ON rs.static_assignee_id::text = a.id::text
            LEFT JOIN projects p ON rs.project_id = p.id
            WHERE rs.workspace_id = $1
        `;

        const params = [workspaceIdInt];

        if (!includeDeleted) {
            query += ' AND rs.deleted_at IS NULL';
        }

        if (!includePaused) {
            query += ' AND rs.paused_at IS NULL';
        }

        query += ' ORDER BY rs.created_at DESC';

        const result = await pool.query(query, params);

        // Add human-readable summary to each series
        const series = result.rows.map(s => ({
            ...s,
            rule_summary: getRuleSummary(s.recurrence_rule),
            is_active: !s.paused_at && !s.deleted_at && 
                (!s.end_date || s.end_date >= new Date().toISOString().split('T')[0])
        }));

        res.json(series);
    } catch (err) {
        console.error('List series error:', err);
        res.status(500).json({ error: 'Failed to fetch recurring series' });
    }
});

// ============================================
// GET /recurring/:id - Get single series
// ============================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Cast id to integer to prevent type mismatch
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }

        const result = await pool.query(`
            SELECT 
                rs.*,
                u.first_name || ' ' || u.last_name as created_by_name,
                a.first_name || ' ' || a.last_name as assignee_name,
                ap.first_name || ' ' || ap.last_name as approver_name,
                p.name as project_name,
                w.name as workspace_name
            FROM recurring_series rs
            LEFT JOIN users u ON rs.created_by::text = u.id::text
            LEFT JOIN users a ON rs.static_assignee_id::text = a.id::text
            LEFT JOIN users ap ON rs.approver_id::text = ap.id::text
            LEFT JOIN projects p ON rs.project_id = p.id
            LEFT JOIN workspaces w ON rs.workspace_id = w.id
            WHERE rs.id = $1
        `, [seriesId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Series not found' });
        }

        const series = result.rows[0];

        // Get rotation members if round_robin
        let rotationMembers = [];
        if (series.assignment_strategy === 'round_robin') {
            const rotationResult = await pool.query(`
                SELECT ar.*, u.first_name || ' ' || u.last_name as user_name
                FROM assignment_rotation ar
                JOIN users u ON ar.user_id::text = u.id::text
                WHERE ar.series_id = $1
                ORDER BY ar.order_index
            `, [seriesId]);
            rotationMembers = rotationResult.rows;
        }

        // Get recent instances
        const instancesResult = await pool.query(`
            SELECT t.*, u.first_name || ' ' || u.last_name as assignee_name
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id::text = u.id::text
            WHERE t.series_id::text = $1::text AND t.deleted_at IS NULL
            ORDER BY t.due_date DESC
            LIMIT 10
        `, [seriesId]);

        // Get exceptions
        const exceptionsResult = await pool.query(`
            SELECT * FROM recurrence_exceptions
            WHERE series_id = $1
            ORDER BY original_date DESC
            LIMIT 20
        `, [seriesId]);

        res.json({
            ...series,
            rotation_members: rotationMembers,
            recent_instances: instancesResult.rows,
            exceptions: exceptionsResult.rows
        });
    } catch (err) {
        console.error('Get series error:', err);
        console.error('Stack trace:', err.stack);
        console.error('Error details:', { message: err.message, code: err.code, detail: err.detail });
        res.status(500).json({ error: 'Failed to fetch series', details: err.message });
    }
});

// ============================================
// POST /recurring - Create new series
// ============================================
router.post('/', async (req, res) => {
    const {
        workspace_id,
        project_id,
        title,
        description,
        template = {},
        recurrence_rule,
        timezone = 'UTC',
        start_date,
        end_date,
        auto_close_after_days,
        assignment_strategy = 'static',
        static_assignee_id,
        rotation_members = [],
        requires_approval = false,
        approver_id,
        reminder_offsets = []
    } = req.body;

    // Validate required fields
    if (!workspace_id || !title || !recurrence_rule || !start_date) {
        return res.status(400).json({ 
            error: 'workspace_id, title, recurrence_rule, and start_date are required' 
        });
    }

    // Validate recurrence rule
    const ruleValidation = validateRecurrenceRule(recurrence_rule);
    if (!ruleValidation.valid) {
        return res.status(400).json({
            error: 'Invalid recurrence rule',
            details: ruleValidation.errors
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create series
        const result = await client.query(`
            INSERT INTO recurring_series (
                workspace_id, project_id, title, description, template,
                recurrence_rule, timezone, start_date, end_date,
                auto_close_after_days, assignment_strategy, static_assignee_id,
                requires_approval, approver_id, reminder_offsets, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            workspace_id,
            project_id || null,
            title,
            description || null,
            JSON.stringify(template),
            JSON.stringify(ruleValidation.normalized),
            timezone,
            start_date,
            end_date || null,
            auto_close_after_days || null,
            assignment_strategy,
            static_assignee_id || null,
            requires_approval,
            approver_id || null,
            JSON.stringify(reminder_offsets),
            req.userId
        ]);

        const series = result.rows[0];

        // Add rotation members if round_robin
        if (assignment_strategy === 'round_robin' && rotation_members.length > 0) {
            for (let i = 0; i < rotation_members.length; i++) {
                await client.query(`
                    INSERT INTO assignment_rotation (series_id, user_id, order_index)
                    VALUES ($1, $2, $3)
                `, [series.id, rotation_members[i], i + 1]);
            }
        }

        // Log activity
        await client.query(`
            INSERT INTO activity_logs (
                user_id, workspace_id, project_id, type, action, item_name, details
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            req.userId,
            workspace_id,
            project_id,
            'Recurring',
            'Created',
            title,
            `Created recurring series "${title}"`
        ]);

        await client.query('COMMIT');

        // Generate initial instances (async, don't wait)
        setImmediate(async () => {
            try {
                await generateInstancesForSeries(series.id);
            } catch (err) {
                console.error('Initial generation error:', err);
            }
        });

        res.status(201).json({
            ...series,
            rule_summary: getRuleSummary(series.recurrence_rule)
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create series error:', err);
        res.status(500).json({ error: 'Failed to create recurring series' });
    } finally {
        client.release();
    }
});

// ============================================
// PUT /recurring/:id - Update series
// ============================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        edit_scope = 'series', // 'series' | 'future'
        ...updates 
    } = req.body;

    try {
        // Cast id to integer to prevent type mismatch
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }
        // If editing future only, split the series
        if (edit_scope === 'future' && updates.from_date) {
            const result = await splitSeries(id, updates.from_date, updates, req.userId);
            return res.json({
                message: 'Series split successfully',
                ...result
            });
        }

        // Otherwise, update the series directly
        const updateFields = [];
        const values = [id];
        let paramIndex = 2;

        const allowedFields = [
            'title', 'description', 'template', 'recurrence_rule', 'timezone',
            'start_date', 'end_date', 'auto_close_after_days', 'assignment_strategy',
            'project_id', 'static_assignee_id', 'requires_approval', 'approver_id', 'reminder_offsets'
        ];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                let value = updates[field];

                if (field === 'start_date' && value === '') {
                    return res.status(400).json({ error: 'start_date cannot be empty' });
                }

                if (field === 'end_date') {
                    value = normalizeOptionalDate(value);
                }

                if (['auto_close_after_days', 'static_assignee_id', 'approver_id', 'project_id'].includes(field)) {
                    value = normalizeOptionalInt(value);
                    if (field === 'auto_close_after_days' && value !== null && value <= 0) {
                        value = null;
                    }
                }

                if (['template', 'recurrence_rule', 'reminder_offsets'].includes(field)) {
                    value = normalizeJsonInput(value);
                }
                
                // Validate recurrence rule if updating
                if (field === 'recurrence_rule') {
                    const validation = validateRecurrenceRule(value);
                    if (!validation.valid) {
                        return res.status(400).json({
                            error: 'Invalid recurrence rule',
                            details: validation.errors
                        });
                    }
                    value = validation.normalized;
                }

                // Stringify JSON fields
                if (['template', 'recurrence_rule', 'reminder_offsets'].includes(field)) {
                    value = JSON.stringify(value);
                }

                updateFields.push(`${field} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Update the first parameter to use seriesId
        values[0] = seriesId;

        const result = await pool.query(`
            UPDATE recurring_series 
            SET ${updateFields.join(', ')}
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Series not found' });
        }

        // Regenerate instances if rule changed
        if (updates.recurrence_rule) {
            setImmediate(async () => {
                try {
                    await generateInstancesForSeries(seriesId, { forceRegenerate: true });
                } catch (err) {
                    console.error('Regeneration error:', err);
                }
            });
        }

        res.json({
            ...result.rows[0],
            rule_summary: getRuleSummary(result.rows[0].recurrence_rule)
        });

    } catch (err) {
        console.error('Update series error:', err);
        res.status(500).json({ error: 'Failed to update series' });
    }
});

// ============================================
// POST /recurring/:id/pause - Pause series
// ============================================
router.post('/:id/pause', async (req, res) => {
    const { id } = req.params;

    try {
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }
        const result = await pool.query(`
            UPDATE recurring_series 
            SET paused_at = NOW()
            WHERE id = $1 AND paused_at IS NULL AND deleted_at IS NULL
            RETURNING *
        `, [seriesId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Series not found or already paused' });
        }

        res.json({
            message: 'Series paused',
            series: result.rows[0]
        });
    } catch (err) {
        console.error('Pause series error:', err);
        res.status(500).json({ error: 'Failed to pause series' });
    }
});

// ============================================
// POST /recurring/:id/resume - Resume series
// ============================================
router.post('/:id/resume', async (req, res) => {
    const { id } = req.params;
    const { backfill = false } = req.body;

    try {
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }
        const result = await pool.query(`
            UPDATE recurring_series 
            SET paused_at = NULL
            WHERE id = $1 AND paused_at IS NOT NULL AND deleted_at IS NULL
            RETURNING *
        `, [seriesId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Series not found or not paused' });
        }

        const series = result.rows[0];

        // Generate instances after resume
        setImmediate(async () => {
            try {
                await generateInstancesForSeries(seriesId);
            } catch (err) {
                console.error('Post-resume generation error:', err);
            }
        });

        res.json({
            message: 'Series resumed',
            series
        });
    } catch (err) {
        console.error('Resume series error:', err);
        res.status(500).json({ error: 'Failed to resume series' });
    }
});

// ============================================
// DELETE /recurring/:id - Soft delete series
// ============================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }
        // Soft delete the series (instances remain)
        const result = await pool.query(`
            UPDATE recurring_series 
            SET deleted_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, title
        `, [seriesId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Series not found' });
        }

        // Cancel future reminders
        await pool.query(`
            UPDATE task_reminders 
            SET cancelled_at = NOW()
            WHERE task_id IN (
                SELECT id FROM tasks 
                WHERE series_id::text = $1::text 
                AND due_date >= CURRENT_DATE
            )
            AND sent_at IS NULL
        `, [seriesId]);

        res.json({
            message: 'Series deleted. Existing task instances preserved.',
            deleted: result.rows[0]
        });
    } catch (err) {
        console.error('Delete series error:', err);
        res.status(500).json({ error: 'Failed to delete series' });
    }
});

// ============================================
// POST /recurring/:id/exception - Add exception
// ============================================
router.post('/:id/exception', async (req, res) => {
    const { id } = req.params;
    const { original_date, exception_type, new_date, reason } = req.body;

    if (!original_date || !exception_type) {
        return res.status(400).json({ error: 'original_date and exception_type are required' });
    }

    if (exception_type === 'move' && !new_date) {
        return res.status(400).json({ error: 'new_date is required for move exceptions' });
    }

    try {
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }
        const result = await pool.query(`
            INSERT INTO recurrence_exceptions (series_id, original_date, new_date, exception_type, reason, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (series_id, original_date) DO UPDATE
            SET new_date = $3, exception_type = $4, reason = $5
            RETURNING *
        `, [seriesId, original_date, new_date || null, exception_type, reason || null, req.userId]);

        res.json({
            message: 'Exception added',
            exception: result.rows[0]
        });
    } catch (err) {
        console.error('Add exception error:', err);
        res.status(500).json({ error: 'Failed to add exception' });
    }
});

// ============================================
// DELETE /recurring/:id/exception/:date - Remove exception
// ============================================
router.delete('/:id/exception/:date', async (req, res) => {
    const { id, date } = req.params;

    try {
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }
        const result = await pool.query(`
            DELETE FROM recurrence_exceptions
            WHERE series_id = $1 AND original_date = $2
            RETURNING *
        `, [seriesId, date]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Exception not found' });
        }

        res.json({
            message: 'Exception removed',
            removed: result.rows[0]
        });
    } catch (err) {
        console.error('Remove exception error:', err);
        res.status(500).json({ error: 'Failed to remove exception' });
    }
});

// ============================================
// POST /recurring/:id/generate - Manual generation trigger
// ============================================
router.post('/:id/generate', async (req, res) => {
    const { id } = req.params;
    const { maxInstances = 10 } = req.body || {};

    try {
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }
        const parsedMax = Number(maxInstances);
        const result = await generateInstancesForSeries(seriesId, { 
            maxInstances: Number.isNaN(parsedMax) ? 10 : parsedMax 
        });
        
        res.json({
            message: 'Generation complete',
            ...result
        });
    } catch (err) {
        console.error('Manual generation error:', err);
        res.status(500).json({ error: 'Failed to generate instances' });
    }
});

// ============================================
// GET /recurring/:id/audit - Get audit history
// ============================================
router.get('/:id/audit', async (req, res) => {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    try {
        const seriesId = parseInt(id, 10);
        if (isNaN(seriesId)) {
            return res.status(400).json({ error: 'Invalid series ID' });
        }
        const result = await pool.query(`
            SELECT 
                sal.*,
                u.first_name || ' ' || u.last_name as performed_by_name
            FROM series_audit_log sal
            LEFT JOIN users u ON sal.performed_by = u.id
            WHERE sal.series_id = $1
            ORDER BY sal.performed_at DESC
            LIMIT $2
        `, [seriesId, limit]);

        res.json(result.rows);
    } catch (err) {
        console.error('Get audit error:', err);
        res.status(500).json({ error: 'Failed to fetch audit history' });
    }
});

module.exports = router;
