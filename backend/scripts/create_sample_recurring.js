/**
 * Script to create sample recurring series for testing
 * Run: node scripts/create_sample_recurring.js
 * 
 * This creates sample recurring series for each category:
 * - Daily, Weekly, Monthly, Yearly
 * - With different configurations (auto/manual, past dates, future prevention)
 */

const { pool } = require('../db');

// Sample data configurations
const sampleSeries = [
    // ========== DAILY TASKS ==========
    {
        title: 'Daily Stand-up Meeting Notes',
        description: 'Record notes from daily stand-up meetings. Review what was done yesterday, plans for today, and blockers.',
        category: 'daily',
        color: '#10b981',
        recurrence_rule: { freq: 'DAILY', interval: 1 },
        start_date: '2026-01-01', // Past date to test backfill
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'Medium', stage: 'Planned' }
    },
    {
        title: 'Daily Server Health Check',
        description: 'Check server logs, disk space, and performance metrics daily.',
        category: 'daily',
        color: '#f59e0b',
        recurrence_rule: { freq: 'DAILY', interval: 1 },
        start_date: '2026-01-15',
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'High', stage: 'Planned' }
    },

    // ========== WEEKLY TASKS ==========
    {
        title: 'Weekly Team Sync',
        description: 'Weekly team synchronization meeting every Monday to discuss progress and upcoming tasks.',
        category: 'weekly',
        color: '#3b82f6',
        recurrence_rule: { freq: 'WEEKLY', interval: 1, byday: ['MO'] },
        start_date: '2026-01-06', // First Monday of 2026
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'High', stage: 'Planned' }
    },
    {
        title: 'Weekly Code Review Session',
        description: 'Review code submitted during the week. Focus on best practices and improvements.',
        category: 'weekly',
        color: '#8b5cf6',
        recurrence_rule: { freq: 'WEEKLY', interval: 1, byday: ['FR'] },
        start_date: '2026-01-03', // First Friday
        generation_mode: 'manual', // Manual - user clicks Generate Now
        generate_past: false,
        prevent_future: true,
        template: { priority: 'Medium', stage: 'Planned' }
    },
    {
        title: 'Bi-weekly Sprint Planning',
        description: 'Sprint planning session every two weeks to plan upcoming sprint tasks.',
        category: 'weekly',
        color: '#06b6d4',
        recurrence_rule: { freq: 'WEEKLY', interval: 2, byday: ['MO'] },
        start_date: '2026-01-06',
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'High', stage: 'Planned' }
    },

    // ========== MONTHLY TASKS ==========
    {
        title: 'Monthly Financial Report',
        description: 'Generate and review monthly financial reports. Submit to management by 5th of each month.',
        category: 'monthly',
        color: '#ec4899',
        recurrence_rule: { freq: 'MONTHLY', interval: 1, bymonthday: [1] },
        start_date: '2025-10-01', // Several months back to test backfill
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'Critical', stage: 'Planned' }
    },
    {
        title: 'Monthly Security Audit',
        description: 'Perform security audit and vulnerability assessment. Document findings and remediation plan.',
        category: 'monthly',
        color: '#ef4444',
        recurrence_rule: { freq: 'MONTHLY', interval: 1, bymonthday: [15] },
        start_date: '2025-11-15',
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'High', stage: 'Planned' }
    },
    {
        title: 'Last Friday of Month - Team Retrospective',
        description: 'Monthly team retrospective on the last Friday. Discuss what went well and areas for improvement.',
        category: 'monthly',
        color: '#14b8a6',
        recurrence_rule: { freq: 'MONTHLY', interval: 1, byday: ['FR'], bysetpos: -1 },
        start_date: '2025-12-01',
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'Medium', stage: 'Planned' }
    },

    // ========== QUARTERLY TASKS ==========
    {
        title: 'Quarterly Business Review',
        description: 'Comprehensive quarterly business review with stakeholders. Present KPIs and roadmap updates.',
        category: 'reports',
        color: '#a855f7',
        recurrence_rule: { freq: 'MONTHLY', interval: 3, bymonthday: [1] },
        start_date: '2025-10-01',
        generation_mode: 'manual',
        generate_past: false,
        prevent_future: true,
        template: { priority: 'Critical', stage: 'Planned' }
    },

    // ========== YEARLY TASKS ==========
    {
        title: 'Annual Performance Review',
        description: 'Annual team member performance reviews. Complete self-assessments and schedule 1-on-1s.',
        category: 'yearly',
        color: '#f97316',
        recurrence_rule: { freq: 'YEARLY', interval: 1, bymonth: [12], bymonthday: [1] },
        start_date: '2024-12-01', // Previous year to test
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'High', stage: 'Planned' }
    },
    {
        title: 'Annual License Renewal',
        description: 'Review and renew software licenses and subscriptions before expiry.',
        category: 'yearly',
        color: '#84cc16',
        recurrence_rule: { freq: 'YEARLY', interval: 1, bymonth: [1], bymonthday: [15] },
        start_date: '2025-01-15',
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'Medium', stage: 'Planned' }
    },

    // ========== MAINTENANCE TASKS ==========
    {
        title: 'Database Backup Verification',
        description: 'Weekly verification of database backups. Ensure backup integrity and test restore process.',
        category: 'maintenance',
        color: '#64748b',
        recurrence_rule: { freq: 'WEEKLY', interval: 1, byday: ['SU'] },
        start_date: '2026-01-05',
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'High', stage: 'Planned' }
    },

    // ========== MEETING TASKS ==========
    {
        title: 'Client Status Call - Acme Corp',
        description: 'Weekly status call with Acme Corp client. Prepare updates and address concerns.',
        category: 'meetings',
        color: '#0ea5e9',
        recurrence_rule: { freq: 'WEEKLY', interval: 1, byday: ['WE'] },
        start_date: '2026-01-08',
        generation_mode: 'auto',
        generate_past: true,
        prevent_future: true,
        template: { priority: 'High', stage: 'Planned' }
    }
];

