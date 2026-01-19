const { pool } = require('../db');

async function checkAndCreateSample() {
    console.log('=== STEP 1: Finding user test001@jnb.com ===\n');
    
    const userResult = await pool.query("SELECT * FROM users WHERE email = 'test001@jnb.com'");
    
    if (userResult.rows.length === 0) {
        console.log('❌ User test001@jnb.com NOT FOUND in database!');
        process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log('✅ Found User:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Name:', user.first_name, user.last_name);
    
    console.log('\n=== STEP 2: Finding workspace memberships ===\n');
    
    const wmResult = await pool.query('SELECT * FROM workspace_members WHERE user_id = $1', [user.id]);
    console.log('Workspace Memberships:', wmResult.rows);
    
    if (wmResult.rows.length === 0) {
        console.log('❌ User has NO workspace memberships!');
        process.exit(1);
    }
    
    const workspaceId = wmResult.rows[0].workspace_id;
    console.log('✅ Using Workspace ID:', workspaceId);
    
    console.log('\n=== STEP 3: Checking existing recurring series ===\n');
    
    const existingResult = await pool.query(
        'SELECT id, title, category FROM recurring_series WHERE workspace_id = $1 AND deleted_at IS NULL',
        [workspaceId]
    );
    console.log('Existing series count:', existingResult.rows.length);
    if (existingResult.rows.length > 0) {
        console.log('Existing series:', existingResult.rows.map(r => r.title));
    }
    
    console.log('\n=== STEP 4: Deleting old sample data ===\n');
    
    const deleteResult = await pool.query(
        'DELETE FROM recurring_series WHERE workspace_id = $1 RETURNING id, title',
        [workspaceId]
    );
    console.log('Deleted', deleteResult.rowCount, 'existing series');
    
    console.log('\n=== STEP 5: Creating new sample series ===\n');
    
    const endDate = '2026-01-31';
    const samples = [
        { title: 'Daily Stand-up Meeting', category: 'daily', color: '#10b981', rule: { freq: 'DAILY', interval: 1 }, start: '2026-01-01' },
        { title: 'Daily Health Check', category: 'daily', color: '#f59e0b', rule: { freq: 'DAILY', interval: 1 }, start: '2026-01-15' },
        { title: 'Weekly Team Sync', category: 'weekly', color: '#3b82f6', rule: { freq: 'WEEKLY', interval: 1, byday: ['MO'] }, start: '2026-01-06' },
        { title: 'Weekly Code Review', category: 'weekly', color: '#8b5cf6', rule: { freq: 'WEEKLY', interval: 1, byday: ['FR'] }, start: '2026-01-03', mode: 'manual' },
        { title: 'Bi-weekly Planning', category: 'weekly', color: '#06b6d4', rule: { freq: 'WEEKLY', interval: 2, byday: ['MO'] }, start: '2026-01-06' },
        { title: 'Monthly Report', category: 'monthly', color: '#ec4899', rule: { freq: 'MONTHLY', interval: 1, bymonthday: [1] }, start: '2026-01-01' },
        { title: 'Monthly Audit', category: 'monthly', color: '#ef4444', rule: { freq: 'MONTHLY', interval: 1, bymonthday: [15] }, start: '2026-01-15' },
        { title: 'Quarterly Review', category: 'reports', color: '#a855f7', rule: { freq: 'MONTHLY', interval: 3, bymonthday: [1] }, start: '2026-01-01', mode: 'manual' },
        { title: 'Yearly Performance Review', category: 'yearly', color: '#f97316', rule: { freq: 'YEARLY', interval: 1, bymonth: [1], bymonthday: [15] }, start: '2026-01-15' },
        { title: 'Weekly Backup Check', category: 'maintenance', color: '#64748b', rule: { freq: 'WEEKLY', interval: 1, byday: ['SU'] }, start: '2026-01-05' },
        { title: 'Weekly Client Call', category: 'meetings', color: '#0ea5e9', rule: { freq: 'WEEKLY', interval: 1, byday: ['WE'] }, start: '2026-01-08' },
    ];
    
    let created = 0;
    for (const s of samples) {
        try {
            const result = await pool.query(`
                INSERT INTO recurring_series (
                    workspace_id, title, description, template,
                    recurrence_rule, timezone, start_date, end_date,
                    generation_mode, generate_past, prevent_future,
                    category, color, created_by, assignment_strategy
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id
            `, [
                workspaceId,
                s.title,
                'Sample recurring task for testing',
                JSON.stringify({ priority: 'Medium', stage: 'Planned' }),
                JSON.stringify(s.rule),
                'Asia/Kolkata',
                s.start,
                endDate,
                s.mode || 'auto',
                true,
                true,
                s.category,
                s.color,
                user.id,
                'static'
            ]);
            console.log('✅ Created:', s.title, '(ID:', result.rows[0].id + ')');
            created++;
        } catch (err) {
            console.error('❌ Error creating', s.title, ':', err.message);
        }
    }
    
    console.log('\n=== STEP 6: Generating task instances ===\n');
    
    const { generateInstancesForSeries } = require('../services/instanceGenerator');
    
    const newSeries = await pool.query(
        'SELECT id, title FROM recurring_series WHERE workspace_id = $1 AND generation_mode = $2 AND deleted_at IS NULL',
        [workspaceId, 'auto']
    );
    
    let totalInstances = 0;
    for (const series of newSeries.rows) {
        try {
            const result = await generateInstancesForSeries(series.id, {
                forceBackfill: true,
                maxInstances: 31
            });
            console.log('   ', series.title, ':', result.generated, 'instances');
            totalInstances += result.generated;
        } catch (err) {
            console.error('   Error for', series.title, ':', err.message);
        }
    }
    
    console.log('\n=== SUMMARY ===\n');
    console.log('✅ User ID:', user.id);
    console.log('✅ Workspace ID:', workspaceId);
    console.log('✅ Series Created:', created);
    console.log('✅ Instances Generated:', totalInstances);
    
    // Verify final state
    const finalCheck = await pool.query(
        'SELECT id, title, category FROM recurring_series WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY id',
        [workspaceId]
    );
    console.log('\n✅ Final series in database:');
    finalCheck.rows.forEach(r => console.log('   ', r.id, '-', r.title, '(' + r.category + ')'));
    
    console.log('\n🎉 DONE! Now login with test001@jnb.com and go to Recurring Tasks');
}

checkAndCreateSample()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('FATAL ERROR:', err);
        process.exit(1);
    });
