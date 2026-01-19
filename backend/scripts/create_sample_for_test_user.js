/**
 * Script to create sample recurring series for the test user
 * Run: node scripts/create_sample_for_test_user.js
 */

const { pool } = require('../db');

async function createSampleData() {
    console.log('🚀 Finding test user...\n');

    // Find the user test001@jnb.com and their workspace
    const userResult = await pool.query(`
        SELECT u.id as user_id, u.email, wm.workspace_id 
        FROM users u 
        JOIN workspace_members wm ON u.id = wm.user_id 
        WHERE u.email = 'test001@jnb.com'
    `);

    if (userResult.rows.length === 0) {
        console.error('❌ User test001@jnb.com not found!');
        process.exit(1);
    }

    const { user_id, workspace_id } = userResult.rows[0];
    console.log(`📁 Found User ID: ${user_id}, Workspace ID: ${workspace_id}\n`);

    // Delete existing sample series for this workspace to avoid duplicates
    await pool.query(`
        DELETE FROM recurring_series 
        WHERE workspace_id = $1 
        AND title IN (
            'Daily Stand-up Meeting Notes',
            'Daily Server Health Check',
            'Weekly Team Sync',
            'Weekly Code Review Session',
            'Bi-weekly Sprint Planning',
            'Monthly Financial Report',
            'Monthly Security Audit',
            'Last Friday of Month - Team Retrospective',
            'Quarterly Business Review',
            'Annual Performance Review',
            'Annual License Renewal',
            'Database Backup Verification',
            'Client Status Call - Acme Corp'
        )
    `, [workspace_id]);
    console.log('🗑️ Cleaned up old sample data\n');

    // Sample data configurations - End date is Jan 31, 2026
    const endDate = '2026-01-31';
    
    const sampleSeries = [
        // ========== DAILY TASKS ==========
        {
            title: 'Daily Stand-up Meeting Notes',
            description: 'Record notes from daily stand-up meetings. Review what was done yesterday, plans for today, and blockers.',
            category: 'daily',
            color: '#10b981',
            recurrence_rule: { freq: 'DAILY', interval: 1 },
            start_date: '2026-01-01',
            end_date: endDate,
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
            end_date: endDate,
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
            start_date: '2026-01-06',
            end_date: endDate,
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
            start_date: '2026-01-03',
            end_date: endDate,
            generation_mode: 'manual',
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
            end_date: endDate,
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
            start_date: '2026-01-01',
            end_date: endDate,
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
            start_date: '2026-01-15',
            end_date: endDate,
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
            start_date: '2026-01-01',
            end_date: endDate,
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
            start_date: '2026-01-01',
            end_date: endDate,
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
            recurrence_rule: { freq: 'YEARLY', interval: 1, bymonth: [1], bymonthday: [15] },
            start_date: '2026-01-15',
            end_date: endDate,
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
            recurrence_rule: { freq: 'YEARLY', interval: 1, bymonth: [1], bymonthday: [10] },
            start_date: '2026-01-10',
            end_date: endDate,
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
            end_date: endDate,
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
            end_date: endDate,
            generation_mode: 'auto',
            generate_past: true,
            prevent_future: true,
            template: { priority: 'High', stage: 'Planned' }
        }
    ];

    console.log('📝 Creating sample recurring series...\n');

    let created = 0;
    let errors = 0;

    for (const series of sampleSeries) {
        try {
            const result = await pool.query(`
                INSERT INTO recurring_series (
                    workspace_id, title, description, template,
                    recurrence_rule, timezone, start_date, end_date,
                    generation_mode, generate_past, prevent_future,
                    category, color, created_by, assignment_strategy
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id, title
            `, [
                workspace_id,
                series.title,
                series.description,
                JSON.stringify(series.template),
                JSON.stringify(series.recurrence_rule),
                'Asia/Kolkata',
                series.start_date,
                series.end_date,
                series.generation_mode,
                series.generate_past,
                series.prevent_future,
                series.category,
                series.color,
                user_id,
                'static'
            ]);

            console.log(`✅ Created: ${series.title} (ID: ${result.rows[0].id})`);
            console.log(`   Category: ${series.category}, Mode: ${series.generation_mode}`);
            console.log(`   Start: ${series.start_date}, End: ${series.end_date}\n`);
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
    console.log(`   📅 End Date: ${endDate}`);
    console.log('='.repeat(50));

    // Now generate instances for auto-mode series
    console.log('\n🔄 Generating instances for auto-mode series...\n');
    
    const { generateInstancesForSeries } = require('../services/instanceGenerator');
    
    const autoSeries = await pool.query(`
        SELECT id, title FROM recurring_series 
        WHERE workspace_id = $1 AND generation_mode = 'auto' AND deleted_at IS NULL
    `, [workspace_id]);

    let totalGenerated = 0;
    for (const s of autoSeries.rows) {
        try {
            const result = await generateInstancesForSeries(s.id, {
                forceBackfill: true,
                preventFuture: true,
                maxInstances: 31
            });
            console.log(`   ${s.title}: Generated ${result.generated} instances`);
            totalGenerated += result.generated;
        } catch (err) {
            console.error(`   Error for ${s.title}: ${err.message}`);
        }
    }

    console.log(`\n✅ Total instances generated: ${totalGenerated}`);
    console.log('\n🎉 Done! Login with test001@jnb.com to see the data.');
}

createSampleData()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Script error:', err);
        process.exit(1);
    });
