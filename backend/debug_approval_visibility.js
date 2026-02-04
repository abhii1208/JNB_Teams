const { pool } = require('./db');

async function debugApprovalVisibility() {
  try {
    console.log('🔍 Debugging approval visibility...');
    
    // Get test data
    const users = await pool.query('SELECT id, username, first_name FROM users LIMIT 3');
    const projects = await pool.query('SELECT id, name, approval_tagged_member_id FROM projects WHERE approval_tagged_member_id IS NOT NULL LIMIT 1');
    
    if (users.rows.length === 0 || projects.rows.length === 0) {
      console.log('❌ Need users and projects with tagged approvers');
      return;
    }
    
    const testUser = users.rows[1]; // Use second user
    const project = projects.rows[0];
    
    console.log(`👤 Testing user: ${testUser.first_name} (ID: ${testUser.id})`);
    console.log(`📂 Project: ${project.name} (ID: ${project.id})`);
    console.log(`🏷️  Tagged approver: ${project.approval_tagged_member_id}`);
    
    // Check what the full query returns
    const result = await pool.query(`
      SELECT a.*,
        u.first_name || ' ' || u.last_name as requester_name,
        u.username as requester_username,
        reviewer.first_name || ' ' || reviewer.last_name as reviewer_name,
        p.name as project_name,
        t.name as task_name,
        p.created_by AS project_owner,
        p.admins_can_approve,
        p.only_owner_approves,
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
      JOIN users u ON a.requester_id = u.id
      LEFT JOIN users reviewer ON a.reviewed_by = reviewer.id
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN tasks t ON a.task_id = t.id
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE (a.requester_id = $1 OR (p.created_by = $1 OR ((pm.role = 'Admin' OR pm.role = 'Owner') AND COALESCE(p.only_owner_approves, false) = false AND COALESCE(p.admins_can_approve, true) = true) OR p.approval_tagged_member_id = $1))
      LIMIT 5
    `, [testUser.id]);
    
    console.log(`📋 Found ${result.rows.length} approvals for user ${testUser.id}:`);
    result.rows.forEach(approval => {
      console.log(`  - Approval ${approval.id}: ${approval.task_name || 'No task name'}`);
      console.log(`    Status: ${approval.status}`);
      console.log(`    Can Review: ${approval.can_review}`);
      console.log(`    Tagged Member: ${approval.approval_tagged_member_id}`);
      console.log(`    Task Assignee: ${approval.task_assignee_id}`);
      console.log(`    Project Owner: ${approval.project_owner}`);
      console.log(`    User Project Role: ${approval.user_project_role}`);
      console.log(`    ---`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

debugApprovalVisibility().finally(() => process.exit(0));