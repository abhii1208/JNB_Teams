require('dotenv').config();
const { pool } = require('../db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running migration to fix foreign key types...\n');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/014_fix_recurring_fk_types.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify the changes
    console.log('📊 Verifying column types:\n');
    
    const rsTypes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'recurring_series' 
      AND column_name IN ('id', 'created_by', 'static_assignee_id', 'approver_id')
      ORDER BY column_name
    `);
    
    console.log('recurring_series:');
    rsTypes.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    const arTypes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assignment_rotation' 
      AND column_name IN ('id', 'series_id', 'user_id')
      ORDER BY column_name
    `);
    
    console.log('\nassignment_rotation:');
    arTypes.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('\nDetails:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
