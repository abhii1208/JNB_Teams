const { pool } = require('../db');

async function cleanupFutureTasks() {
    try {
        // Delete all future recurring tasks (they shouldn't exist)
        const result = await pool.query(`
            DELETE FROM tasks 
            WHERE series_id IS NOT NULL 
            AND occurrence_date > CURRENT_DATE 
            RETURNING id, occurrence_date
        `);
        
        console.log('Deleted', result.rowCount, 'future recurring tasks:');
        result.rows.forEach(r => console.log('  -', r.id, r.title, r.occurrence_date));
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

cleanupFutureTasks();
