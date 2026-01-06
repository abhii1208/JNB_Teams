const { pool } = require('./db');
(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ws = await client.query('INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING *', ['Personal', 5]);
    console.log('inserted workspace', ws.rows[0]);
    await client.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)', [ws.rows[0].id, 5, 'Owner']);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('error inserting workspace', e);
  } finally {
    await client.release();
    await pool.end();
  }
})();
