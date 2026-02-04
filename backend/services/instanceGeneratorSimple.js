/**
 * SIMPLIFIED Instance Generator Service
 * 
 * SIMPLE LOGIC:
 * 1. Generate tasks ONLY for TODAY (or up to today if backfilling)
 * 2. Daily 1 AM cron creates tomorrow's task automatically
 * 3. No complex future generation - just one day at a time!
 */

const { pool } = require('../db');
const { computeNextOccurrence, isOccurrence } = require('./recurrenceEngine');
const { DateTime } = require('luxon');

const PRIORITY_VALUES = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low'
};

const normalizePriority = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const directMatch = Object.values(PRIORITY_VALUES).find((p) => p === trimmed);
    if (directMatch) return directMatch;
    return PRIORITY_VALUES[trimmed.toLowerCase()] || null;
};

/**
 * SIMPLE: Generate task for TODAY only (or specific date)
 * This is the core function - called by cron daily
 */
async function generateForDate(seriesId, targetDate, client = null) {
    const shouldRelease = !client;
    if (!client) {
        client = await pool.connect();
    }
    
    try {
        const series = await client.query(
            'SELECT * FROM recurring_series WHERE id = $1 AND deleted_at IS NULL AND paused_at IS NULL',
            [seriesId]
        );
        
        if (series.rows.length === 0) {
            return { generated: false, reason: 'Series not found or paused' };
        }
        
        const s = series.rows[0];
        const timezone = s.timezone || 'UTC';
        const rule = typeof s.recurrence_rule === 'string' 
            ? JSON.parse(s.recurrence_rule) 
            : s.recurrence_rule;
        
        const dateStr = typeof targetDate === 'string' 
            ? targetDate 
            : DateTime.fromJSDate(targetDate).setZone(timezone).toISODate();
        
        // Check if series has started
        const startDate = s.start_date?.toISOString?.()?.split('T')[0] || s.start_date?.split?.('T')[0] || s.start_date;
        if (dateStr < startDate) {
            return { generated: false, reason: 'Before series start date' };
        }
        
        // Check if series has ended
        const endDate = s.end_date?.toISOString?.()?.split('T')[0] || s.end_date?.split?.('T')[0] || s.end_date;
        if (endDate && dateStr > endDate) {
            return { generated: false, reason: 'After series end date' };
        }
        
        // Check if this date matches the recurrence pattern
        if (!isOccurrence(rule, dateStr, timezone, startDate)) {
            return { generated: false, reason: 'Date does not match recurrence pattern' };
        }
        
        // Check if task already exists for this date
        const existing = await client.query(
            'SELECT id FROM tasks WHERE series_id = $1 AND occurrence_date = $2 AND deleted_at IS NULL',
            [seriesId, dateStr]
        );
        
        if (existing.rows.length > 0) {
            return { generated: false, reason: 'Task already exists', taskId: existing.rows[0].id };
        }
        
        // Check for exception (skip/move)
        const exception = await client.query(
            'SELECT * FROM recurrence_exceptions WHERE series_id = $1 AND original_date = $2',
            [seriesId, dateStr]
        );
        
        if (exception.rows.length > 0) {
            const exc = exception.rows[0];
            if (exc.exception_type === 'skip') {
                return { generated: false, reason: 'Date is skipped' };
            }
            // For 'move', we'd create on the new_date instead - but let's keep it simple
        }
        
        // CREATE THE TASK!
        const taskId = await createTaskInstance(client, s, dateStr);
        
        // Create reminders if configured
        if (s.reminder_offsets && s.reminder_offsets.length > 0) {
            await createReminders(client, taskId, s, dateStr);
        }
        
        // Update last_generated_at
        await client.query(
            'UPDATE recurring_series SET last_generated_at = $2 WHERE id = $1',
            [seriesId, dateStr]
        );
        
        return { generated: true, taskId, date: dateStr };
        
    } finally {
        if (shouldRelease) {
            client.release();
        }
    }
}

