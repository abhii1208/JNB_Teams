/**
 * Instance Generator Service
 * Generates task instances from recurring series
 * Handles exceptions, assignments, reminders
 */

const { pool } = require('../db');
const { computeNextOccurrence, generateOccurrences, isValidForGeneration } = require('./recurrenceEngine');
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
 * Generate instances for a single series
 * @param {number} seriesId - The recurring series ID
 * @param {object} options - { maxInstances, forceRegenerate, forceBackfill, preventFuture }
 * @returns {object} - { generated: number, skipped: number, errors: array }
 */
async function generateInstancesForSeries(seriesId, options = {}) {
    const { 
        maxInstances = 10, 
        forceRegenerate = false, 
        forceBackfill = false,
        preventFuture = null // null means use series setting
    } = options;
    const result = { generated: 0, skipped: 0, moved: 0, errors: [] };
    
    const client = await pool.connect();
    let lockAcquired = false;
    
    try {
        // Acquire advisory lock to prevent concurrent generation
        const lockResult = await client.query(
            'SELECT pg_try_advisory_lock($1)',
            [seriesId]
        );

        lockAcquired = Boolean(lockResult.rows[0]?.pg_try_advisory_lock);
        if (!lockAcquired) {
            result.errors.push('Series is being processed by another worker');
            return result;
        }

        await client.query('BEGIN');

        // Load series with lock
        const seriesResult = await client.query(`
            SELECT * FROM recurring_series 
            WHERE id = $1 
            AND deleted_at IS NULL
            FOR UPDATE
        `, [seriesId]);

        if (seriesResult.rows.length === 0) {
            await client.query('ROLLBACK');
            result.errors.push('Series not found or deleted');
            return result;
        }

        const series = seriesResult.rows[0];

        // Check if series is paused
        if (series.paused_at) {
            await client.query('ROLLBACK');
            result.errors.push('Series is paused');
            return result;
        }

        // Count existing future instances
        const countResult = await client.query(`
            SELECT COUNT(*) as count
            FROM tasks
            WHERE series_id = $1
            AND due_date >= CURRENT_DATE
            AND deleted_at IS NULL
        `, [seriesId]);

        const futureCount = parseInt(countResult.rows[0].count);
        const targetCount = series.max_future_instances || maxInstances;

        const timezone = series.timezone || 'UTC';
        const toISODate = (value) => {
            if (!value) return null;
            if (typeof value === 'string') {
                return value.split('T')[0].split(' ')[0];
            }
            const dt = DateTime.fromJSDate(value, { zone: timezone });
            return dt.isValid ? dt.toISODate() : null;
        };
        const seriesStartDate = toISODate(series.start_date);
        const seriesEndDate = toISODate(series.end_date);
        const lastGeneratedAt = toISODate(series.last_generated_at);
        const rule = typeof series.recurrence_rule === 'string'
            ? JSON.parse(series.recurrence_rule)
            : (series.recurrence_rule || {});
        const backfillPolicy = series.backfill_policy || 'skip';
        const today = DateTime.now().setZone(timezone).toISODate();
        const parsedRuleCount = rule.count != null ? Number(rule.count) : null;
        const ruleCount = Number.isFinite(parsedRuleCount) && parsedRuleCount > 0 ? parsedRuleCount : null;

        if (!seriesStartDate) {
            await client.query('ROLLBACK');
            result.errors.push('Invalid series start_date');
            return result;
        }

        const totalCountResult = await client.query(`
            SELECT COUNT(*) as count
            FROM tasks
            WHERE series_id = $1
            AND deleted_at IS NULL
        `, [seriesId]);
        const totalCount = parseInt(totalCountResult.rows[0].count);
        const shouldBackfill = forceBackfill
            || series.generate_past
            || backfillPolicy !== 'skip'
            || (backfillPolicy === 'skip' && totalCount === 0 && !lastGeneratedAt);
        
        // Determine if we should prevent future instances
        const shouldPreventFuture = preventFuture !== null ? preventFuture : (series.prevent_future ?? true);

        if (
            futureCount >= targetCount
            && !forceRegenerate
            && !shouldBackfill
            && lastGeneratedAt
            && lastGeneratedAt >= today
        ) {
            await client.query('COMMIT');
            return result;
        }

        // Determine start point for generation
        const startPoint = lastGeneratedAt && totalCount > 0
            ? lastGeneratedAt
            : DateTime.fromISO(seriesStartDate, { zone: timezone })
                .minus({ days: 1 })
                .toISODate();
        const generationStartPoint = shouldBackfill
            ? startPoint
            : DateTime.fromISO(today, { zone: timezone }).minus({ days: 1 }).toISODate();
        let currentDate = generationStartPoint < startPoint ? startPoint : generationStartPoint;

        // Generate occurrences
        let generatedCount = 0;
        let generatedFutureCount = 0;
        const generationAnchor = DateTime.fromISO(currentDate, { zone: timezone });
        const spanDays = Math.abs(Math.round(
            DateTime.fromISO(today, { zone: timezone }).diff(generationAnchor, 'days').days
        ));
        const estimatedIterations = spanDays + targetCount + 31;
        const maxIterations = Math.max(100, Math.min(10000, estimatedIterations)); // Safety limit
        let iterations = 0;
        const canGenerateFuture = () => {
            // If prevent future is enabled, don't generate future instances
            if (shouldPreventFuture) return false;
            return futureCount + generatedFutureCount < targetCount;
        };

        while (
            iterations < maxIterations &&
            (!ruleCount || (totalCount + generatedCount) < ruleCount)
        ) {
            iterations++;

            // Compute next occurrence
            const nextDate = computeNextOccurrence(rule, currentDate, timezone, seriesStartDate);
            
            if (!nextDate) {
                break; // No more occurrences
            }

            // Check series end date
            if (seriesEndDate && nextDate > seriesEndDate) {
                break;
            }

            const isFuture = nextDate > today;
            
            // If future instances are prevented, stop when we hit a future date
            if (isFuture && shouldPreventFuture) {
                // Update next_occurrence in the series for reference
                await client.query(`
                    UPDATE recurring_series SET next_occurrence = $2 WHERE id = $1
                `, [seriesId, nextDate]);
                break;
            }
            
            if (isFuture && !canGenerateFuture()) {
                break;
            }

            if (!shouldBackfill && nextDate < today) {
                currentDate = nextDate;
                continue;
            }

            // Check for exception
            const exception = await getException(client, seriesId, nextDate);
            
            if (exception) {
                if (exception.exception_type === 'skip') {
                    // Log skip and continue
                    await logGeneration(client, seriesId, nextDate, null, 'skipped');
                    result.skipped++;
                    currentDate = nextDate;
                    continue;
                } else if (exception.exception_type === 'move') {
                    const movedDate = exception.new_date;
                    const movedIsFuture = movedDate && movedDate > today;
                    if (movedIsFuture && !canGenerateFuture()) {
                        break;
                    }
                    // Create instance on new date
                    const taskId = await createTaskInstance(client, series, exception.new_date, true);
                    await logGeneration(client, seriesId, nextDate, taskId, 'moved');
                    result.moved++;
                    generatedCount++;
                    if (movedIsFuture) {
                        generatedFutureCount++;
                    }
                    currentDate = nextDate;
                    continue;
                }
            }

            // Check if already exists (idempotency)
            const existingTask = await client.query(`
                SELECT id FROM tasks 
                WHERE series_id = $1 
                AND occurrence_date = $2
                AND deleted_at IS NULL
            `, [seriesId, nextDate]);

            if (existingTask.rows.length > 0) {
                await logGeneration(client, seriesId, nextDate, existingTask.rows[0].id, 'already_exists');
                currentDate = nextDate;
                continue;
            }

            // Create the task instance
            const taskId = await createTaskInstance(client, series, nextDate, false);
            
            // Create reminders
            await createReminders(client, taskId, series, nextDate);
            
            // Create approval if needed
            if (series.requires_approval && series.approver_id) {
                await createApproval(client, taskId, series);
            }

            // Log generation
            await logGeneration(client, seriesId, nextDate, taskId, 'created');

            result.generated++;
            generatedCount++;
            if (isFuture) {
                generatedFutureCount++;
            }
            currentDate = nextDate;
        }

        // Update last_generated_at
        if (generatedCount > 0) {
            await client.query(`
                UPDATE recurring_series 
                SET last_generated_at = $2
                WHERE id = $1
            `, [seriesId, currentDate]);
        }

        await client.query('COMMIT');

        return result;

    } catch (error) {
        await client.query('ROLLBACK');
        result.errors.push(error.message);
        console.error('Generation error for series', seriesId, error);
        return result;
    } finally {
        if (lockAcquired) {
            try {
                await client.query('SELECT pg_advisory_unlock($1)', [seriesId]);
            } catch (unlockError) {
                console.error('Failed to release advisory lock for series', seriesId, unlockError);
            }
        }
        client.release();
    }
}

