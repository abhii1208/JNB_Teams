const { pool } = require('./db');

async function run() {
  try {
    const u = await pool.query("SELECT id, username, email FROM users WHERE username = 'testautouser'");
    console.log('user:', JSON.stringify(u.rows, null, 2));
    if (u.rows.length === 0) return;
    const uid = u.rows[0].id;
    const ws = await pool.query('SELECT * FROM workspaces WHERE created_by = $1', [uid]);
    console.log('workspaces by created_by:', JSON.stringify(ws.rows, null, 2));
    const wm = await pool.query('SELECT * FROM workspace_members WHERE user_id = $1', [uid]);
    console.log('workspace_members:', JSON.stringify(wm.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();