/**
 * Generate instances for a series - SIMPLIFIED
 * Called on series creation and by cron jobs
 */
async function generateInstancesForSeries(seriesId, options = {}) {
    const { 
        forceBackfill = false,
        todayOnly = true  // DEFAULT: Only generate for today!
    } = options;
    
    const result = { generated: 0, skipped: 0, errors: [] };
    const client = await pool.connect();
    
    try {
        // Try to acquire lock
        const lockResult = await client.query(
            'SELECT pg_try_advisory_xact_lock($1)',
            [seriesId]
        );
        
        if (!lockResult.rows[0]?.pg_try_advisory_xact_lock) {
            result.errors.push('Series is being processed');
            return result;
        }
        
        await client.query('BEGIN');
        
        // Get series
        const seriesRes = await client.query(
            'SELECT * FROM recurring_series WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
            [seriesId]
        );
        
        if (seriesRes.rows.length === 0) {
            await client.query('ROLLBACK');
            result.errors.push('Series not found');
            return result;
        }
        
        const series = seriesRes.rows[0];
        
        if (series.paused_at) {
            await client.query('ROLLBACK');
            result.errors.push('Series is paused');
            return result;
        }
        
        const timezone = series.timezone || 'UTC';
        const today = DateTime.now().setZone(timezone).toISODate();
        const rule = typeof series.recurrence_rule === 'string'
            ? JSON.parse(series.recurrence_rule)
            : series.recurrence_rule;
        const startDate = series.start_date?.toISOString?.()?.split('T')[0] 
            || series.start_date?.split?.('T')[0] 
            || series.start_date;
        
        // SIMPLE: Just check if we need to create TODAY's task
        if (todayOnly) {
            // Check if today matches the pattern
            if (today >= startDate && isOccurrence(rule, today, timezone, startDate)) {
                // Check if already exists
                const existing = await client.query(
                    'SELECT id FROM tasks WHERE series_id = $1 AND occurrence_date = $2 AND deleted_at IS NULL',
                    [seriesId, today]
                );
                
                if (existing.rows.length === 0) {
                    // Check for exception
                    const exc = await client.query(
                        'SELECT * FROM recurrence_exceptions WHERE series_id = $1 AND original_date = $2',
                        [seriesId, today]
                    );
                    
                    if (exc.rows.length === 0 || exc.rows[0].exception_type !== 'skip') {
                        const taskId = await createTaskInstance(client, series, today);
                        if (series.reminder_offsets?.length > 0) {
                            await createReminders(client, taskId, series, today);
                        }
                        result.generated++;
                        
                        await client.query(
                            'UPDATE recurring_series SET last_generated_at = $2 WHERE id = $1',
                            [seriesId, today]
                        );
                    } else {
                        result.skipped++;
                    }
                }
            }
        } else if (forceBackfill) {
            // Backfill mode: Generate for past dates up to today (limited to 30 days)
            const thirtyDaysAgo = DateTime.now().setZone(timezone).minus({ days: 30 }).toISODate();
            const effectiveStart = startDate > thirtyDaysAgo ? startDate : thirtyDaysAgo;
            
            let checkDate = DateTime.fromISO(effectiveStart, { zone: timezone }).minus({ days: 1 }).toISODate();
            let iterations = 0;
            const maxIterations = 50; // Safety limit
            
            while (iterations < maxIterations) {
                iterations++;
                const nextDate = computeNextOccurrence(rule, checkDate, timezone, startDate);
                
                if (!nextDate || nextDate > today) break;
                
                // Check if exists
                const existing = await client.query(
                    'SELECT id FROM tasks WHERE series_id = $1 AND occurrence_date = $2 AND deleted_at IS NULL',
                    [seriesId, nextDate]
                );
                
                if (existing.rows.length === 0) {
                    const exc = await client.query(
                        'SELECT * FROM recurrence_exceptions WHERE series_id = $1 AND original_date = $2',
                        [seriesId, nextDate]
                    );
                    
                    if (exc.rows.length === 0 || exc.rows[0].exception_type !== 'skip') {
                        const taskId = await createTaskInstance(client, series, nextDate);
                        if (series.reminder_offsets?.length > 0) {
                            await createReminders(client, taskId, series, nextDate);
                        }
                        result.generated++;
                    } else {
                        result.skipped++;
                    }
                }
                
                checkDate = nextDate;
            }
            
            if (result.generated > 0) {
                await client.query(
                    'UPDATE recurring_series SET last_generated_at = $2 WHERE id = $1',
                    [seriesId, checkDate]
                );
            }
        }
        
        await client.query('COMMIT');
        return result;
        
    } catch (error) {
        await client.query('ROLLBACK');
        result.errors.push(error.message);
        console.error('Generation error for series', seriesId, error);
        return result;
    } finally {
        client.release();
    }
}

