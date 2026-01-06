require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../db');

const username = process.env.DEFAULT_USER_USERNAME || 'default';
const email = process.env.DEFAULT_USER_EMAIL || 'default@local.test';
const password = process.env.DEFAULT_USER_PASSWORD || 'Sai2.0';

async function run() {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  const existing = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $2',
    [normalizedEmail, normalizedUsername]
  );

  if (existing.rows.length > 0) {
    console.log('Default user already exists.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    'INSERT INTO users (email, username, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, username',
    [normalizedEmail, username.trim(), passwordHash, 'Default', 'User']
  );

  console.log(`Created default user: ${result.rows[0].username} (id ${result.rows[0].id})`);
}

run()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
