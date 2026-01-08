/**
 * Reminder Service
 * Sends pending task reminders
 */

const { pool } = require('../db');

/**
 * Send all pending reminders
 * @returns {{ sent: number, failed: number, errors: array }}
 */
async function sendPendingReminders() {
    const result = { sent: 0, failed: 0, errors: [] };

    try {
        // Get reminders that are due and haven't been sent
        const reminders = await pool.query(`
            SELECT 
                tr.id,
                tr.task_id,
                tr.remind_at,
                t.name as task_name,
                t.due_date,
                t.assignee_id,
                t.project_id,
                p.name as project_name,
                u.email as assignee_email,
                u.first_name as assignee_first_name
            FROM task_reminders tr
            JOIN tasks t ON tr.task_id = t.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE tr.sent_at IS NULL
            AND tr.cancelled_at IS NULL
            AND tr.remind_at <= NOW()
            AND t.deleted_at IS NULL
            AND t.status NOT IN ('Completed', 'Closed', 'auto_closed')
            ORDER BY tr.remind_at
            LIMIT 100
        `);

        for (const reminder of reminders.rows) {
            try {
                // Create in-app notification
                if (reminder.assignee_id) {
                    await pool.query(`
                        INSERT INTO notifications (
                            user_id, type, title, message, 
                            task_id, project_id
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        reminder.assignee_id,
                        'Reminder',
                        `Task Reminder: ${reminder.task_name}`,
                        `Reminder: "${reminder.task_name}" is due ${formatDueDate(reminder.due_date)}`,
                        reminder.task_id,
                        reminder.project_id
                    ]);
                }

                // TODO: Add email sending here if email service is configured
                // await sendReminderEmail(reminder);

                // Mark reminder as sent
                await pool.query(`
                    UPDATE task_reminders 
                    SET sent_at = NOW()
                    WHERE id = $1
                `, [reminder.id]);

                result.sent++;

            } catch (err) {
                result.failed++;
                result.errors.push({
                    reminderId: reminder.id,
                    error: err.message
                });
            }
        }

    } catch (err) {
        result.errors.push({ general: err.message });
    }

    return result;
}

/**
 * Cancel reminders for a task
 */
async function cancelTaskReminders(taskId) {
    return pool.query(`
        UPDATE task_reminders 
        SET cancelled_at = NOW()
        WHERE task_id = $1
        AND sent_at IS NULL
    `, [taskId]);
}

/**
 * Format due date for display
 */
function formatDueDate(dueDate) {
    const date = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueDateStr = date.toDateString();
    
    if (dueDateStr === today.toDateString()) {
        return 'today';
    } else if (dueDateStr === tomorrow.toDateString()) {
        return 'tomorrow';
    } else if (date < today) {
        return 'overdue';
    } else {
        return `on ${date.toLocaleDateString()}`;
    }
}

module.exports = {
    sendPendingReminders,
    cancelTaskReminders
};
