/**
 * Background Jobs Manager
 */

const cron = require('node-cron');
const { generateAllDailyTasks } = require('../routes/recurringV2');
const { sendPendingReminders } = require('./sendReminders');
const { autoCloseOverdueTasks } = require('./autoCloseTasks');
const approvalEscalation = require('./approvalEscalation');
const checklistJobs = require('./checklistJobs');

// Job registry
const jobs = {};
const runningJobs = {};

async function runNoOverlap(jobName, handler) {
    if (runningJobs[jobName]) {
        console.log(`[Job] Skipping ${jobName} (previous run still in progress)`);
        return { skipped: true };
    }

    runningJobs[jobName] = true;
    try {
        return await handler();
    } finally {
        runningJobs[jobName] = false;
    }
}

/**
 * Initialize all background jobs
 */
function initializeJobs() {
    console.log('[Job] Initializing background jobs...');

    // 1) Daily recurring generation at 1 AM
    jobs.dailyGeneration = cron.schedule('0 1 * * *', async () => {
        await runNoOverlap('dailyGeneration', async () => {
            console.log('[Job] Running 1 AM daily generation...');
            try {
                const result = await generateAllDailyTasks();
                console.log(`[Job] Daily generation complete: ${result.generated} created, ${result.skipped} skipped`);
            } catch (err) {
                console.error('[Job] Daily generation failed:', err);
            }
        });
    }, { scheduled: false });

    // 2) Reminder sending every 5 minutes
    jobs.sendReminders = cron.schedule('*/5 * * * *', async () => {
        await runNoOverlap('sendReminders', async () => {
            console.log('[Job] Checking for pending reminders...');
            try {
                const result = await sendPendingReminders();
                if (result.sent > 0) {
                    console.log(`[Job] Sent ${result.sent} reminders`);
                }
            } catch (err) {
                console.error('[Job] Reminder sending failed:', err);
            }
        });
    }, { scheduled: false });

    // 3) Auto-close overdue tasks daily at 2 AM
    jobs.autoClose = cron.schedule('0 2 * * *', async () => {
        await runNoOverlap('autoClose', async () => {
            console.log('[Job] Running auto-close for overdue tasks...');
            try {
                const result = await autoCloseOverdueTasks();
                console.log(`[Job] Auto-closed ${result.closed} overdue tasks`);
            } catch (err) {
                console.error('[Job] Auto-close failed:', err);
            }
        });
    }, { scheduled: false });

    // 4) Approval escalation every 15 minutes
    jobs.approvalEscalation = cron.schedule('*/15 * * * *', async () => {
        await runNoOverlap('approvalEscalation', async () => {
            console.log('[Job] Checking for approval escalations...');
            try {
                const result = await approvalEscalation.run();
                if (result.escalated > 0 || result.reminders > 0) {
                    console.log(`[Job] Escalation: ${result.escalated} escalated, ${result.reminders} reminders sent`);
                }
            } catch (err) {
                console.error('[Job] Approval escalation failed:', err);
            }
        });
    }, { scheduled: false });

    // 5) Generation log cleanup weekly on Sunday at 4 AM
    jobs.logCleanup = cron.schedule('0 4 * * 0', async () => {
        await runNoOverlap('logCleanup', async () => {
            console.log('[Job] Running generation log cleanup...');
            try {
                const { pool } = require('../db');
                const result = await pool.query('SELECT cleanup_old_generation_logs(30)');
                const deleted = result.rows[0]?.cleanup_old_generation_logs || 0;
                if (deleted > 0) {
                    console.log(`[Job] Cleaned up ${deleted} old generation log entries`);
                }
            } catch (err) {
                console.error('[Job] Log cleanup failed:', err);
            }
        });
    }, { scheduled: false });

    // 6) Checklist: mark overdue at 00:05
    jobs.checklistOverdue = cron.schedule('5 0 * * *', async () => {
        await runNoOverlap('checklistOverdue', async () => {
            try {
                await checklistJobs.processOverdueOccurrences();
            } catch (err) {
                console.error('[Job] Checklist overdue processing failed:', err);
            }
        });
    }, { scheduled: false });

    // 7) Checklist: generate future occurrences at 00:10
    jobs.checklistGenerate = cron.schedule('10 0 * * *', async () => {
        await runNoOverlap('checklistGenerate', async () => {
            try {
                await checklistJobs.generateFutureOccurrences();
            } catch (err) {
                console.error('[Job] Checklist generation failed:', err);
            }
        });
    }, { scheduled: false });

    // 8) Checklist reminders
    jobs.checklistDailyReminder = cron.schedule('0 9 * * *', async () => {
        await runNoOverlap('checklistDailyReminder', async () => {
            try {
                await checklistJobs.sendDailyReminders();
            } catch (err) {
                console.error('[Job] Checklist daily reminder failed:', err);
            }
        });
    }, { scheduled: false });

    jobs.checklistWeeklyReminder = cron.schedule('30 9 * * 3', async () => {
        await runNoOverlap('checklistWeeklyReminder', async () => {
            try {
                await checklistJobs.sendWeeklyReminders();
            } catch (err) {
                console.error('[Job] Checklist weekly reminder failed:', err);
            }
        });
    }, { scheduled: false });

    jobs.checklistMonthlyReminder = cron.schedule('0 10 25 * *', async () => {
        await runNoOverlap('checklistMonthlyReminder', async () => {
            try {
                await checklistJobs.sendMonthlyReminders();
            } catch (err) {
                console.error('[Job] Checklist monthly reminder failed:', err);
            }
        });
    }, { scheduled: false });

    jobs.checklistMonthlyFinalReminder = cron.schedule('0 10 28-31 * *', async () => {
        await runNoOverlap('checklistMonthlyFinalReminder', async () => {
            try {
                const today = new Date();
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                if (today.getDate() === lastDay) {
                    await checklistJobs.sendMonthlyReminders();
                }
            } catch (err) {
                console.error('[Job] Checklist month-end reminder failed:', err);
            }
        });
    }, { scheduled: false });

    console.log('[Job] Background jobs initialized');
}

