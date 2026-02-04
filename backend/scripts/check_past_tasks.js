// Check past recurring tasks
const { pool } = require('../db');

async function checkPastTasks() {
  try {
    const result = await pool.query(`
      SELECT id, status, occurrence_date, series_id 
      FROM tasks 
      WHERE series_id IS NOT NULL 
        AND occurrence_date <= CURRENT_DATE
      ORDER BY occurrence_date
    `);
    
    console.log(`Found ${result.rows.length} recurring tasks (today and past):`);
    result.rows.forEach(t => {
      console.log(`  ID: ${t.id}, Date: ${t.occurrence_date}, Status: ${t.status}, Series: ${t.series_id}, Title: ${t.title}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPastTasks();
