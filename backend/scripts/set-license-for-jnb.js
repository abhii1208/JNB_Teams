const { pool } = require('../db');

async function run() {
  try {
    const res = await pool.query(
      "UPDATE users SET license_type = 'licensed_admin' WHERE LOWER(email) = LOWER($1) RETURNING id, email, license_type",
      ['JNBtest@JNB.com']
    );
    console.log('updated:', res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();
