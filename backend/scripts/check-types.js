require('dotenv').config();
const { pool } = require('../db');

async function checkTypes() {
  try {
    // Check recurring_series foreign key types
    const rs = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'recurring_series' 
      AND column_name IN ('created_by', 'static_assignee_id', 'approver_id', 'project_id', 'workspace_id')
      ORDER BY column_name
    `);
    
    console.log('Recurring Series Foreign Keys:');
    console.log(rs.rows);
    
    // Check assignment_rotation
    const ar = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'assignment_rotation' 
      AND column_name IN ('user_id', 'series_id')
      ORDER BY column_name
    `);
    console.log('\nAssignment Rotation:');
    console.log(ar.rows);
    
    // Check users.id type
    const users = await pool.query(`
      SELECT data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id'
    `);
    console.log('\nUsers.id type:', users.rows[0]);
    
    // Check projects.id type
    const projects = await pool.query(`
      SELECT data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'id'
    `);
    console.log('Projects.id type:', projects.rows[0]);
    
    // Check workspaces.id type
    const workspaces = await pool.query(`
      SELECT data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'workspaces' AND column_name = 'id'
    `);
    console.log('Workspaces.id type:', workspaces.rows[0]);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTypes();
