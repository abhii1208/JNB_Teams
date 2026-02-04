const { pool } = require('../db');

async function checkMigration() {
    try {
        // Check columns
        const colResult = await pool.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'recurring_series' 
            AND column_name IN ('prevent_future', 'look_ahead_days', 'last_generation_error', 'generation_retry_count', 'next_retry_at')
            ORDER BY column_name
        `);
        
        console.log('\n=== Database Columns ===');
        colResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
        });

        // Check indexes
        const idxResult = await pool.query(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'tasks' AND indexname LIKE '%occurrence%'
        `);
        
        console.log('\n=== Task Indexes ===');
        idxResult.rows.forEach(row => {
            console.log(`  ${row.indexname}`);
        });

        // Check existing series prevent_future values
        const seriesResult = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE prevent_future = true) as prevent_true,
                COUNT(*) FILTER (WHERE prevent_future = false) as prevent_false,
                COUNT(*) FILTER (WHERE prevent_future IS NULL) as prevent_null
            FROM recurring_series
            WHERE deleted_at IS NULL
        `);
        
        console.log('\n=== Series prevent_future Status ===');
        console.log(`  prevent_future=true: ${seriesResult.rows[0].prevent_true}`);
        console.log(`  prevent_future=false: ${seriesResult.rows[0].prevent_false}`);
        console.log(`  prevent_future=NULL: ${seriesResult.rows[0].prevent_null}`);

        // Check if cleanup function exists
        const funcResult = await pool.query(`
            SELECT routine_name FROM information_schema.routines 
            WHERE routine_name = 'cleanup_old_generation_logs'
        `);
        
        console.log('\n=== Functions ===');
        console.log(`  cleanup_old_generation_logs: ${funcResult.rows.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);

        console.log('\n✅ Migration verification complete!');
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkMigration();