async function createSampleRecurringSeries() {
    console.log('🚀 Creating sample recurring series...\n');

    // First, find a workspace and user to use
    const workspaceResult = await pool.query(`
        SELECT w.id as workspace_id, u.id as user_id 
        FROM workspaces w
        JOIN users u ON u.id = (SELECT id FROM users LIMIT 1)
        LIMIT 1
    `);

    if (workspaceResult.rows.length === 0) {
        console.error('❌ No workspace found. Please create a workspace first.');
        process.exit(1);
    }

    const { workspace_id, user_id } = workspaceResult.rows[0];
    console.log(`📁 Using workspace ID: ${workspace_id}, User ID: ${user_id}\n`);

    // Delete existing sample series (optional - uncomment to clean up first)
    // await pool.query(`DELETE FROM recurring_series WHERE title LIKE 'Daily%' OR title LIKE 'Weekly%' OR title LIKE 'Monthly%' OR title LIKE 'Quarterly%' OR title LIKE 'Annual%'`);

    let created = 0;
    let errors = 0;

    for (const series of sampleSeries) {
        try {
            const result = await pool.query(`
                INSERT INTO recurring_series (
                    workspace_id, title, description, template,
                    recurrence_rule, timezone, start_date,
                    generation_mode, generate_past, prevent_future,
                    category, color, created_by, assignment_strategy
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id, title
            `, [
                workspace_id,
                series.title,
                series.description,
                JSON.stringify(series.template),
                JSON.stringify(series.recurrence_rule),
                'Asia/Kolkata',
                series.start_date,
                series.generation_mode,
                series.generate_past,
                series.prevent_future,
                series.category,
                series.color,
                user_id,
                'static' // assignment_strategy
            ]);

            console.log(`✅ Created: ${series.title} (ID: ${result.rows[0].id})`);
            console.log(`   Category: ${series.category}, Mode: ${series.generation_mode}`);
            console.log(`   Rule: ${JSON.stringify(series.recurrence_rule)}`);
            console.log(`   Start: ${series.start_date}, Past: ${series.generate_past}, Prevent Future: ${series.prevent_future}\n`);
            created++;
        } catch (err) {
            console.error(`❌ Error creating "${series.title}": ${err.message}\n`);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Created: ${created} series`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('='.repeat(50));

    console.log('\n🎉 Done! You can now test the recurring module:');
    console.log('   1. Login to the app and navigate to Recurring Tasks');
    console.log('   2. Check series with different categories');
    console.log('   3. Test "Generate Now" for manual series');
    console.log('   4. Verify that past instances are backfilled correctly');
    console.log('   5. Confirm future instances are NOT created when prevented\n');
}

// Run the script
createSampleRecurringSeries()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Script error:', err);
        process.exit(1);
    });
