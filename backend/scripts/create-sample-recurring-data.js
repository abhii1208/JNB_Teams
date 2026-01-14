/**
 * Create Sample Recurring Series Data
 * For user: test001@jnb.com
 */

require('dotenv').config();
const { pool } = require('../db');

async function createSampleData() {
  let client;
  
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    // Get test user
    console.log('🔍 Finding test user...');
    const userResult = await client.query(
      'SELECT id, first_name, last_name FROM users WHERE email = $1',
      ['test001@jnb.com']
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('Test user not found. Please create user test001@jnb.com first.');
    }
    
    const user = userResult.rows[0];
    console.log(`✓ Found user: ${user.first_name} ${user.last_name} (ID: ${user.id})`);
    
    // Get user's workspace
    console.log('\n🔍 Finding workspace...');
    const workspaceResult = await client.query(
      `SELECT w.id, w.name 
       FROM workspaces w
       JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = $1
       LIMIT 1`,
      [user.id]
    );
    
    if (workspaceResult.rows.length === 0) {
      throw new Error('No workspace found for test user.');
    }
    
    const workspace = workspaceResult.rows[0];
    console.log(`✓ Found workspace: ${workspace.name} (ID: ${workspace.id})`);
    
    // Get or create project
    console.log('\n🔍 Finding/Creating project...');
    let projectResult = await client.query(
      'SELECT id, name FROM projects WHERE workspace_id = $1 LIMIT 1',
      [workspace.id]
    );
    
    let project;
    if (projectResult.rows.length === 0) {
      console.log('Creating new project...');
      const createResult = await client.query(
        `INSERT INTO projects (name, workspace_id, created_by, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name`,
        ['Sample Project', workspace.id, user.id, 'Project for recurring tasks']
      );
      project = createResult.rows[0];
      console.log(`✓ Created project: ${project.name} (ID: ${project.id})`);
    } else {
      project = projectResult.rows[0];
      console.log(`✓ Found project: ${project.name} (ID: ${project.id})`);
    }
    
    // Create sample recurring series
    console.log('\n📅 Creating recurring series...\n');
    
    const seriesToCreate = [
      {
        title: 'Daily Standup Meeting',
        description: 'Team daily standup - 15 minutes',
        recurrence_rule: {
          frequency: 'daily',
          interval: 1,
          byWeekday: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        },
        template: {
          priority: 'High',
          notes: 'Share updates: What you did yesterday, what you plan today, any blockers',
          estimated_hours: 0.25
        }
      },
      {
        title: 'Weekly Team Review',
        description: 'Review weekly progress and plan next week',
        recurrence_rule: {
          frequency: 'weekly',
          interval: 1,
          byWeekday: ['friday']
        },
        template: {
          priority: 'Medium',
          notes: 'Review completed tasks, discuss challenges, plan next week',
          estimated_hours: 1
        }
      },
      {
        title: 'Monthly Planning Meeting',
        description: 'Monthly strategic planning session',
        recurrence_rule: {
          frequency: 'monthly',
          interval: 1
        },
        template: {
          priority: 'High',
          notes: 'Review monthly goals, set objectives for next month',
          estimated_hours: 2
        }
      },
      {
        title: 'Bi-weekly Code Review',
        description: 'Code review and knowledge sharing session',
        recurrence_rule: {
          frequency: 'weekly',
          interval: 2,
          byWeekday: ['wednesday']
        },
        template: {
          priority: 'Medium',
          notes: 'Review PRs, share best practices, discuss technical debt',
          estimated_hours: 1.5
        }
      },
      {
        title: 'End of Sprint Retrospective',
        description: 'Sprint retrospective - every 2 weeks',
        recurrence_rule: {
          frequency: 'weekly',
          interval: 2,
          byWeekday: ['friday']
        },
        template: {
          priority: 'High',
          notes: 'What went well, what needs improvement, action items',
          estimated_hours: 1
        }
      }
    ];
    
    const createdSeries = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 1); // Start tomorrow
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 3); // End in 3 months
    const endDateStr = endDate.toISOString().split('T')[0];
    
    for (const series of seriesToCreate) {
      try {
        const result = await client.query(`
          INSERT INTO recurring_series (
            workspace_id, project_id, title, description, template,
            recurrence_rule, timezone, start_date, end_date,
            assignment_strategy, static_assignee_id, created_by,
            max_future_instances
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id, title
        `, [
          workspace.id,
          project.id,
          series.title,
          series.description,
          JSON.stringify(series.template),
          JSON.stringify(series.recurrence_rule),
          'UTC',
          startDateStr,
          endDateStr,
          'static',
          user.id,
          user.id,
          10
        ]);
        
        createdSeries.push(result.rows[0]);
        console.log(`✓ Created: ${result.rows[0].title} (ID: ${result.rows[0].id})`);
      } catch (err) {
        console.error(`✗ Failed to create "${series.title}": ${err.message}`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ Sample data created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   User: ${user.first_name} ${user.last_name}`);
    console.log(`   Workspace: ${workspace.name}`);
    console.log(`   Project: ${project.name}`);
    console.log(`   Recurring Series: ${createdSeries.length}`);
    console.log(`   Start Date: ${startDateStr}`);
    console.log(`   End Date: ${endDateStr}`);
    
    console.log('\n📋 Created Series:');
    createdSeries.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.title}`);
    });
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Login with test001@jnb.com');
    console.log('   2. Navigate to recurring module');
    console.log('   3. View the created recurring series');
    console.log('   4. Trigger instance generation if needed');
    
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

createSampleData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
