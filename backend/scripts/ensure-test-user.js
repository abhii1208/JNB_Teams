require('dotenv').config();
const { pool } = require('../db');
const bcrypt = require('bcrypt');

async function ensureTestUser() {
  try {
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE email = $1',
      ['test001@jnb.com']
    );
    
    if (userCheck.rows.length > 0) {
      console.log('✓ User already exists:', userCheck.rows[0]);
      
      // Update password
      const hash = await bcrypt.hash('8143772362', 10);
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [hash, 'test001@jnb.com']
      );
      console.log('✓ Password updated');
    } else {
      console.log('Creating new user...');
      const hash = await bcrypt.hash('8143772362', 10);
      
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, username)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, first_name, last_name`,
        ['test001@jnb.com', hash, 'Test', 'User', 'test001']
      );
      
      console.log('✓ User created:', result.rows[0]);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

ensureTestUser();
