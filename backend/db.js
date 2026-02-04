const { Pool, types } = require('pg');
require('dotenv').config();

// IST timezone offset: +5:30 = +05:30
const IST_OFFSET = '+05:30';

// Ensure DATE columns are returned as YYYY-MM-DD strings to avoid timezone shifts.
types.setTypeParser(1082, (value) => value);

// Parse TIMESTAMP (1114) - timestamp without timezone
// These are stored as IST in our database, so we append the IST offset
types.setTypeParser(1114, (value) => {
  if (value === null) return null;
  // The value is in IST, so append the IST offset to make it a proper ISO string
  // This allows the frontend to correctly interpret and convert the time
  return value.replace(' ', 'T') + IST_OFFSET;
});

// Parse TIMESTAMPTZ (1184) - timestamp with timezone
// Already has timezone info, convert to ISO format
types.setTypeParser(1184, (value) => {
  if (value === null) return null;
  return new Date(value).toISOString();
});

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

// Set pool limits to prevent exhaustion
poolConfig.max = 20; // Max connections
poolConfig.idleTimeoutMillis = 30000; // 30 seconds idle timeout
poolConfig.connectionTimeoutMillis = 10000; // 10 seconds connection timeout

const pool = new Pool(poolConfig);

// Log pool errors
pool.on('error', (err, client) => {
  console.error('[Pool] Unexpected error on idle client:', err);
});

// Set timezone to IST (Asia/Kolkata) for all connections
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Kolkata'");
  console.log('[Pool] New client connected. Total:', pool.totalCount, 'Idle:', pool.idleCount, 'Waiting:', pool.waitingCount);
});

module.exports = { pool };
