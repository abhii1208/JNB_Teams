const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.lwtyyqfagwdsebbdwiny:8143772362S%40i@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'recurring_series' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== recurring_series Schema ===');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (${row.udt_name})`);
    });
    
    // Also check tasks table
    const tasksResult = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'recurring_series_id'
    `);
    
    console.log('\n=== tasks.recurring_series_id ===');
    if (tasksResult.rows.length > 0) {
      console.log(`${tasksResult.rows[0].column_name}: ${tasksResult.rows[0].data_type} (${tasksResult.rows[0].udt_name})`);
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();
