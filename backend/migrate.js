const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`Applied migration: ${file}`);
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migration failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { runMigrations };
