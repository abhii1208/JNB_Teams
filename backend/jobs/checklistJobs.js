/**
 * Checklist Background Jobs
 * - Process overdue occurrences (mark as missed)
 * - Generate future occurrences
 * - Send reminders
 */
const { pool } = require('../db');
const checklistService = require('../services/checklistService');
const { createNotification } = require('../services/notificationService');

/**
 * Process overdue occurrences - mark pending items as missed when window closes
 * Should run daily at midnight (workspace timezone)
 */
async function processOverdueOccurrences() {
  console.log('🕐 Processing overdue checklist occurrences...');
  try {
    await checklistService.processOverdueOccurrences();
    console.log('✅ Overdue occurrences processed');
  } catch (err) {
    console.error('❌ Error processing overdue occurrences:', err);
  }
}

/**
 * Generate future occurrences for active checklist items
 * Should run daily to ensure occurrences exist for upcoming periods
 */
async function generateFutureOccurrences() {
  console.log('🕐 Generating future checklist occurrences...');
  try {
    await checklistService.generateFutureOccurrences();
    console.log('✅ Future occurrences generated');
  } catch (err) {
    console.error('❌ Error generating future occurrences:', err);
  }
}

/**
 * Send daily reminders for pending items
 * Should run at configured time (default 9am) per workspace
 */
async function sendDailyReminders() {
  console.log('🕐 Sending daily checklist reminders...');
  try {
    // Get all workspaces with reminder settings
    const workspaces = await pool.query(`
      SELECT w.id, w.timezone, wcs.daily_reminder_time, wcs.enable_reminders
      FROM workspaces w
      LEFT JOIN workspace_checklist_settings wcs ON w.id = wcs.workspace_id
      WHERE w.is_personal = FALSE OR w.is_personal IS NULL
    `);

    for (const workspace of workspaces.rows) {
      if (workspace.enable_reminders === false) continue;

      const timezone = workspace.timezone || 'Asia/Kolkata';
      const today = checklistService.getCurrentDateInTimezone(timezone);

      // Get users with pending items for today
      const pendingItems = await pool.query(`
        SELECT DISTINCT ca.user_id, u.username, u.email,
          COUNT(DISTINCT co.id) as pending_count
        FROM checklist_assignments ca
        JOIN checklist_items ci ON ca.checklist_item_id = ci.id
        JOIN checklist_occurrences co ON ci.id = co.checklist_item_id
        JOIN users u ON ca.user_id = u.id
        WHERE ci.workspace_id = $1
        AND ca.is_active = TRUE
        AND co.status = 'pending'
        AND (
          (co.frequency = 'daily' AND co.occurrence_date = $2)
          OR (co.frequency IN ('weekly', 'monthly') AND $2 BETWEEN co.occurrence_date AND co.period_end_date)
        )
        AND ca.assigned_from <= $2
        AND (ca.assigned_to IS NULL OR ca.assigned_to >= $2)
        GROUP BY ca.user_id, u.username, u.email
      `, [workspace.id, today]);

      // Send notification to each user
      for (const user of pendingItems.rows) {
        await createNotification({
          userId: user.user_id,
          type: 'checklist_reminder',
          title: 'Checklist Reminder',
          message: `You have ${user.pending_count} pending checklist item(s) to confirm today.`,
          workspaceId: workspace.id,
          actionUrl: '/checklist/today',
          broadcast: true
        });
      }
    }

    console.log('✅ Daily reminders sent');
  } catch (err) {
    console.error('❌ Error sending daily reminders:', err);
  }
}

/**
 * Send weekly reminders (typically Wednesday)
 */
async function sendWeeklyReminders() {
  console.log('🕐 Sending weekly checklist reminders...');
  try {
    const workspaces = await pool.query(`
      SELECT w.id, w.timezone, wcs.weekly_reminder_day, wcs.enable_reminders
      FROM workspaces w
      LEFT JOIN workspace_checklist_settings wcs ON w.id = wcs.workspace_id
      WHERE w.is_personal = FALSE OR w.is_personal IS NULL
    `);

    for (const workspace of workspaces.rows) {
      if (workspace.enable_reminders === false) continue;

      const timezone = workspace.timezone || 'Asia/Kolkata';
      const today = checklistService.getCurrentDateInTimezone(timezone);
      
      // Check if today is the reminder day (default Wednesday = 3)
      const dayOfWeek = new Date(today).getDay();
      // Stored as ISO day (1=Mon ... 7=Sun). Backward-compat: treat 0 as Sunday.
      let reminderDay = workspace.weekly_reminder_day;
      if (reminderDay === null || reminderDay === undefined) reminderDay = 3;
      if (reminderDay === 0) reminderDay = 7;
      if (reminderDay < 1 || reminderDay > 7) reminderDay = 3;
      
      // Convert to ISO day (1=Mon, 7=Sun)
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      if (isoDay !== reminderDay) continue;

      // Get users with pending weekly items
      const pendingItems = await pool.query(`
        SELECT DISTINCT ca.user_id, u.username,
          COUNT(DISTINCT co.id) as pending_count
        FROM checklist_assignments ca
        JOIN checklist_items ci ON ca.checklist_item_id = ci.id
        JOIN checklist_occurrences co ON ci.id = co.checklist_item_id
        JOIN users u ON ca.user_id = u.id
        WHERE ci.workspace_id = $1
        AND ca.is_active = TRUE
        AND co.status = 'pending'
        AND co.frequency = 'weekly'
        AND $2 BETWEEN co.occurrence_date AND co.period_end_date
        GROUP BY ca.user_id, u.username
      `, [workspace.id, today]);

      for (const user of pendingItems.rows) {
        await createNotification({
          userId: user.user_id,
          type: 'checklist_reminder',
          title: 'Weekly Checklist Reminder',
          message: `You have ${user.pending_count} pending weekly checklist item(s). Please confirm before Sunday.`,
          workspaceId: workspace.id,
          actionUrl: '/checklist/today',
          broadcast: true
        });
      }
    }

    console.log('✅ Weekly reminders sent');
  } catch (err) {
    console.error('❌ Error sending weekly reminders:', err);
  }
}

