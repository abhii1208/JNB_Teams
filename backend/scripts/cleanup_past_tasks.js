// Cleanup old past recurring tasks that are still "open" status
const { pool } = require('../db');

async function cleanupPastTasks() {
  try {
    // Delete past recurring tasks that are still open (not worked on)
    const result = await pool.query(`
      DELETE FROM tasks 
      WHERE series_id IS NOT NULL 
        AND occurrence_date < CURRENT_DATE 
        AND status IN ('open', 'Open')
      RETURNING id, occurrence_date
    `);
    
    console.log(`Deleted ${result.rows.length} old past recurring tasks:`);
    result.rows.forEach(t => {
      console.log(`  - ${t.id} ${t.occurrence_date}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

cleanupPastTasks();
