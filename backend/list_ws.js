const { pool } = require('./db');
(async () => {
  try {
    const ws = await pool.query('SELECT * FROM workspaces ORDER BY id DESC LIMIT 50');
    console.log('workspaces:', ws.rows);
    const wm = await pool.query('SELECT * FROM workspace_members ORDER BY id DESC LIMIT 50');
    console.log('workspace_members:', wm.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
