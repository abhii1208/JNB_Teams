/**
 * Background Jobs Manager
 * SIMPLIFIED: Daily task generation at 1 AM
 */

const cron = require('node-cron');
const { generateAllDailyTasks } = require('../routes/recurringV2');
const { sendPendingReminders } = require('./sendReminders');
const { autoCloseOverdueTasks } = require('./autoCloseTasks');
const approvalEscalation = require('./approvalEscalation');

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
    console.log('🕐 Initializing background jobs...');

    // ============================================
    // 1. DAILY TASK GENERATION (1:00 AM)
    // SIMPLE: Create TODAY's recurring tasks
    // ============================================
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

    // ============================================
    // 2. Reminder Sending (Every 5 minutes)
    // ============================================
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

    // ============================================
    // 5. Auto-close Overdue (Daily at 2 AM)
    // ============================================
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

    // ============================================
    // 6. Approval Escalation (Every 15 minutes)
    // ============================================
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

    // ============================================
    // 7. Generation Log Cleanup (Weekly on Sunday at 4 AM)
    // LOW PRIORITY FIX: Clean up old generation logs
    // ============================================
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

    console.log('✅ Background jobs initialized');
}

/**
 * Start all jobs
 */
function startJobs() {
    console.log('▶️ Starting background jobs...');
    Object.values(jobs).forEach(job => job.start());
    console.log('✅ All jobs started');
}

/**
 * Stop all jobs
 */
function stopJobs() {
    console.log('⏹️ Stopping background jobs...');
    Object.values(jobs).forEach(job => job.stop());
    console.log('✅ All jobs stopped');
}

/**
 * Run a specific job immediately (for testing/manual trigger)
 */
async function runJobNow(jobName) {
    console.log(`🔧 Manually triggering job: ${jobName}`);
    
    switch (jobName) {
        case 'dailyGeneration':
        case 'generateInstances':
            return await runNoOverlap('dailyGeneration', async () => (
                await generateAllPendingInstances({ batchSize: 200 })
            ));
        case 'sendReminders':
            return await runNoOverlap('sendReminders', async () => (
                await sendPendingReminders()
            ));
        case 'autoClose':
            return await runNoOverlap('autoClose', async () => (
                await autoCloseOverdueTasks()
            ));
        default:
            throw new Error(`Unknown job: ${jobName}. Available: dailyGeneration, sendReminders, autoClose`);
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
