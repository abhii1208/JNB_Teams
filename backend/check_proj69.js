const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.lwtyyqfagwdsebbdwiny:8143772362S%40i@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // Check project 69
    const projRes = await pool.query(`
      SELECT p.id, p.name, p.workspace_id, w.code_prefix, w.next_task_number
      FROM projects p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE p.id = 69
    `);
    
    console.log('Project 69:', projRes.rows[0]);
    
    if (projRes.rows.length > 0) {
      const ws_id = projRes.rows[0].workspace_id;
      // Test generate_task_code
      const codeRes = await pool.query('SELECT generate_task_code(69) as code');
      console.log('Generated task code for project 69:', codeRes.rows[0].code);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Detail:', e.detail);
  } finally {
    await pool.end();
  }
}

check();
