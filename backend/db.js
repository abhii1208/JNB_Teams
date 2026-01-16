const { Pool, types } = require('pg');
require('dotenv').config();

// Ensure DATE columns are returned as YYYY-MM-DD strings to avoid timezone shifts.
types.setTypeParser(1082, (value) => value);

const toBool = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
const connectionString = process.env.DATABASE_URL;
const useSsl = toBool(process.env.DB_SSL) || String(process.env.PGSSLMODE || '').toLowerCase() === 'require';

const poolConfig = connectionString
  ? { connectionString }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'team_app',
  };

if (useSsl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

module.exports = { pool };
