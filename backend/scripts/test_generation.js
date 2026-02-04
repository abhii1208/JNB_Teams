const { pool } = require('../db');
const { DateTime } = require('luxon');
const { isOccurrence, computeNextOccurrence } = require('../services/recurrenceEngine');
const { generateInstancesForSeries } = require('../services/instanceGenerator');

async function testGeneration() {
    const seriesId = 52;  // The series with 0 tasks
    
    try {
        // Get series info first
        const result = await pool.query('SELECT * FROM recurring_series WHERE id = $1', [seriesId]);
        const series = result.rows[0];
        
        console.log('=== Series #52 Details ===');
        console.log('Title:', series.title);
        console.log('Start Date:', series.start_date);
        console.log('Rule:', JSON.stringify(series.recurrence_rule));
        console.log('Timezone:', series.timezone);
        console.log('Prevent Future:', series.prevent_future);
        console.log('Generate Past:', series.generate_past);
        console.log('');
        
        // Check today
        const tz = series.timezone || 'UTC';
        const today = DateTime.now().setZone(tz).toISODate();
        const startDate = series.start_date?.toISOString?.()?.split('T')[0] 
            || series.start_date?.split?.('T')[0] 
            || series.start_date;
        const rule = typeof series.recurrence_rule === 'string' 
            ? JSON.parse(series.recurrence_rule) 
            : series.recurrence_rule;
        
        console.log('=== Date Analysis ===');
        console.log('Today:', today);
        console.log('Start Date (parsed):', startDate);
        console.log('today >= startDate:', today >= startDate);
        console.log('');
        
        // Test isOccurrence
        const matches = isOccurrence(rule, today, tz, startDate);
        console.log('=== Recurrence Check ===');
        console.log('isOccurrence(today):', matches);
        
        const next = computeNextOccurrence(rule, today, tz, startDate);
        console.log('Next occurrence:', next);
        console.log('');
        
        // Try to generate
        console.log('=== Attempting Generation ===');
        console.log('Calling generateInstancesForSeries with todayOnly=true...');
        
        const genResult = await generateInstancesForSeries(seriesId, { todayOnly: true });
        console.log('Result:', JSON.stringify(genResult, null, 2));
        
        // Check tasks now
        const tasks = await pool.query(
            'SELECT id, occurrence_date, name FROM tasks WHERE series_id = $1 AND deleted_at IS NULL',
            [seriesId]
        );
        console.log('');
        console.log('=== Tasks After Generation ===');
        console.log('Count:', tasks.rows.length);
        tasks.rows.forEach(t => console.log(`  - ${t.id}: ${t.name} (${t.occurrence_date})`));
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

testGeneration();
