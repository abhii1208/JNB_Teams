/**
 * Find user workspaces
 */
const { pool } = require('../db');

async function findUserWorkspaces() {
  try {
    // Find user and their workspaces
    const userResult = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, 
             wm.workspace_id, wm.role, w.name as workspace_name 
      FROM users u 
      JOIN workspace_members wm ON u.id = wm.user_id 
      JOIN workspaces w ON wm.workspace_id = w.id 
      WHERE u.email = 'test001@jnb.com'
    `);
    
    console.log('User workspaces:');
    console.log(userResult.rows);
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      // Get all workspaces where user is Owner or Admin
      const adminWorkspaces = userResult.rows.filter(r => r.role === 'Owner' || r.role === 'Admin');
      console.log('\nAdmin/Owner workspaces:');
      console.log(adminWorkspaces);
      
      // Find a testing workspace
      const testingWs = userResult.rows.find(r => 
        r.workspace_name.toLowerCase().includes('test') || 
        r.workspace_name.toLowerCase().includes('live')
      );
      
      if (testingWs) {
        console.log('\nTesting workspace found:');
        console.log(testingWs);
      }
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

findUserWorkspaces();