/**
 * Send monthly reminders (25th and last day)
 */
async function sendMonthlyReminders() {
  console.log('🕐 Sending monthly checklist reminders...');
  try {
    const workspaces = await pool.query(`
      SELECT w.id, w.timezone, wcs.monthly_reminder_day, wcs.monthly_final_reminder, wcs.enable_reminders
      FROM workspaces w
      LEFT JOIN workspace_checklist_settings wcs ON w.id = wcs.workspace_id
      WHERE w.is_personal = FALSE OR w.is_personal IS NULL
    `);

    for (const workspace of workspaces.rows) {
      if (workspace.enable_reminders === false) continue;

      const timezone = workspace.timezone || 'Asia/Kolkata';
      const today = checklistService.getCurrentDateInTimezone(timezone);
      const todayDate = new Date(today);
      const dayOfMonth = todayDate.getDate();
      const lastDayOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();

      const reminderDay = workspace.monthly_reminder_day || 25;
      const sendFinalReminder = workspace.monthly_final_reminder !== false;

      // Check if today is reminder day or last day of month
      const shouldSend = dayOfMonth === reminderDay || (sendFinalReminder && dayOfMonth === lastDayOfMonth);
      if (!shouldSend) continue;

      // Get users with pending monthly items
      const pendingItems = await pool.query(`
        SELECT DISTINCT ca.user_id, u.username,
          COUNT(DISTINCT co.id) as pending_count
        FROM checklist_assignments ca
        JOIN checklist_items ci ON ca.checklist_item_id = ci.id
        JOIN checklist_occurrences co ON ci.id = co.checklist_item_id
        JOIN users u ON ca.user_id = u.id
        WHERE ci.workspace_id = $1
        AND ca.is_active = TRUE
        AND co.status = 'pending'
        AND co.frequency = 'monthly'
        AND $2 BETWEEN co.occurrence_date AND co.period_end_date
        GROUP BY ca.user_id, u.username
      `, [workspace.id, today]);

      const isLastDay = dayOfMonth === lastDayOfMonth;
      for (const user of pendingItems.rows) {
        await createNotification({
          userId: user.user_id,
          type: 'checklist_reminder',
          title: isLastDay ? '⚠️ Final Monthly Checklist Reminder' : 'Monthly Checklist Reminder',
          message: isLastDay 
            ? `URGENT: You have ${user.pending_count} pending monthly checklist item(s). Today is the last day to confirm!`
            : `You have ${user.pending_count} pending monthly checklist item(s). Please confirm before month end.`,
          workspaceId: workspace.id,
          actionUrl: '/checklist/today',
          broadcast: true
        });
      }
    }

    console.log('✅ Monthly reminders sent');
  } catch (err) {
    console.error('❌ Error sending monthly reminders:', err);
  }
}

/**
 * Initialize all checklist jobs
 */
function initializeChecklistJobs(scheduler) {
  // Process overdue items - run at 00:05 every day
  scheduler.scheduleJob('checklistOverdue', '5 0 * * *', processOverdueOccurrences);

  // Generate future occurrences - run at 00:10 every day
  scheduler.scheduleJob('checklistGenerate', '10 0 * * *', generateFutureOccurrences);

  // Daily reminders - run at 09:00 every day
  scheduler.scheduleJob('checklistDailyReminder', '0 9 * * *', sendDailyReminders);

  // Weekly reminders - run at 09:30 on Wednesdays
  scheduler.scheduleJob('checklistWeeklyReminder', '30 9 * * 3', sendWeeklyReminders);

  // Monthly reminders - run at 10:00 on 25th and last day
  scheduler.scheduleJob('checklistMonthlyReminder', '0 10 25 * *', sendMonthlyReminders);
  scheduler.scheduleJob('checklistMonthlyFinalReminder', '0 10 28-31 * *', async () => {
    // Check if today is actually the last day of the month
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    if (today.getDate() === lastDay) {
      await sendMonthlyReminders();
    }
  });

  console.log('✅ Checklist background jobs initialized');
}

module.exports = {
  processOverdueOccurrences,
  generateFutureOccurrences,
  sendDailyReminders,
  sendWeeklyReminders,
  sendMonthlyReminders,
  initializeChecklistJobs
};
