/**
 * Seed Recurring Demo Data
 * Creates sample recurring series for development/testing
 * 
 * Usage: node seed-recurring-data.js
 */

require('dotenv').config();
const { pool } = require('../db');

const sampleRecurringSeries = [
    {
        title: 'Daily Standup',
        description: 'Quick sync meeting every weekday morning',
        recurrence_rule: {
            freq: 'WEEKLY',
            interval: 1,
            byday: ['MO', 'TU', 'WE', 'TH', 'FR']
        },
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timezone: 'Asia/Kolkata',
        lead_days: 1,
        assignment_strategy: 'static',
        requires_approval: false
    },
    {
        title: 'Weekly Team Meeting',
        description: 'Full team sync every Monday at 2 PM',
        recurrence_rule: {
            freq: 'WEEKLY',
            interval: 1,
            byday: ['MO']
        },
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timezone: 'Asia/Kolkata',
        lead_days: 3,
        assignment_strategy: 'static',
        requires_approval: false
    },
    {
        title: 'Monthly Report Submission',
        description: 'Submit monthly progress report on the 1st of each month',
        recurrence_rule: {
            freq: 'MONTHLY',
            interval: 1,
            bymonthday: [1]
        },
        rule_summary: 'Monthly on the 1st at 10:00 AM',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timezone: 'Asia/Kolkata',
        lead_days: 5,
        assignment_strategy: 'static',
        requires_approval: true,
        auto_close_after_days: 5
    },
    {
        title: 'Bi-weekly Code Review',
        description: 'Code review session every other Friday',
        recurrence_rule: {
            freq: 'WEEKLY',
            interval: 2,
            byday: ['FR']
        },
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timezone: 'Asia/Kolkata',
        lead_days: 2,
        assignment_strategy: 'static'
    },
    {
        title: 'Quarterly Planning',
        description: 'Quarterly planning and OKR setting',
        recurrence_rule: {
            freq: 'MONTHLY',
            interval: 3,
            bymonthday: [15]
        },
        start_date: new Date().toISOString().split('T')[0],
        end_date: (() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 2);
            return d.toISOString().split('T')[0];
        })(),
        timezone: 'Asia/Kolkata',
        lead_days: 7,
        assignment_strategy: 'static',
        requires_approval: true
    },
    {
        title: 'Security Audit Check',
        description: 'Weekly security audit and vulnerability check',
        recurrence_rule: {
            freq: 'WEEKLY',
            interval: 1,
            byday: ['WE']
        },
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timezone: 'Asia/Kolkata',
        lead_days: 2,
        assignment_strategy: 'round_robin'
    }
];

async function seedRecurringData() {
    console.log('🌱 Seeding recurring demo data for jnbtest@jnb.com...\n');

    try {
        // Get user by email (test user)
        const userResult = await pool.query(
            `SELECT id, first_name, last_name FROM users WHERE email = $1`,
            ['jnbtest@jnb.com']
        );

        if (userResult.rows.length === 0) {
            console.log('❌ User jnbtest@jnb.com not found. Please create the user first.');
            return;
        }

        const userId = userResult.rows[0].id;
        console.log(`👤 Using user: ${userResult.rows[0].first_name} ${userResult.rows[0].last_name} (ID: ${userId})`);

        // Get workspace for this user
        const workspaceResult = await pool.query(
            `SELECT w.id, w.name FROM workspaces w
             JOIN workspace_members wm ON w.id = wm.workspace_id
             WHERE wm.user_id = $1
             LIMIT 1`,
            [userId]
        );

        if (workspaceResult.rows.length === 0) {
            console.log('❌ No workspace found for user. Please create a workspace first.');
            return;
        }

        const workspaceId = workspaceResult.rows[0].id;
        console.log(`📦 Using workspace: ${workspaceResult.rows[0].name} (ID: ${workspaceId})`);
        console.log('');

        // Get optional project
        const projectResult = await pool.query('SELECT id, name FROM projects WHERE workspace_id = $1 LIMIT 1', [workspaceId]);
        const projectId = projectResult.rows[0]?.id || null;

        if (projectId) {
            console.log(`📁 Using project: ${projectResult.rows[0].name} (ID: ${projectId})`);
        }

        // Delete existing series for clean run
        await pool.query(
            `DELETE FROM recurring_series WHERE workspace_id = $1 AND created_by = $2`,
            [workspaceId, userId]
        );
        console.log('🧹 Cleaned up existing series\n');

        // Insert series
        let insertedCount = 0;
        for (const series of sampleRecurringSeries) {
            const result = await pool.query(`
                INSERT INTO recurring_series (
                    workspace_id,
                    project_id,
                    title,
                    description,
                    recurrence_rule,
                    start_date,
                    end_date,
                    timezone,
                    max_future_instances,
                    assignment_strategy,
                    static_assignee_id,
                    requires_approval,
                    auto_close_after_days,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id
            `, [
                workspaceId,
                projectId,
                series.title,
                series.description,
                JSON.stringify(series.recurrence_rule),
                series.start_date,
                series.end_date || null,
                series.timezone,
                series.lead_days || 10, // max_future_instances
                series.assignment_strategy,
                userId,
                series.requires_approval || false,
                series.auto_close_after_days || null,
                userId
            ]);

            console.log(`✅ Created: ${series.title} (ID: ${result.rows[0].id})`);
            insertedCount++;
        }

        console.log('');
        console.log(`🎉 Successfully created ${insertedCount} recurring series!`);

        // Add some sample exceptions to the first series
        const firstSeriesResult = await pool.query('SELECT id FROM recurring_series LIMIT 1');
        if (firstSeriesResult.rows[0]) {
            const seriesId = firstSeriesResult.rows[0].id;
            
            // Add a skip exception for next week
            const skipDate = new Date();
            skipDate.setDate(skipDate.getDate() + 7);
            
            await pool.query(`
                INSERT INTO recurrence_exceptions (series_id, original_date, exception_type, reason, created_by)
                VALUES ($1, $2, 'skip', 'Company Holiday', $3)
                ON CONFLICT DO NOTHING
            `, [seriesId, skipDate.toISOString().split('T')[0], userId]);

            console.log(`📅 Added sample exception to series ${seriesId}`);
        }

    } catch (err) {
        console.error('❌ Error seeding data:', err.message);
        throw err;
    } finally {
        await pool.end();
    }
}

// Run
seedRecurringData()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n💥 Seeding failed:', err);
        process.exit(1);
    });
