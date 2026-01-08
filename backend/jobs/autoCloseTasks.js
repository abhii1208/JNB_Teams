/**
 * Auto-close Overdue Tasks
 * Closes recurring tasks that are past their auto_close_after_days threshold
 */

const { pool } = require('../db');

/**
 * Auto-close overdue recurring tasks
 * @returns {{ closed: number, errors: array }}
 */
async function autoCloseOverdueTasks() {
    const result = { closed: 0, errors: [] };

    try {
        // Use the database function for efficiency
        const countResult = await pool.query(
            'SELECT auto_close_overdue_recurring_tasks() as count'
        );
        
        result.closed = countResult.rows[0]?.count || 0;

        // Log auto-closes to activity
        if (result.closed > 0) {
            // Get the tasks that were auto-closed for logging
            const closedTasks = await pool.query(`
                SELECT t.id, t.name, t.series_id, t.project_id, 
                       rs.workspace_id, rs.created_by
                FROM tasks t
                JOIN recurring_series rs ON t.series_id = rs.id
                WHERE t.status = 'auto_closed'
                AND t.updated_at >= NOW() - INTERVAL '1 minute'
            `);

            for (const task of closedTasks.rows) {
                await pool.query(`
                    INSERT INTO activity_logs (
                        user_id, workspace_id, project_id, task_id,
                        type, action, item_name, details
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    task.created_by, // System action attributed to series creator
                    task.workspace_id,
                    task.project_id,
                    task.id,
                    'Task',
                    'Auto-closed',
                    task.name,
                    'Automatically closed due to exceeding overdue threshold'
                ]);
            }
        }

    } catch (err) {
        result.errors.push({ error: err.message });
        console.error('Auto-close error:', err);
    }

    return result;
}

/**
 * Get tasks eligible for auto-close (preview)
 */
async function getTasksEligibleForAutoClose() {
    const result = await pool.query(`
        SELECT 
            t.id, t.name, t.due_date, t.status,
            rs.title as series_title,
            rs.auto_close_after_days,
            EXTRACT(DAY FROM (NOW() - t.due_date)) as days_overdue
        FROM tasks t
        JOIN recurring_series rs ON t.series_id = rs.id
        WHERE t.status NOT IN ('Completed', 'Closed', 'auto_closed')
        AND t.deleted_at IS NULL
        AND rs.auto_close_after_days IS NOT NULL
        AND t.due_date < NOW() - (rs.auto_close_after_days || ' days')::interval
        ORDER BY t.due_date
    `);

    return result.rows;
}

module.exports = {
    autoCloseOverdueTasks,
    getTasksEligibleForAutoClose
};