/**
 * Generate for ALL active series - called by cron
 * SIMPLE: Just creates today's task for each series
 */
async function generateAllPendingInstances(options = {}) {
    const { batchSize = 100 } = options;
    
    const result = await pool.query(`
        SELECT id FROM recurring_series
        WHERE deleted_at IS NULL
        AND paused_at IS NULL
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        AND start_date <= CURRENT_DATE
        ORDER BY last_generated_at NULLS FIRST
        LIMIT $1
    `, [batchSize]);
    
    const summary = {
        processed: 0,
        totalGenerated: 0,
        errors: []
    };
    
    for (const row of result.rows) {
        try {
            const genResult = await generateInstancesForSeries(row.id, { todayOnly: true });
            summary.processed++;
            summary.totalGenerated += genResult.generated;
            if (genResult.errors.length > 0) {
                summary.errors.push({ seriesId: row.id, errors: genResult.errors });
            }
        } catch (err) {
            summary.errors.push({ seriesId: row.id, errors: [err.message] });
        }
    }
    
    return summary;
}

/**
 * Ensure project exists for series
 */
async function ensureProjectForSeries(client, series) {
    if (series.project_id) return series.project_id;
    
    const found = await client.query(
        'SELECT id FROM projects WHERE workspace_id = $1 ORDER BY id LIMIT 1',
        [series.workspace_id]
    );
    
    if (found.rows.length > 0) {
        return found.rows[0].id;
    }
    
    const created = await client.query(
        'INSERT INTO projects (name, workspace_id, created_by) VALUES ($1, $2, $3) RETURNING id',
        ['Unassigned', series.workspace_id, series.created_by]
    );
    
    return created.rows[0].id;
}

/**
 * Create a task instance
 */
async function createTaskInstance(client, series, dueDate) {
    const template = series.template || {};
    const projectId = await ensureProjectForSeries(client, series);
    
    // Resolve assignee
    let assigneeId = series.static_assignee_id;
    if (series.assignment_strategy === 'round_robin') {
        assigneeId = await getNextRotationAssignee(client, series.id);
    }
    
    const priority = normalizePriority(template.priority) || 'Medium';
    const status = template.status || 'Open';
    
    const result = await client.query(`
        INSERT INTO tasks (
            workspace_id, project_id, title, description,
            priority, status, due_date, occurrence_date,
            assignee_id, series_id, is_exception, generated_at, timezone,
            created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)
        RETURNING id
    `, [
        series.workspace_id,
        projectId,
        series.title,
        series.description || template.description || null,
        priority,
        status,
        dueDate,
        dueDate,
        assigneeId,
        series.id,
        false,
        series.timezone || 'UTC',
        series.created_by
    ]);
    
    return result.rows[0].id;
}

/**
 * Get next assignee for round-robin
 */