/**
 * Get exception for a date
 */
async function getException(client, seriesId, date) {
    const result = await client.query(`
        SELECT * FROM recurrence_exceptions
        WHERE series_id = $1 AND original_date = $2
    `, [seriesId, date]);
    
    return result.rows[0] || null;
}

/**
 * Create a task instance from series template
 */
async function ensureProjectForSeries(client, series) {
    // If series already references a project, use it
    if (series.project_id) return series.project_id;

    // Try to find an existing project in the workspace
    const found = await client.query(
        'SELECT id FROM projects WHERE workspace_id = $1 ORDER BY id LIMIT 1',
        [series.workspace_id]
    );

    if (found.rows && found.rows.length > 0) {
        return found.rows[0].id;
    }

    // If none exists, create a lightweight 'Unassigned' project for the workspace
    const created = await client.query(
        `INSERT INTO projects (name, workspace_id, created_by)
         VALUES ($1, $2, $3) RETURNING id`,
        ['Unassigned', series.workspace_id, series.created_by]
    );

    return created.rows[0].id;
}

/**
 * Create a task instance from series template
 */
async function createTaskInstance(client, series, dueDate, isException = false) {
    const template = series.template || {};
    const priority = normalizePriority(template.priority) || 'Medium';
    
    // Resolve assignee
    const assigneeId = await resolveAssignee(client, series);

    // Convert due date to UTC timestamptz
    const dueDateUtc = DateTime.fromISO(dueDate, { zone: series.timezone })
        .set({ hour: 23, minute: 59, second: 59 })
        .toUTC()
        .toISO();

    // Ensure we have a valid project_id to satisfy tasks.project_id NOT NULL
    const projectId = await ensureProjectForSeries(client, series);

    const result = await client.query(`
        INSERT INTO tasks (
            series_id,
            name,
            description,
            project_id,
            assignee_id,
            stage,
            status,
            priority,
            due_date,
            timezone,
            occurrence_date,
            is_exception,
            generated_at,
            notes,
            created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14)
        RETURNING id
    `, [
        series.id,
        series.title,
        series.description,
        projectId,
        assigneeId,
        template.stage || 'Planned',
        template.status || 'Open',
        priority,
        dueDateUtc,
        series.timezone,
        dueDate,
        isException,
        template.notes || null,
        series.created_by
    ]);

    const taskId = result.rows[0].id;

    // Log to activity
    await client.query(`
        INSERT INTO activity_logs (
            user_id, workspace_id, project_id, task_id, 
            type, action, item_name, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
        series.created_by,
        series.workspace_id,
        projectId,
        taskId,
        'Task',
        'Generated',
        series.title,
        `Auto-generated from recurring series "${series.title}"`
    ]);

    return taskId;
}

/**
 * Resolve assignee based on assignment strategy
 */
async function resolveAssignee(client, series) {
    switch (series.assignment_strategy) {
        case 'static':
            return series.static_assignee_id;

        case 'round_robin':
            // Use the database function for atomic round-robin
            const result = await client.query(
                'SELECT get_next_assignee($1) as user_id',
                [series.id]
            );
            return result.rows[0]?.user_id || series.static_assignee_id;

        case 'role_based':
            // For role-based, fall back to static for now
            // Real implementation would look up role members
            return series.static_assignee_id;

        default:
            return series.static_assignee_id;
    }
}

/**
 * Create reminders for a task
 */
async function createReminders(client, taskId, series, dueDate) {
    const offsets = series.reminder_offsets || [];
    
    for (const offset of offsets) {
        const remindAt = calculateReminderTime(dueDate, offset, series.timezone);
        
        // Don't create reminders in the past
        if (remindAt <= DateTime.now().toISO()) {
            continue;
        }

        await client.query(`
            INSERT INTO task_reminders (task_id, remind_at)
            VALUES ($1, $2)
        `, [taskId, remindAt]);
    }
}

/**
 * Calculate reminder time from due date and offset
 */
function calculateReminderTime(dueDate, offset, timezone) {
    const dt = DateTime.fromISO(dueDate, { zone: timezone })
        .set({ hour: 9, minute: 0 }); // Default to 9 AM

    const { value, unit } = offset;
    
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
 * Create approval for a task
 */
async function createApproval(client, taskId, series) {
    // Determine project_id from the task to ensure approvals are tied to the correct project
    const taskRes = await client.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    const projectId = taskRes.rows.length > 0 ? taskRes.rows[0].project_id : series.project_id;

    await client.query(`
        INSERT INTO approvals (type, task_id, project_id, requester_id, reason, status)
        VALUES ('task', $1, $2, $3, 'Auto-generated recurring task', 'Pending')
    `, [taskId, projectId, series.created_by]);

    // Update task status to pending approval
    await client.query(`
        UPDATE tasks SET status = 'Pending Approval' WHERE id = $1
    `, [taskId]);

    // Notify the project owner about the approval request
    try {
        const projRes = await client.query('SELECT created_by FROM projects WHERE id = $1', [projectId]);
        if (projRes.rows.length > 0) {
            const ownerId = projRes.rows[0].created_by;
            if (ownerId) {
                await client.query(
                    'INSERT INTO notifications (user_id, type, title, message, task_id, project_id) VALUES ($1, $2, $3, $4, $5, $6)',
                    [ownerId, 'Approval', 'Approval Requested', `A task requires your approval: ${series.title}`, taskId, projectId]
                );
            }
        }
    } catch (err) {
        console.error('Failed to notify project owner for approval:', err);
    }
}

/**
 * Log generation event
 */
async function logGeneration(client, seriesId, date, taskId, status, errorMessage = null) {
    await client.query(`
        INSERT INTO generation_log (series_id, generated_date, task_id, status, error_message)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (series_id, generated_date) DO UPDATE
        SET status = $4, task_id = $3, error_message = $5
    `, [seriesId, date, taskId, status, errorMessage]);
}

/**
 * Generate instances for all active series (called by cron)
 */
async function generateAllPendingInstances(options = {}) {
    const { batchSize = 50 } = options;
    
    const result = await pool.query(`
        SELECT id FROM recurring_series
        WHERE deleted_at IS NULL
        AND paused_at IS NULL
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ORDER BY last_generated_at NULLS FIRST
        LIMIT $1
    `, [batchSize]);

    const summary = {
        processed: 0,
        totalGenerated: 0,
        totalSkipped: 0,
        errors: []
    };

    for (const row of result.rows) {
        const genResult = await generateInstancesForSeries(row.id, options);
        summary.processed++;
        summary.totalGenerated += genResult.generated;
        summary.totalSkipped += genResult.skipped;
        if (genResult.errors.length > 0) {
            summary.errors.push({ seriesId: row.id, errors: genResult.errors });
        }
    }

    return summary;
}

/**
 * Split a series at a specific date ("this and future" edit)
 * @param {number} seriesId - Original series ID
 * @param {string} splitDate - Date to split from
 * @param {object} newValues - New values for the split series
 * @param {number} userId - User performing the split
 */
async function splitSeries(seriesId, splitDate, newValues, userId) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get original series
        const seriesResult = await client.query(
            'SELECT * FROM recurring_series WHERE id = $1 FOR UPDATE',
            [seriesId]
        );
        
        if (seriesResult.rows.length === 0) {
            throw new Error('Series not found');
        }

        const original = seriesResult.rows[0];

        // Update original series to end before split date
        const previousDay = DateTime.fromISO(splitDate).minus({ days: 1 }).toISODate();
        await client.query(`
            UPDATE recurring_series 
            SET end_date = $2, updated_at = NOW()
            WHERE id = $1
        `, [seriesId, previousDay]);

        // Create new series starting from split date
        const newSeries = {
            ...original,
            ...newValues,
            id: undefined,
            start_date: splitDate,
            end_date: original.end_date,
            last_generated_at: null,
            created_by: userId,
            version: 1
        };

        const insertResult = await client.query(`
            INSERT INTO recurring_series (
                workspace_id, project_id, title, description, template,
                recurrence_rule, timezone, start_date, end_date,
                auto_close_after_days, backfill_policy, max_future_instances,
                assignment_strategy, static_assignee_id, requires_approval, approver_id,
                reminder_offsets, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id
        `, [
            newSeries.workspace_id,
            newSeries.project_id,
            newSeries.title,
            newSeries.description,
            JSON.stringify(newSeries.template),
            JSON.stringify(newSeries.recurrence_rule),
            newSeries.timezone,
            newSeries.start_date,
            newSeries.end_date,
            newSeries.auto_close_after_days,
            newSeries.backfill_policy,
            newSeries.max_future_instances,
            newSeries.assignment_strategy,
            newSeries.static_assignee_id,
            newSeries.requires_approval,
            newSeries.approver_id,
            JSON.stringify(newSeries.reminder_offsets),
            userId
        ]);

        const newSeriesId = insertResult.rows[0].id;

        // Delete future instances from original series (from split date onwards)
        await client.query(`
            UPDATE tasks 
            SET deleted_at = NOW()
            WHERE series_id = $1 
            AND occurrence_date >= $2
        `, [seriesId, splitDate]);

        // Cancel their reminders
        await client.query(`
            UPDATE task_reminders 
            SET cancelled_at = NOW()
            WHERE task_id IN (
                SELECT id FROM tasks 
                WHERE series_id = $1 
                AND occurrence_date >= $2
            )
        `, [seriesId, splitDate]);

        // Log the split
        await client.query(`
            INSERT INTO series_audit_log (series_id, action, old_values, new_values, performed_by)
            VALUES ($1, 'split', $2, $3, $4)
        `, [seriesId, JSON.stringify({ end_date: original.end_date }), 
            JSON.stringify({ new_series_id: newSeriesId, split_date: splitDate }), userId]);

        await client.query('COMMIT');

        // Generate instances for new series
        await generateInstancesForSeries(newSeriesId);

        return { originalSeriesId: seriesId, newSeriesId };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    generateInstancesForSeries,
    generateAllPendingInstances,
    splitSeries,
    resolveAssignee
};
