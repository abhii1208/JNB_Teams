const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.lwtyyqfagwdsebbdwiny:8143772362S%40i@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%exception%' AND table_schema = 'public'
    `);
    
    console.log('\n=== Exception tables ===');
    tables.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

check();