/**
 * Start all jobs
 */
function startJobs() {
    console.log('[Job] Starting background jobs...');
    Object.values(jobs).forEach(job => job.start());
    console.log('[Job] All jobs started');
}

/**
 * Stop all jobs
 */
function stopJobs() {
    console.log('[Job] Stopping background jobs...');
    Object.values(jobs).forEach(job => job.stop());
    console.log('[Job] All jobs stopped');
}

/**
 * Run a specific job immediately (for testing/manual trigger)
 */
async function runJobNow(jobName) {
    console.log(`[Job] Manually triggering job: ${jobName}`);

    switch (jobName) {
        case 'dailyGeneration':
        case 'generateInstances':
            return await runNoOverlap('dailyGeneration', async () => (
                await generateAllDailyTasks()
            ));
        case 'sendReminders':
            return await runNoOverlap('sendReminders', async () => (
                await sendPendingReminders()
            ));
        case 'autoClose':
            return await runNoOverlap('autoClose', async () => (
                await autoCloseOverdueTasks()
            ));
        case 'checklistOverdue':
            return await runNoOverlap('checklistOverdue', async () => (
                await checklistJobs.processOverdueOccurrences()
            ));
        case 'checklistGenerate':
            return await runNoOverlap('checklistGenerate', async () => (
                await checklistJobs.generateFutureOccurrences()
            ));
        case 'checklistDailyReminder':
            return await runNoOverlap('checklistDailyReminder', async () => (
                await checklistJobs.sendDailyReminders()
            ));
        case 'checklistWeeklyReminder':
            return await runNoOverlap('checklistWeeklyReminder', async () => (
                await checklistJobs.sendWeeklyReminders()
            ));
        case 'checklistMonthlyReminder':
            return await runNoOverlap('checklistMonthlyReminder', async () => (
                await checklistJobs.sendMonthlyReminders()
            ));
        default:
            throw new Error('Unknown job: ' + jobName + '. Available: dailyGeneration, sendReminders, autoClose, checklistOverdue, checklistGenerate, checklistDailyReminder, checklistWeeklyReminder, checklistMonthlyReminder');
    }
}

/**
 * Get job status
 */
function getJobStatus() {
    return Object.entries(jobs).map(([name, job]) => ({
        name,
        running: job.running || false
    }));
}

module.exports = {
    initializeJobs,
    startJobs,
    stopJobs,
    runJobNow,
    getJobStatus
};
