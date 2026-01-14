const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.lwtyyqfagwdsebbdwiny:8143772362S%40i@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const tasksColumns = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name LIKE '%series%'
    `);
    
    console.log('\n=== tasks table series columns ===');
    if (tasksColumns.rows.length > 0) {
      tasksColumns.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type} (${row.udt_name})`);
      });
    } else {
      console.log('No series columns found in tasks table');
    }
    
    // Check recurrence_exceptions table
    const exceptionsColumns = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'recurrence_exceptions' OR table_name = 'recurring_exceptions'
    `);
    
    console.log('\n=== recurrence/recurring_exceptions table ===');
    if (exceptionsColumns.rows.length > 0) {
      console.log('Table exists!');
      exceptionsColumns.rows.forEach(row => {
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
