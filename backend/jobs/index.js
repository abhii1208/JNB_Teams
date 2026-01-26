/**
 * Background Jobs Manager
 * Schedules and runs recurring task generation, reminders, and cleanup
 */

const cron = require('node-cron');
const { generateAllPendingInstances } = require('../services/instanceGenerator');
const { sendPendingReminders } = require('./sendReminders');
const { autoCloseOverdueTasks } = require('./autoCloseTasks');

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
    // 1. Instance Generation (Every 15 minutes)
    // ============================================
    jobs.generateInstances = cron.schedule('*/15 * * * *', async () => {
        await runNoOverlap('generateInstances', async () => {
            console.log('[Job] Running instance generation...');
            try {
                const result = await generateAllPendingInstances({ batchSize: 50 });
                console.log(`[Job] Generation complete: ${result.totalGenerated} created, ${result.processed} series processed`);
                if (result.errors.length > 0) {
                    console.warn('[Job] Generation errors:', result.errors);
                }
            } catch (err) {
                console.error('[Job] Instance generation failed:', err);
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
    // 3. Auto-close Overdue (Daily at 2 AM)
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
    // 4. Nightly Full Generation (Daily at 3 AM)
    // ============================================
    jobs.nightlyGeneration = cron.schedule('0 3 * * *', async () => {
        await runNoOverlap('nightlyGeneration', async () => {
            console.log('[Job] Running nightly full generation...');
            try {
                const result = await generateAllPendingInstances({ batchSize: 200 });
                console.log(`[Job] Nightly generation: ${result.totalGenerated} created across ${result.processed} series`);
            } catch (err) {
                console.error('[Job] Nightly generation failed:', err);
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
        case 'generateInstances':
            return await runNoOverlap('generateInstances', async () => (
                await generateAllPendingInstances({ batchSize: 50 })
            ));
        case 'sendReminders':
            return await runNoOverlap('sendReminders', async () => (
                await sendPendingReminders()
            ));
        case 'autoClose':
            return await runNoOverlap('autoClose', async () => (
                await autoCloseOverdueTasks()
            ));
        case 'nightlyGeneration':
            return await runNoOverlap('nightlyGeneration', async () => (
                await generateAllPendingInstances({ batchSize: 200 })
            ));
        default:
            throw new Error(`Unknown job: ${jobName}`);
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
