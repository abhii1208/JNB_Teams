const { pool } = require('../db');

async function fixSeries() {
    try {
        // Update all series to prevent_future=false
        const result = await pool.query(`
            UPDATE recurring_series 
            SET prevent_future = false 
            WHERE prevent_future = true 
            AND deleted_at IS NULL
        `);
        console.log('Updated', result.rowCount, 'series to prevent_future=false');
        
        // Also delete the old instances for the series you just created (15-Jan-2025)
        const deleteOld = await pool.query(`
            DELETE FROM tasks 
            WHERE occurrence_date < '2026-01-01' 
            AND series_id IS NOT NULL
            AND deleted_at IS NULL
            RETURNING id, occurrence_date
        `);
        console.log('Deleted', deleteOld.rowCount, 'old task instances:');
        deleteOld.rows.forEach(r => console.log('  - Task', r.id, 'date:', r.occurrence_date));
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

fixSeries();
