const { pool } = require('./db');

async function quickTagTest() {
  try {
    // Get first project and second user
    const projects = await pool.query('SELECT id, name FROM projects LIMIT 1');
    const users = await pool.query('SELECT id, username, first_name FROM users ORDER BY id LIMIT 2');
    
    if (projects.rows.length === 0 || users.rows.length < 2) {
      console.log('Need at least 1 project and 2 users');
      return;
    }
    
    const project = projects.rows[0];
    const taggedUser = users.rows[1]; // Second user
    
    // Tag the user
    await pool.query(
      'UPDATE projects SET approval_tagged_member_id = $1 WHERE id = $2',
      [taggedUser.id, project.id]
    );
    
    console.log(`✅ Tagged ${taggedUser.first_name} (ID: ${taggedUser.id}) as approver for project "${project.name}" (ID: ${project.id})`);
    console.log(`Now login as ${taggedUser.first_name} and check the Approvals section to see if approvals appear.`);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

quickTagTest().then(() => process.exit(0));