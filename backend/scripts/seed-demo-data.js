/**
 * Seed Demo Data Script
 * Creates sample workspaces, projects, tasks, and approvals for demo user
 * Run with: node scripts/seed-demo-data.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'team_app',
});

const DEMO_EMAIL = 'JNBtest@JNB.com';

async function seedDemoData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔍 Finding demo user...');
    const userResult = await client.query(
      'SELECT id, username FROM users WHERE email = $1',
      [DEMO_EMAIL]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error(`Demo user ${DEMO_EMAIL} not found. Please register first.`);
    }
    
    const demoUser = userResult.rows[0];
    console.log(`✅ Found user: ${demoUser.username} (ID: ${demoUser.id})`);
    
    // Clean existing demo data
    console.log('🧹 Cleaning existing demo data...');
    await client.query('DELETE FROM notifications WHERE user_id = $1', [demoUser.id]);
    await client.query('DELETE FROM activity_logs WHERE workspace_id IN (SELECT id FROM workspaces WHERE created_by = $1)', [demoUser.id]);
    await client.query('DELETE FROM approvals WHERE requester_id = $1', [demoUser.id]);
    await client.query('DELETE FROM task_collaborators WHERE task_id IN (SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id JOIN workspaces w ON p.workspace_id = w.id WHERE w.created_by = $1)', [demoUser.id]);
    await client.query('DELETE FROM tasks WHERE project_id IN (SELECT p.id FROM projects p JOIN workspaces w ON p.workspace_id = w.id WHERE w.created_by = $1)', [demoUser.id]);
    await client.query('DELETE FROM project_members WHERE project_id IN (SELECT p.id FROM projects p JOIN workspaces w ON p.workspace_id = w.id WHERE w.created_by = $1)', [demoUser.id]);
    await client.query('DELETE FROM projects WHERE workspace_id IN (SELECT id FROM workspaces WHERE created_by = $1)', [demoUser.id]);
    await client.query('DELETE FROM workspace_members WHERE workspace_id IN (SELECT id FROM workspaces WHERE created_by = $1)', [demoUser.id]);
    await client.query('DELETE FROM workspaces WHERE created_by = $1', [demoUser.id]);
    console.log('✅ Cleanup complete');
    
    // Create workspaces
    console.log('\n📁 Creating workspaces...');
    const workspaces = [
      { name: 'Product Development', description: 'Main product development workspace' },
      { name: 'Marketing Campaign', description: 'Q1 2025 marketing initiatives' },
      { name: 'Customer Success', description: 'Customer onboarding and support projects' }
    ];
    
    const createdWorkspaces = [];
    for (const ws of workspaces) {
      const wsResult = await client.query(
        'INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING id, name',
        [ws.name, demoUser.id]
      );
      createdWorkspaces.push(wsResult.rows[0]);
      
      // Add owner as member
      await client.query(
        'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
        [wsResult.rows[0].id, demoUser.id, 'Owner']
      );
      
      console.log(`  ✅ Created: ${wsResult.rows[0].name}`);
    }
    
    // Create projects
    console.log('\n📊 Creating projects...');
    const projects = [
      // Product Development workspace
      { wsIndex: 0, name: 'Mobile App v2.0', description: 'Next generation mobile application', status: 'in_progress' },
      { wsIndex: 0, name: 'API Gateway Upgrade', description: 'Migrate to new API infrastructure', status: 'in_progress' },
      { wsIndex: 0, name: 'Security Audit', description: 'Annual security review and fixes', status: 'planning' },
      
      // Marketing Campaign workspace
      { wsIndex: 1, name: 'Social Media Strategy', description: 'Q1 social media content plan', status: 'in_progress' },
      { wsIndex: 1, name: 'Email Campaign', description: 'Product launch email series', status: 'in_progress' },
      
      // Customer Success workspace
      { wsIndex: 2, name: 'Onboarding Redesign', description: 'Improve new customer experience', status: 'planning' },
      { wsIndex: 2, name: 'Support Documentation', description: 'Update help center articles', status: 'in_progress' }
    ];
    
    const createdProjects = [];
    for (const proj of projects) {
      const projResult = await client.query(
        'INSERT INTO projects (workspace_id, name, description, status, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, name',
        [createdWorkspaces[proj.wsIndex].id, proj.name, proj.description, proj.status, demoUser.id]
      );
      createdProjects.push({ ...projResult.rows[0], wsIndex: proj.wsIndex });
      
      // Add creator as member
      await client.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
        [projResult.rows[0].id, demoUser.id, 'Owner']
      );
      
      console.log(`  ✅ ${proj.name}`);
    }
    
    // Create tasks
    console.log('\n✅ Creating tasks...');
    const tasks = [
      // Mobile App v2.0 (project 0)
      { projIndex: 0, name: 'Design new UI mockups', description: 'Create high-fidelity designs for all screens', status: 'Completed', priority: 'High', stage: 'Completed' },
      { projIndex: 0, name: 'Implement authentication flow', description: 'Add biometric and social login', status: 'In Progress', priority: 'High', stage: 'In-process', due_date: '2025-02-15' },
      { projIndex: 0, name: 'Setup push notifications', description: 'Configure FCM and APNs', status: 'In Progress', priority: 'Medium', stage: 'In-process', due_date: '2025-02-20' },
      { projIndex: 0, name: 'Write unit tests', description: 'Achieve 80% code coverage', status: 'Open', priority: 'Medium', stage: 'Planned', due_date: '2025-02-28' },
      { projIndex: 0, name: 'Beta testing preparation', description: 'Setup TestFlight and Play Console', status: 'Open', priority: 'Low', stage: 'Planned' },
      
      // API Gateway Upgrade (project 1)
      { projIndex: 1, name: 'Audit current API endpoints', description: 'Document all existing endpoints', status: 'Completed', priority: 'High', stage: 'Completed' },
      { projIndex: 1, name: 'Design new gateway architecture', description: 'Create technical architecture diagram', status: 'In Progress', priority: 'High', stage: 'In-process', due_date: '2025-02-10' },
      { projIndex: 1, name: 'Migrate authentication service', description: 'Move auth to new gateway', status: 'Open', priority: 'High', stage: 'Planned', due_date: '2025-02-25' },
      
      // Social Media Strategy (project 3)
      { projIndex: 3, name: 'Content calendar creation', description: 'Plan 90 days of social posts', status: 'In Progress', priority: 'High', stage: 'In-process', due_date: '2025-02-05' },
      { projIndex: 3, name: 'Create visual templates', description: 'Design branded post templates', status: 'In Progress', priority: 'Medium', stage: 'In-process' },
      { projIndex: 3, name: 'Schedule Q1 posts', description: 'Queue all February posts', status: 'Open', priority: 'High', stage: 'Planned', due_date: '2025-02-01' },
      
      // Email Campaign (project 4)
      { projIndex: 4, name: 'Write email copy', description: 'Draft 5 email sequence', status: 'Completed', priority: 'High', stage: 'Completed' },
      { projIndex: 4, name: 'Design email templates', description: 'Create responsive HTML templates', status: 'In Progress', priority: 'High', stage: 'In-process', due_date: '2025-02-08' },
      { projIndex: 4, name: 'Setup A/B tests', description: 'Configure subject line variations', status: 'Open', priority: 'Medium', stage: 'Planned' },
      
      // Support Documentation (project 6)
      { projIndex: 6, name: 'Audit existing articles', description: 'Review all help center content', status: 'In Progress', priority: 'Medium', stage: 'In-process', due_date: '2025-02-12' },
      { projIndex: 6, name: 'Create video tutorials', description: 'Record 10 how-to videos', status: 'Open', priority: 'Low', stage: 'Planned' }
    ];
    
    const createdTasks = [];
    for (const task of tasks) {
      const taskResult = await client.query(
        `INSERT INTO tasks (project_id, name, description, status, priority, stage, due_date, assignee_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name`,
        [
          createdProjects[task.projIndex].id,
          task.name,
          task.description,
          task.status,
          task.priority,
          task.stage,
          task.due_date || null,
          demoUser.id,
          demoUser.id
        ]
      );
      createdTasks.push({ ...taskResult.rows[0], projIndex: task.projIndex });
      console.log(`  ✅ ${task.name}`);
    }
    
    // Create approvals
    console.log('\n📋 Creating approval requests...');
    const approvals = [
      { 
        wsIndex: 0, 
        type: 'deployment',
        reason: 'Request approval to launch the new mobile app to production. All tests passed, beta feedback incorporated.',
        details: 'Mobile App v2.0 Go-Live Approval',
        status: 'Pending'
      },
      {
        wsIndex: 0,
        type: 'change_request',
        reason: 'Request to increase API rate limits from 1000 to 5000 requests per hour for premium customers.',
        details: 'API Rate Limit Increase',
        status: 'Pending'
      },
      {
        wsIndex: 1,
        type: 'budget',
        reason: 'Approve $50,000 budget for Q1 social media advertising campaign.',
        details: 'Marketing Budget Allocation',
        status: 'Pending'
      },
      {
        wsIndex: 1,
        type: 'content',
        reason: 'Approve press release for new strategic partnership with TechCorp.',
        details: 'Partnership Announcement',
        status: 'Approved'
      },
      {
        wsIndex: 2,
        type: 'feature',
        reason: 'Request approval to launch premium support tier with 24/7 availability.',
        details: 'New Support Tier Launch',
        status: 'Pending'
      }
    ];
    
    const createdApprovals = [];
    for (const approval of approvals) {
      const approvalResult = await client.query(
        `INSERT INTO approvals (type, requester_id, reason, details, status, project_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, details`,
        [
          approval.type,
          demoUser.id,
          approval.reason,
          approval.details,
          approval.status,
          createdProjects[approval.wsIndex * 2]?.id || null
        ]
      );
      createdApprovals.push(approvalResult.rows[0]);
      console.log(`  ✅ ${approval.details}`);
    }
    
    // Create activity logs
    console.log('\n📝 Creating activity logs...');
    const activities = [
      { wsIndex: 0, action: 'workspace_created', type: 'workspace', item_name: createdWorkspaces[0].name, details: 'Created workspace "Product Development"' },
      { wsIndex: 0, action: 'project_created', type: 'project', item_name: createdProjects[0].name, details: 'Created project "Mobile App v2.0"', project_id: createdProjects[0].id },
      { wsIndex: 0, action: 'task_created', type: 'task', item_name: createdTasks[0].name, details: 'Created task "Design new UI mockups"', task_id: createdTasks[0].id },
      { wsIndex: 0, action: 'task_status_changed', type: 'task', item_name: createdTasks[0].name, details: 'Marked "Design new UI mockups" as completed', task_id: createdTasks[0].id },
      { wsIndex: 0, action: 'approval_requested', type: 'approval', item_name: createdApprovals[0].details, details: 'Requested approval for "Mobile App v2.0 Go-Live"' },
      { wsIndex: 1, action: 'workspace_created', type: 'workspace', item_name: createdWorkspaces[1].name, details: 'Created workspace "Marketing Campaign"' },
      { wsIndex: 1, action: 'project_created', type: 'project', item_name: createdProjects[3].name, details: 'Created project "Social Media Strategy"', project_id: createdProjects[3].id },
      { wsIndex: 1, action: 'approval_approved', type: 'approval', item_name: createdApprovals[3].details, details: 'Approved "Partnership Announcement"' }
    ];
    
    for (const activity of activities) {
      await client.query(
        `INSERT INTO activity_logs (workspace_id, user_id, action, type, item_name, details, project_id, task_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          createdWorkspaces[activity.wsIndex].id,
          demoUser.id,
          activity.action,
          activity.type,
          activity.item_name,
          activity.details,
          activity.project_id || null,
          activity.task_id || null
        ]
      );
    }
    console.log(`  ✅ Created ${activities.length} activity logs`);
    
    // Create notifications
    console.log('\n🔔 Creating notifications...');
    const notifications = [
      { type: 'task_assigned', title: 'New Task Assignment', message: 'You have been assigned to "Implement authentication flow"', task_id: createdTasks[1].id, read: false },
      { type: 'task_due_soon', title: 'Task Due Soon', message: '"Content calendar creation" is due in 3 days', task_id: createdTasks[8].id, read: false },
      { type: 'approval_requested', title: 'Approval Requested', message: 'New approval request: "Mobile App v2.0 Go-Live Approval"', read: false },
      { type: 'approval_requested', title: 'Approval Requested', message: 'New approval request: "API Rate Limit Increase"', read: false },
      { type: 'approval_requested', title: 'Budget Approval', message: 'New approval request: "Marketing Budget Allocation"', read: false },
      { type: 'project_update', title: 'Project Status Update', message: 'Mobile App v2.0 is 60% complete', project_id: createdProjects[0].id, read: true }
    ];
    
    for (const notif of notifications) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, task_id, project_id, read)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          demoUser.id,
          notif.type,
          notif.title,
          notif.message,
          notif.task_id || null,
          notif.project_id || null,
          notif.read || false
        ]
      );
    }
    console.log(`  ✅ Created ${notifications.length} notifications`);
    
    await client.query('COMMIT');
    
    console.log('\n✨ Demo data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Workspaces: ${createdWorkspaces.length}`);
    console.log(`   Projects: ${createdProjects.length}`);
    console.log(`   Tasks: ${createdTasks.length}`);
    console.log(`   Approvals: ${createdApprovals.length}`);
    console.log(`   Activity Logs: ${activities.length}`);
    console.log(`   Notifications: ${notifications.length}`);
    console.log(`\n🎉 You can now login with: ${DEMO_EMAIL}\n`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding demo data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
seedDemoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
