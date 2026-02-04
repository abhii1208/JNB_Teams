/**
 * Recurring Tasks API - V2
 * Simple, reliable recurring task management
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { DateTime } = require('luxon');

// ============================================
// GET /recurring - List all recurring tasks
// ============================================
router.get('/', async (req, res) => {
    try {
        const workspaceId = req.query.workspace_id || req.workspaceId;
        if (!workspaceId) {
            return res.status(400).json({ error: 'workspace_id is required' });
        }

        const result = await pool.query(`
            SELECT 
                rt.*,
                p.name as project_name,
                u.first_name || ' ' || u.last_name as assignee_name,
                (SELECT COUNT(*) FROM tasks t WHERE t.recurring_task_id = rt.id AND t.deleted_at IS NULL) as task_count
            FROM recurring_tasks rt
            LEFT JOIN projects p ON p.id = rt.project_id
            LEFT JOIN users u ON u.id = rt.assignee_id
            WHERE rt.workspace_id = $1
            ORDER BY rt.created_at DESC
        `, [workspaceId]);

        res.json(result.rows);
    } catch (err) {
        console.error('List recurring tasks error:', err);
        res.status(500).json({ error: 'Failed to fetch recurring tasks' });
    }
});

// ============================================
// GET /recurring/:id - Get single recurring task
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT 
                rt.*,
                p.name as project_name,
                u.first_name || ' ' || u.last_name as assignee_name,
                creator.first_name || ' ' || creator.last_name as created_by_name
            FROM recurring_tasks rt
            LEFT JOIN projects p ON p.id = rt.project_id
            LEFT JOIN users u ON u.id = rt.assignee_id
            LEFT JOIN users creator ON creator.id = rt.created_by
            WHERE rt.id = $1 AND rt.workspace_id = $2
        `, [id, req.workspaceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recurring task not found' });
        }

        // Get generated tasks
        const tasks = await pool.query(`
            SELECT id, name, due_date, status, priority, created_at
            FROM tasks
            WHERE recurring_task_id = $1 AND deleted_at IS NULL
            ORDER BY due_date DESC
            LIMIT 20
        `, [id]);

        res.json({
            ...result.rows[0],
            generated_tasks: tasks.rows
        });
    } catch (err) {
        console.error('Get recurring task error:', err);
        res.status(500).json({ error: 'Failed to fetch recurring task' });
    }
});

// ============================================
// POST /recurring - Create recurring task
// ============================================
router.post('/', async (req, res) => {
    const {
        workspace_id,
        name,
        description,
        project_id,
        priority = 'Medium',
        assignee_id,
        frequency,
        interval_value = 1,
        week_days,
        month_day,
        year_month,
        year_day,
        start_date,
        end_date,
        reminder_days = 1
    } = req.body;

    // Validation
    if (!workspace_id) {
        return res.status(400).json({ error: 'Workspace ID is required' });
    }
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }
    if (!project_id) {
        return res.status(400).json({ error: 'Project is required' });
    }
    if (!frequency || !['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
        return res.status(400).json({ error: 'Valid frequency is required (daily, weekly, monthly, yearly)' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO recurring_tasks (
                workspace_id, project_id, created_by,
                name, description, priority, assignee_id,
                frequency, interval_value, week_days, month_day, year_month, year_day,
                start_date, end_date, reminder_days
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            workspace_id,
            project_id,
            req.userId,
            name.trim(),
            description || null,
            priority,
            assignee_id || null,
            frequency,
            interval_value,
            week_days || null,
            month_day || null,
            year_month || null,
            year_day || null,
            start_date || new Date().toISOString().split('T')[0],
            end_date || null,
            reminder_days
        ]);

        const recurring = result.rows[0];

        // Generate today's task if applicable
        const generated = await generateTaskForDate(recurring, new Date().toISOString().split('T')[0]);

        res.status(201).json({
            ...recurring,
            generated_today: generated
        });
    } catch (err) {
        console.error('Create recurring task error:', err);
        res.status(500).json({ error: 'Failed to create recurring task' });
    }
});

// ============================================
// PUT /recurring/:id - Update recurring task
// ============================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        name,
        description,
        project_id,
        priority,
        assignee_id,
        frequency,
        interval_value,
        week_days,
        month_day,
        year_month,
        year_day,
        start_date,
        end_date,
        reminder_days,
        is_active
    } = req.body;

    try {
        // Check ownership
        const existing = await pool.query(
            'SELECT id FROM recurring_tasks WHERE id = $1 AND workspace_id = $2',
            [id, req.workspaceId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Recurring task not found' });
        }

        const result = await pool.query(`
            UPDATE recurring_tasks SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                project_id = COALESCE($3, project_id),
                priority = COALESCE($4, priority),
                assignee_id = $5,
                frequency = COALESCE($6, frequency),
                interval_value = COALESCE($7, interval_value),
                week_days = $8,
                month_day = $9,
                year_month = $10,
                year_day = $11,
                start_date = COALESCE($12, start_date),
                end_date = $13,
                reminder_days = COALESCE($14, reminder_days),
                is_active = COALESCE($15, is_active),
                updated_at = NOW()
            WHERE id = $16
            RETURNING *
        `, [
            name,
            description,
            project_id,
            priority,
            assignee_id,
            frequency,
            interval_value,
            week_days,
            month_day,
            year_month,
            year_day,
            start_date,
            end_date,
            reminder_days,
            is_active,
            id
        ]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update recurring task error:', err);
        res.status(500).json({ error: 'Failed to update recurring task' });
    }
});

// ============================================
// DELETE /recurring/:id - Delete recurring task
// ============================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM recurring_tasks WHERE id = $1 AND workspace_id = $2 RETURNING id',
            [id, req.workspaceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recurring task not found' });
        }

        res.json({ success: true, deleted: id });
    } catch (err) {
        console.error('Delete recurring task error:', err);
        res.status(500).json({ error: 'Failed to delete recurring task' });
    }
});

// ============================================
// POST /recurring/:id/pause - Pause recurring task
// ============================================
router.post('/:id/pause', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            UPDATE recurring_tasks 
            SET is_active = false, updated_at = NOW()
            WHERE id = $1 AND workspace_id = $2
            RETURNING *
        `, [id, req.workspaceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recurring task not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Pause recurring task error:', err);
        res.status(500).json({ error: 'Failed to pause recurring task' });
    }
});

// ============================================
// POST /recurring/:id/resume - Resume recurring task
// ============================================
router.post('/:id/resume', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            UPDATE recurring_tasks 
            SET is_active = true, updated_at = NOW()
            WHERE id = $1 AND workspace_id = $2
            RETURNING *
        `, [id, req.workspaceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recurring task not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Resume recurring task error:', err);
        res.status(500).json({ error: 'Failed to resume recurring task' });
    }
});

// ============================================
// POST /recurring/:id/generate - Manually generate task
// ============================================
router.post('/:id/generate', async (req, res) => {
    const { id } = req.params;
    const { date } = req.body;

    try {
        const recurring = await pool.query(
            'SELECT * FROM recurring_tasks WHERE id = $1 AND workspace_id = $2',
            [id, req.workspaceId]
        );

        if (recurring.rows.length === 0) {
            return res.status(404).json({ error: 'Recurring task not found' });
        }

        const targetDate = date || new Date().toISOString().split('T')[0];
        const task = await generateTaskForDate(recurring.rows[0], targetDate, true);

        if (task) {
            res.json({ success: true, task });
        } else {
            res.status(400).json({ error: 'Task already exists for this date or date does not match pattern' });
        }
    } catch (err) {
        console.error('Generate task error:', err);
        res.status(500).json({ error: 'Failed to generate task' });
    }
});

// ============================================
// HELPER: Generate task for a specific date
// ============================================
async function generateTaskForDate(recurring, targetDate, force = false) {
    const dt = DateTime.fromISO(targetDate);
    
    // Check if date matches pattern
    if (!force && !matchesPattern(recurring, dt)) {
        return null;
    }

    // Check if task already exists for this date
    const existing = await pool.query(
        'SELECT id FROM tasks WHERE recurring_task_id = $1 AND due_date = $2 AND deleted_at IS NULL',
        [recurring.id, targetDate]
    );

    if (existing.rows.length > 0) {
        return null;  // Already exists
    }

    // Create the task
    const result = await pool.query(`
        INSERT INTO tasks (
            project_id, name, description, priority, status, stage,
            due_date, assignee_id, recurring_task_id, created_by
        ) VALUES ($1, $2, $3, $4, 'Open', 'Planned', $5, $6, $7, $8)
        RETURNING *
    `, [
        recurring.project_id,
        recurring.name,
        recurring.description,
        recurring.priority,
        targetDate,
        recurring.assignee_id,
        recurring.id,
        recurring.created_by
    ]);

    // Update last_generated_date
    await pool.query(
        'UPDATE recurring_tasks SET last_generated_date = $1 WHERE id = $2',
        [targetDate, recurring.id]
    );

    return result.rows[0];
}

// ============================================
// HELPER: Check if date matches recurrence pattern
// ============================================
function matchesPattern(recurring, dt) {
    const { frequency, interval_value, week_days, month_day, year_month, year_day, start_date, end_date } = recurring;
    
    // Check date range
    const startDt = DateTime.fromISO(start_date?.toISOString?.().split('T')[0] || start_date);
    if (dt < startDt) return false;
    
    if (end_date) {
        const endDt = DateTime.fromISO(end_date?.toISOString?.().split('T')[0] || end_date);
        if (dt > endDt) return false;
    }

    switch (frequency) {
        case 'daily':
            // Check interval
            const daysDiff = Math.floor(dt.diff(startDt, 'days').days);
            return daysDiff % interval_value === 0;

        case 'weekly':
            if (week_days && week_days.length > 0) {
                // Check if today's day of week is in the list (0=Sunday in JS, 7=Sunday in Luxon)
                const dow = dt.weekday === 7 ? 0 : dt.weekday;
                return week_days.includes(dow);
            }
            // Default: same day of week as start
            return dt.weekday === startDt.weekday;

        case 'monthly':
            if (month_day) {
                if (month_day === -1) {
                    // Last day of month
                    return dt.day === dt.daysInMonth;
                }
                return dt.day === month_day;
            }
            // Default: same day of month as start
            return dt.day === startDt.day;

        case 'yearly':
            if (year_month && year_day) {
                return dt.month === year_month && dt.day === year_day;
            }
            // Default: same month and day as start
            return dt.month === startDt.month && dt.day === startDt.day;

        default:
            return false;
    }
}

// ============================================
// EXPORT: For use by cron job
// ============================================
async function generateAllDailyTasks() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // Get all active recurring tasks
        const result = await pool.query(`
            SELECT * FROM recurring_tasks 
            WHERE is_active = true 
            AND start_date <= $1
            AND (end_date IS NULL OR end_date >= $1)
        `, [today]);

        let generated = 0;
        let skipped = 0;

        for (const recurring of result.rows) {
            const task = await generateTaskForDate(recurring, today);
            if (task) {
                generated++;
            } else {
                skipped++;
            }
        }

        console.log(`[Recurring] Generated ${generated} tasks, skipped ${skipped}`);
        return { generated, skipped };
    } catch (err) {
        console.error('[Recurring] Daily generation error:', err);
        throw err;
    }
}

module.exports = router;
module.exports.generateAllDailyTasks = generateAllDailyTasks;
module.exports.generateTaskForDate = generateTaskForDate;