async function getNextRotationAssignee(client, seriesId) {
    const rotation = await client.query(`
        SELECT user_id FROM assignment_rotation
        WHERE series_id = $1 AND active = true
        ORDER BY last_assigned_at NULLS FIRST, order_index
        LIMIT 1
    `, [seriesId]);
    
    if (rotation.rows.length === 0) return null;
    
    const userId = rotation.rows[0].user_id;
    
    await client.query(
        'UPDATE assignment_rotation SET last_assigned_at = NOW() WHERE series_id = $1 AND user_id = $2',
        [seriesId, userId]
    );
    
    return userId;
}

/**
 * Create reminders for a task
 */
async function createReminders(client, taskId, series, dueDate) {
    const offsets = series.reminder_offsets || [];
    const timezone = series.timezone || 'UTC';
    
    for (const offset of offsets) {
        const remindAt = calculateReminderTime(dueDate, offset, timezone);
        if (remindAt) {
            await client.query(`
                INSERT INTO task_reminders (task_id, remind_at, notification_type)
                VALUES ($1, $2, 'reminder')
            `, [taskId, remindAt]);
        }
    }
}

/**
 * Calculate reminder time
 */
function calculateReminderTime(dueDate, offset, timezone) {
    const dt = DateTime.fromISO(dueDate, { zone: timezone }).startOf('day');
    const value = offset.value || 1;
    const unit = offset.unit || 'day';
    
    switch (unit) {
        case 'minute':
        case 'minutes':
            return dt.minus({ minutes: value }).toUTC().toISO();
        case 'hour':
        case 'hours':
            return dt.minus({ hours: value }).toUTC().toISO();
        case 'day':
        case 'days':
            return dt.minus({ days: value }).toUTC().toISO();
        case 'week':
        case 'weeks':
            return dt.minus({ weeks: value }).toUTC().toISO();
        default:
            return dt.minus({ days: value }).toUTC().toISO();
    }
}

/**
 * Split series (for "this and future" edits)
 */
async function splitSeries(seriesId, splitDate, newValues, userId) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const seriesResult = await client.query(
            'SELECT * FROM recurring_series WHERE id = $1 FOR UPDATE',
            [seriesId]
        );
        
        if (seriesResult.rows.length === 0) {
            throw new Error('Series not found');
        }
        
        const original = seriesResult.rows[0];
        
        // End original series before split date
        const previousDay = DateTime.fromISO(splitDate).minus({ days: 1 }).toISODate();
        await client.query(
            'UPDATE recurring_series SET end_date = $2, updated_at = NOW() WHERE id = $1',
            [seriesId, previousDay]
        );
        
        // Create new series
        const insertResult = await client.query(`
            INSERT INTO recurring_series (
                workspace_id, project_id, title, description, template,
                recurrence_rule, timezone, start_date, end_date,
                auto_close_after_days, assignment_strategy, static_assignee_id,
                requires_approval, approver_id, reminder_offsets, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id
        `, [
            original.workspace_id,
            newValues.project_id || original.project_id,
            newValues.title || original.title,
            newValues.description || original.description,
            JSON.stringify(newValues.template || original.template),
            JSON.stringify(newValues.recurrence_rule || original.recurrence_rule),
            newValues.timezone || original.timezone,
            splitDate,
            original.end_date,
            newValues.auto_close_after_days || original.auto_close_after_days,
            newValues.assignment_strategy || original.assignment_strategy,
            newValues.static_assignee_id || original.static_assignee_id,
            newValues.requires_approval ?? original.requires_approval,
            newValues.approver_id || original.approver_id,
            JSON.stringify(newValues.reminder_offsets || original.reminder_offsets),
            userId
        ]);
        
        const newSeriesId = insertResult.rows[0].id;
        
        // Soft-delete future tasks from original
        await client.query(`
            UPDATE tasks SET deleted_at = NOW()
            WHERE series_id = $1 AND occurrence_date >= $2
        `, [seriesId, splitDate]);
        
        await client.query('COMMIT');
        
        return { originalSeriesId: seriesId, newSeriesId };
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    generateForDate,
    generateInstancesForSeries,
    generateAllPendingInstances,
    splitSeries
};
