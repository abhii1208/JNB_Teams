const { pool } = require('./db');

async function createTestApprovalData() {
  try {
    console.log('🔍 Creating test approval data...');
    
    // Get users and project
    const users = await pool.query('SELECT id, username, first_name FROM users ORDER BY id LIMIT 3');
    const projects = await pool.query('SELECT id, name FROM projects LIMIT 1');
    
    if (users.rows.length < 2 || projects.rows.length === 0) {
      console.log('❌ Need at least 2 users and 1 project');
      return;
    }
    
    const [requester, approver] = users.rows;
    const project = projects.rows[0];
    
    console.log(`👤 Requester: ${requester.first_name} (${requester.id})`);
    console.log(`👤 Approver: ${approver.first_name} (${approver.id})`);
    console.log(`📂 Project: ${project.name} (${project.id})`);
    
    // Tag the approver for the project
    await pool.query(
      'UPDATE projects SET approval_tagged_member_id = $1 WHERE id = $2',
      [approver.id, project.id]
    );
    console.log(`✅ Tagged ${approver.first_name} as approver for project ${project.id}`);
    
    // Create a test task
    const taskResult = await pool.query(
      `INSERT INTO tasks (name, description, project_id, assignee_id, stage, status, created_by, created_at) 
       VALUES ($1, $2, $3, $4, 'Completed', 'Closed', $5, NOW()) 
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        'Test Task - Needs Approval',
        'Task completed and needs approval from tagged user',
        project.id,
        requester.id, // requester completed the task
        requester.id  // requester created the task
      ]
    );
    
    let taskId;
    if (taskResult.rows.length > 0) {
      taskId = taskResult.rows[0].id;
      console.log(`✅ Created task ${taskId}`);
    } else {
      // Find existing task
      const existingTask = await pool.query(
        'SELECT id FROM tasks WHERE project_id = $1 AND name = $2 LIMIT 1',
        [project.id, 'Test Task - Needs Approval']
      );
      if (existingTask.rows.length > 0) {
        taskId = existingTask.rows[0].id;
        console.log(`📋 Using existing task ${taskId}`);
      }
    }
    
    if (!taskId) {
      console.log('❌ Could not create or find task');
      return;
    }
    
    // Check if approval already exists
    const existingApproval = await pool.query(
      'SELECT id FROM approvals WHERE project_id = $1 AND task_id = $2',
      [project.id, taskId]
    );
    
    if (existingApproval.rows.length === 0) {
      // Create approval request
      const approvalResult = await pool.query(
        `INSERT INTO approvals (requester_id, project_id, task_id, status, type, reason, description, created_at)
         VALUES ($1, $2, $3, 'Pending', 'Task Status Change', 'Task completion approval', 'Please approve this completed task', NOW())
         RETURNING id`,
        [requester.id, project.id, taskId]
      );
      const approvalId = approvalResult.rows[0].id;
      console.log(`✅ Created approval ${approvalId}`);
    } else {
      console.log(`📋 Approval already exists: ${existingApproval.rows[0].id}`);
    }
    
    // Check what the API would return for the tagged user
    console.log(`\n🔍 Checking API response for tagged user ${approver.id}...`);
    const apiResult = await pool.query(`
      SELECT a.id, a.status,
        p.approval_tagged_member_id,
        t.assignee_id as task_assignee_id,
        pm.role as user_project_role,
        CASE
          WHEN p.created_by = $1 THEN true
          WHEN (pm.role = 'Admin' OR pm.role = 'Owner') AND COALESCE(p.only_owner_approves, false) = false AND COALESCE(p.admins_can_approve, true) = true THEN true
          WHEN p.approval_tagged_member_id = $1 AND (t.assignee_id IS NULL OR p.approval_tagged_member_id != t.assignee_id) THEN true
          ELSE false
        END as can_review
      FROM approvals a
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN tasks t ON a.task_id = t.id
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE a.project_id = $2
    `, [approver.id, project.id]);
    
    console.log(`📊 API would return ${apiResult.rows.length} approvals for user ${approver.id}:`);
    apiResult.rows.forEach(row => {
      console.log(`  - Approval ${row.id}: status=${row.status}, can_review=${row.can_review}`);
      console.log(`    tagged_member=${row.approval_tagged_member_id}, task_assignee=${row.task_assignee_id}, role=${row.user_project_role}`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

createTestApprovalData().finally(() => process.exit(0));