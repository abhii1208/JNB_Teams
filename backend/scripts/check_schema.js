const { pool } = require('../db');

async function checkSchema() {
  const r = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'checklist_occurrences' 
    ORDER BY ordinal_position
  `);
  console.log('Columns:', r.rows.map(row => row.column_name));
  pool.end();
}

checkSchema().catch(console.error);
