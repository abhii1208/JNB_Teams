/**
 * Script to generate instances for all auto-mode recurring series
 * Run: node scripts/generate_recurring_instances.js
 */

const { pool } = require('../db');
const { generateInstancesForSeries } = require('../services/instanceGenerator');

async function generateAllAutoSeriesInstances() {
    console.log('🚀 Generating instances for auto-mode recurring series...\n');

    // Find all auto-mode series that are not paused or deleted
    const seriesResult = await pool.query(`
        SELECT id, title, generation_mode, generate_past, prevent_future, start_date, category
        FROM recurring_series 
        WHERE deleted_at IS NULL 
        AND paused_at IS NULL 
        AND generation_mode = 'auto'
        ORDER BY id
    `);

    if (seriesResult.rows.length === 0) {
        console.log('ℹ️ No auto-mode series found to generate instances for.');
        return;
    }

    console.log(`📋 Found ${seriesResult.rows.length} auto-mode series\n`);

    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const series of seriesResult.rows) {
        console.log(`\n🔄 Processing: ${series.title} (ID: ${series.id})`);
        console.log(`   Category: ${series.category || 'none'}`);
        console.log(`   Start: ${series.start_date}, Past: ${series.generate_past}, Prevent Future: ${series.prevent_future}`);

        try {
            const result = await generateInstancesForSeries(series.id, {
                forceBackfill: series.generate_past,
                preventFuture: series.prevent_future,
                maxInstances: 10
            });

            console.log(`   ✅ Generated: ${result.generated}, Skipped: ${result.skipped}, Moved: ${result.moved}`);
            if (result.errors.length > 0) {
                console.log(`   ⚠️ Errors: ${result.errors.join(', ')}`);
            }

            totalGenerated += result.generated;
            totalSkipped += result.skipped;
            if (result.errors.length > 0) totalErrors++;
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
            totalErrors++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Total Generated: ${totalGenerated} instances`);
    console.log(`   ⏭️ Total Skipped: ${totalSkipped}`);
    console.log(`   ❌ Series with Errors: ${totalErrors}`);
    console.log('='.repeat(50) + '\n');
}

// Run the script
generateAllAutoSeriesInstances()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Script error:', err);
        process.exit(1);
    });
