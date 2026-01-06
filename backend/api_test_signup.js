const fetch = global.fetch || require('node-fetch');
const { pool } = require('./db');

async function signup() {
  const body = {
    email: 'test.user+autocreate@example.com',
    username: 'testautouser',
    password: 'password123',
    first_name: 'Test',
    last_name: 'User'
  };

  try {
    const res = await fetch('http://localhost:5000/api/complete-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(()=>null);
    console.log('signup status', res.status, 'body', data);

    // query DB
    const u = await pool.query("SELECT id, username, email FROM users WHERE username = 'testautouser'");
    console.log('user rows:', u.rows);
    if (u.rows.length) {
      const uid = u.rows[0].id;
      const ws = await pool.query('SELECT * FROM workspaces WHERE created_by = $1', [uid]);
      console.log('workspaces by created_by:', ws.rows);
      const wm = await pool.query('SELECT * FROM workspace_members WHERE user_id = $1', [uid]);
      console.log('workspace_members:', wm.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

signup();
