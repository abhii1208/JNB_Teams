const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.lwtyyqfagwdsebbdwiny:8143772362S%40i@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'series_audit_log'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== series_audit_log Schema ===');
    if (result.rows.length > 0) {
      result.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type} (${row.udt_name})`);
      });
    } else {
      console.log('Table does not exist');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

check();
