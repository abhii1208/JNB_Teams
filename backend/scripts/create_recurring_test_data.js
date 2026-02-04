/**
 * Test Recurring Module V2
 * Creates test recurring tasks with user test001@jnb.com
 */
require('dotenv').config();
const { Pool } = require('pg');

// Create a separate pool for this script
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function createTestData() {
    try {
        // First get the user
        const userRes = await pool.query(
            "SELECT id, first_name, last_name FROM users WHERE email = 'test001@jnb.com' OR phone = '8143772362'"
        );
        
        if (userRes.rows.length === 0) {
            console.log('❌ Test user not found. Creating...');
            // Create test user if not exists
            const newUser = await pool.query(`
                INSERT INTO users (email, phone, first_name, last_name, password_hash)
                VALUES ('test001@jnb.com', '8143772362', 'Test', 'User', 'placeholder')
                ON CONFLICT (email) DO UPDATE SET phone = '8143772362'
                RETURNING id, first_name, last_name
            `);
            console.log('✅ Created test user:', newUser.rows[0]);
        }
        
        const user = userRes.rows[0] || (await pool.query("SELECT id FROM users WHERE email = 'test001@jnb.com'")).rows[0];
        console.log('👤 Using user:', user);
        
        // Get a workspace for this user
        const wsRes = await pool.query(`
            SELECT w.id, w.name FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = $1
            LIMIT 1
        `, [user.id]);
        
        if (wsRes.rows.length === 0) {
            console.log('❌ No workspace found for user');
            return;
        }
        
        const workspace = wsRes.rows[0];
        console.log('🏢 Using workspace:', workspace);
        
        // Get a project in this workspace
        const projRes = await pool.query(
            'SELECT id, name FROM projects WHERE workspace_id = $1 LIMIT 1',
            [workspace.id]
        );
        
        if (projRes.rows.length === 0) {
            console.log('❌ No project found. Creating...');
            const newProj = await pool.query(`
                INSERT INTO projects (name, workspace_id, created_by)
                VALUES ('Test Project', $1, $2)
                RETURNING id, name
            `, [workspace.id, user.id]);
            console.log('✅ Created project:', newProj.rows[0]);
        }
        
        const project = projRes.rows[0] || (await pool.query('SELECT id, name FROM projects WHERE workspace_id = $1 LIMIT 1', [workspace.id])).rows[0];
        console.log('📁 Using project:', project);
        
        // Check existing recurring tasks
        const existingRes = await pool.query(
            'SELECT COUNT(*) as count FROM recurring_tasks WHERE workspace_id = $1',
            [workspace.id]
        );
        console.log('📋 Existing recurring tasks:', existingRes.rows[0].count);
        
        // Create test recurring tasks
        console.log('\n🔄 Creating test recurring tasks...\n');
        
        // 1. Daily task
        const daily = await pool.query(`
            INSERT INTO recurring_tasks (
                workspace_id, project_id, created_by, name, description,
                priority, assignee_id, frequency, interval_value, start_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [
            workspace.id, project.id, user.id,
            'Daily Standup Notes', 'Record daily standup meeting notes',
            'Medium', user.id, 'daily', 1
        ]);
        if (daily.rows.length > 0) {
            console.log('✅ Created: Daily Standup Notes');
        }
        
        // 2. Weekly task (Mon, Wed, Fri)
        const weekly = await pool.query(`
            INSERT INTO recurring_tasks (
                workspace_id, project_id, created_by, name, description,
                priority, assignee_id, frequency, interval_value, week_days, start_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [
            workspace.id, project.id, user.id,
            'Code Review Session', 'Review team code submissions',
            'High', user.id, 'weekly', 1, [1, 3, 5]  // Mon, Wed, Fri
        ]);
        if (weekly.rows.length > 0) {
            console.log('✅ Created: Code Review Session (Mon/Wed/Fri)');
        }
        
        // 3. Monthly task (15th of each month)
        const monthly = await pool.query(`
            INSERT INTO recurring_tasks (
                workspace_id, project_id, created_by, name, description,
                priority, assignee_id, frequency, interval_value, month_day, start_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [
            workspace.id, project.id, user.id,
            'Monthly Report Submission', 'Submit monthly progress report',
            'Critical', user.id, 'monthly', 1, 15
        ]);
        if (monthly.rows.length > 0) {
            console.log('✅ Created: Monthly Report (15th)');
        }
        
        // 4. Monthly task (Last day)
        const monthlyLast = await pool.query(`
            INSERT INTO recurring_tasks (
                workspace_id, project_id, created_by, name, description,
                priority, assignee_id, frequency, interval_value, month_day, start_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [
            workspace.id, project.id, user.id,
            'End of Month Backup', 'Verify all backups are complete',
            'High', user.id, 'monthly', 1, -1  // Last day
        ]);
        if (monthlyLast.rows.length > 0) {
            console.log('✅ Created: End of Month Backup (Last day)');
        }
        
        // Final count
        const finalRes = await pool.query(
            'SELECT id, name, frequency, week_days, month_day, is_active FROM recurring_tasks WHERE workspace_id = $1',
            [workspace.id]
        );
        
        console.log('\n📊 All Recurring Tasks:');
        finalRes.rows.forEach(r => {
            let pattern = r.frequency;
            if (r.week_days) pattern += ` [${r.week_days.join(',')}]`;
            if (r.month_day) pattern += ` (day ${r.month_day})`;
            console.log(`   #${r.id}: ${r.name} - ${pattern} - ${r.is_active ? 'Active' : 'Paused'}`);
        });
        
        console.log('\n✅ Test data creation complete!');
        console.log('   Login with: test001@jnb.com or 8143772362');
        
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

createTestData();
