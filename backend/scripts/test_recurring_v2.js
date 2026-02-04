const { pool } = require('../db');

async function test() {
    try {
        // Check table exists
        const result = await pool.query('SELECT COUNT(*) as count FROM recurring_tasks');
        console.log('✅ recurring_tasks table exists!');
        console.log('   Count:', result.rows[0].count);
        
        // Check columns
        const cols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'recurring_tasks' 
            ORDER BY ordinal_position
        `);
        console.log('\n📋 Columns:');
        cols.rows.forEach(c => console.log(`   - ${c.column_name}: ${c.data_type}`));
        
        // Check tasks table has recurring_task_id
        const hasCol = await pool.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tasks' AND column_name = 'recurring_task_id'
        `);
        console.log('\n✅ tasks.recurring_task_id column:', hasCol.rows.length > 0 ? 'EXISTS' : 'MISSING');
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

test();
