/**
 * Set test password for user ID 1
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../db');

async function setTestPassword() {
    const hash = await bcrypt.hash('testpass123', 12);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = 1`, [hash]);
    console.log('Password updated to: testpass123');
    await pool.end();
}

setTestPassword();
