const { pool } = require('../db');
const { DateTime } = require('luxon');
const { isOccurrence, computeNextOccurrence } = require('../services/recurrenceEngine');

async function checkSeries() {
    try {
        // Get ALL active series with task counts
        const allSeries = await pool.query(`
            SELECT s.id, s.title, s.prevent_future, 
                   COUNT(t.id)::int as task_count
            FROM recurring_series s
            LEFT JOIN tasks t ON t.series_id = s.id AND t.deleted_at IS NULL
            WHERE s.deleted_at IS NULL
            GROUP BY s.id, s.title, s.prevent_future
            ORDER BY s.id DESC
        `);
        
        console.log('=== All Series Task Counts ===');
        for (const s of allSeries.rows) {
            const flag = s.task_count === 0 ? ' <<< ZERO TASKS!' : '';
            console.log(`  #${s.id}: ${s.title} - ${s.task_count} tasks (prevent_future: ${s.prevent_future})${flag}`);
        }
        console.log('');
        
        // Get most recent series
        const result = await pool.query(`
            SELECT id, title, start_date, end_date, recurrence_rule, timezone, generation_mode, prevent_future, generate_past
            FROM recurring_series 
            WHERE deleted_at IS NULL
            ORDER BY id DESC LIMIT 5
        `);
        
        console.log('=== Recent Series ===\n');
        for (const s of result.rows) {
            console.log(`Series #${s.id}: ${s.title}`);
            console.log(`  Start Date: ${s.start_date}`);
            console.log(`  End Date: ${s.end_date || 'None'}`);
            console.log(`  Rule:`, JSON.stringify(s.recurrence_rule));
            console.log(`  Timezone: ${s.timezone}`);
            console.log(`  Generation Mode: ${s.generation_mode}`);
            console.log(`  Prevent Future: ${s.prevent_future}`);
            console.log(`  Generate Past: ${s.generate_past}`);
            
            // Check today's date
            const tz = s.timezone || 'UTC';
            const today = DateTime.now().setZone(tz).toISODate();
            const startDate = s.start_date?.toISOString?.()?.split('T')[0] || s.start_date?.split?.('T')[0] || s.start_date;
            const rule = typeof s.recurrence_rule === 'string' ? JSON.parse(s.recurrence_rule) : s.recurrence_rule;
            
            console.log(`  Today (${tz}): ${today}`);
            console.log(`  Start Date (parsed): ${startDate}`);
            console.log(`  Today >= Start: ${today >= startDate}`);
            
            // Check if today matches
            const matches = isOccurrence(rule, today, tz, startDate);
            console.log(`  isOccurrence(today): ${matches}`);
            
            // Check next occurrence
            const next = computeNextOccurrence(rule, today, tz, startDate);
            console.log(`  Next occurrence after today: ${next}`);
            
            // Check existing tasks
            const tasks = await pool.query(
                'SELECT id, occurrence_date FROM tasks WHERE series_id = $1 AND deleted_at IS NULL ORDER BY occurrence_date DESC LIMIT 5',
                [s.id]
            );
            console.log(`  Tasks: ${tasks.rows.length} found`);
            if (tasks.rows.length > 0) {
                console.log(`  Latest: ${tasks.rows.map(t => t.occurrence_date).join(', ')}`);
            }
            console.log('');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkSeries();
