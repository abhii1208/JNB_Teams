/**
 * Setup test data for Checklist module
 * Creates sample client, checklist items, and holidays
 */
const { pool } = require('../db');

async function setupTestData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Get a workspace (prefer non-personal, create if needed)
    let wsResult = await client.query('SELECT * FROM workspaces WHERE is_personal IS NOT TRUE AND name != $$Personal$$ LIMIT 1');
    if (wsResult.rows.length === 0) {
      console.log('No non-personal workspace found. Creating one...');
      // Get a user
      const userResult = await client.query('SELECT id FROM users LIMIT 1');
      if (userResult.rows.length === 0) {
        throw new Error('No users found in database');
      }
      const userId = userResult.rows[0].id;
      
      // Create workspace
      const newWs = await client.query(
        `INSERT INTO workspaces (name, created_by, is_personal, timezone) 
         VALUES ('Test Company Workspace', $1, FALSE, 'Asia/Kolkata') 
         RETURNING *`,
        [userId]
      );
      
      // Add user as owner
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) 
         VALUES ($1, $2, 'Owner')
         ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [newWs.rows[0].id, userId]
      );
      
      wsResult = { rows: [newWs.rows[0]] };
      console.log('Created workspace:', newWs.rows[0].id);
    }
    
    const workspace = wsResult.rows[0];
    console.log('Using workspace:', workspace.id, workspace.name);
    
    // Get a user for assignments
    const userResult = await client.query(
      'SELECT user_id FROM workspace_members WHERE workspace_id = $1 LIMIT 1',
      [workspace.id]
    );
    const userId = userResult.rows[0].user_id;
    console.log('Using user ID:', userId);
    
    // 2. Check if sample client exists, create if not
    let clientResult = await client.query(
      'SELECT * FROM clients WHERE workspace_id = $1 AND client_name = $2',
      [workspace.id, 'ABC Corporation']
    );
    
    let sampleClient;
    if (clientResult.rows.length === 0) {
      console.log('Creating sample client...');
      const newClient = await client.query(
        `INSERT INTO clients (workspace_id, client_name, client_code, status, owner_user_id, notes, legal_name)
         VALUES ($1, 'ABC Corporation', 'ABC001', 'Active', $2, 'Sample test client for checklist module', 'ABC Corp Pvt Ltd')
         RETURNING *`,
        [workspace.id, userId]
      );
      sampleClient = newClient.rows[0];
      console.log('Created client:', sampleClient.id, sampleClient.client_name);
    } else {
      sampleClient = clientResult.rows[0];
      console.log('Using existing client:', sampleClient.id, sampleClient.client_name);
    }
    
    // 3. Create checklist categories
    console.log('Creating checklist categories...');
    const categories = ['Compliance', 'Operations', 'Reporting'];
    const categoryIds = {};
    
    for (const catName of categories) {
      const existing = await client.query(
        'SELECT id FROM checklist_categories WHERE workspace_id = $1 AND name = $2',
        [workspace.id, catName]
      );
      
      if (existing.rows.length === 0) {
        const newCat = await client.query(
          `INSERT INTO checklist_categories (workspace_id, name, color, icon) 
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [workspace.id, catName, 
           catName === 'Compliance' ? '#dc2626' : catName === 'Operations' ? '#0ea5e9' : '#16a34a',
           'checklist']
        );
        categoryIds[catName] = newCat.rows[0].id;
      } else {
        categoryIds[catName] = existing.rows[0].id;
      }
    }
    console.log('Categories ready:', categoryIds);
    
    // 4. Create checklist items (daily, weekly, monthly)
    console.log('Creating checklist items...');
    
    const checklistItems = [
      // Daily items
      {
        title: 'Daily Attendance Report',
        description: 'Submit daily attendance summary by EOD',
        frequency: 'daily',
        category: 'Operations',
        completion_rule: 'any',
        remarks_required: false
      },
      {
        title: 'Bank Reconciliation Check',
        description: 'Verify daily bank transactions match records',
        frequency: 'daily',
        category: 'Compliance',
        completion_rule: 'all',
        remarks_required: true
      },
      {
        title: 'Customer Support Tickets Review',
        description: 'Review and close pending support tickets',
        frequency: 'daily',
        category: 'Operations',
        completion_rule: 'any',
        remarks_required: false
      },
      // Weekly items
      {
        title: 'Weekly Team Meeting Minutes',
        description: 'Document and share team meeting minutes',
        frequency: 'weekly',
        category: 'Operations',
        completion_rule: 'any',
        remarks_required: true
      },
      {
        title: 'Weekly Sales Report',
        description: 'Compile and submit weekly sales figures',
        frequency: 'weekly',
        category: 'Reporting',
        completion_rule: 'any',
        remarks_required: false
      },
      {
        title: 'Inventory Stock Check',
        description: 'Verify inventory levels match system records',
        frequency: 'weekly',
        category: 'Operations',
        completion_rule: 'all',
        remarks_required: true
      },
      // Monthly items
      {
        title: 'Monthly GST Filing',
        description: 'File monthly GST returns before due date',
        frequency: 'monthly',
        category: 'Compliance',
        completion_rule: 'all',
        remarks_required: true
      },
      {
        title: 'Monthly Performance Review',
        description: 'Complete team performance reviews',
        frequency: 'monthly',
        category: 'Operations',
        completion_rule: 'any',
        remarks_required: false
      },
      {
        title: 'Monthly Financial Statement',
        description: 'Prepare and review monthly P&L statement',
        frequency: 'monthly',
        category: 'Reporting',
        completion_rule: 'all',
        remarks_required: true
      }
    ];
    
    for (const item of checklistItems) {
      // Check if item exists
      const existing = await client.query(
        'SELECT id FROM checklist_items WHERE client_id = $1 AND title = $2',
        [sampleClient.id, item.title]
      );
      
      if (existing.rows.length === 0) {
        const newItem = await client.query(
          `INSERT INTO checklist_items 
           (client_id, workspace_id, title, description, frequency, category, completion_rule, remarks_required, is_active, effective_from, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, CURRENT_DATE, $9)
           RETURNING id`,
          [sampleClient.id, workspace.id, item.title, item.description, item.frequency, 
           item.category, item.completion_rule, item.remarks_required, userId]
        );
        
        // Add assignment
        await client.query(
          `INSERT INTO checklist_assignments (checklist_item_id, user_id, assigned_from, assigned_by, is_active)
           VALUES ($1, $2, CURRENT_DATE, $3, TRUE)`,
          [newItem.rows[0].id, userId, userId]
        );
        
        console.log('Created checklist item:', item.title, '(', item.frequency, ')');
      } else {
        console.log('Checklist item exists:', item.title);
      }
    }
    
    // 5. Create client holidays for 2026
    console.log('Creating client holidays for 2026...');
    
    const holidays2026 = [
      { date: '2026-01-26', name: 'Republic Day' },
      { date: '2026-03-17', name: 'Holi' },
      { date: '2026-04-14', name: 'Ambedkar Jayanti' },
      { date: '2026-05-01', name: 'May Day' },
      { date: '2026-08-15', name: 'Independence Day' },
      { date: '2026-10-02', name: 'Gandhi Jayanti' },
      { date: '2026-10-20', name: 'Dussehra' },
      { date: '2026-11-09', name: 'Diwali' },
      { date: '2026-11-10', name: 'Diwali (Day 2)' },
      { date: '2026-12-25', name: 'Christmas' }
    ];
    
    for (const holiday of holidays2026) {
      const existing = await client.query(
        'SELECT id FROM client_holidays WHERE client_id = $1 AND holiday_date = $2',
        [sampleClient.id, holiday.date]
      );
      
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO client_holidays (client_id, holiday_date, name, created_by)
           VALUES ($1, $2, $3, $4)`,
          [sampleClient.id, holiday.date, holiday.name, userId]
        );
        console.log('Created holiday:', holiday.date, holiday.name);
      } else {
        console.log('Holiday exists:', holiday.date, holiday.name);
      }
    }
    
    // 6. Create workspace checklist settings
    console.log('Creating workspace checklist settings...');
    await client.query(
      `INSERT INTO workspace_checklist_settings 
       (workspace_id, daily_reminder_time, weekly_reminder_day, monthly_reminder_day, enable_reminders)
       VALUES ($1, '09:00', 3, 25, TRUE)
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspace.id]
    );
    
    // 7. Generate occurrences for today and the current month
    console.log('Generating occurrences for current month...');
    
    const items = await client.query(
      'SELECT * FROM checklist_items WHERE client_id = $1 AND is_active = TRUE',
      [sampleClient.id]
    );
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    for (const item of items.rows) {
      if (item.frequency === 'daily') {
        // Generate for each day of the month
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const occDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          const existing = await client.query(
            'SELECT id FROM checklist_occurrences WHERE checklist_item_id = $1 AND occurrence_date = $2',
            [item.id, occDate]
          );
          
          if (existing.rows.length === 0) {
            // Check if holiday
            const isHoliday = await client.query(
              'SELECT id FROM client_holidays WHERE client_id = $1 AND holiday_date = $2',
              [sampleClient.id, occDate]
            );
            
            const status = isHoliday.rows.length > 0 ? 'exempt' : 'pending';
            
            await client.query(
              `INSERT INTO checklist_occurrences 
               (checklist_item_id, client_id, workspace_id, occurrence_date, period_end_date, frequency, status)
               VALUES ($1, $2, $3, $4, $4, $5, $6)`,
              [item.id, sampleClient.id, workspace.id, occDate, item.frequency, status]
            );
          }
        }
      } else if (item.frequency === 'weekly') {
        // Generate for each week
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        
        // Find first Monday
        let current = new Date(firstDay);
        while (current.getDay() !== 1) {
          current.setDate(current.getDate() + 1);
        }
        
        while (current <= lastDay) {
          const weekStart = new Date(current);
          const weekEnd = new Date(current);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const occDate = weekStart.toISOString().split('T')[0];
          const endDate = weekEnd.toISOString().split('T')[0];
          
          const existing = await client.query(
            'SELECT id FROM checklist_occurrences WHERE checklist_item_id = $1 AND occurrence_date = $2',
            [item.id, occDate]
          );
          
          if (existing.rows.length === 0) {
            await client.query(
              `INSERT INTO checklist_occurrences 
               (checklist_item_id, client_id, workspace_id, occurrence_date, period_end_date, frequency, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
              [item.id, sampleClient.id, workspace.id, occDate, endDate, item.frequency]
            );
          }
          
          current.setDate(current.getDate() + 7);
        }
      } else if (item.frequency === 'monthly') {
        // Generate for the month
        const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
        
        const existing = await client.query(
          'SELECT id FROM checklist_occurrences WHERE checklist_item_id = $1 AND occurrence_date = $2',
          [item.id, monthStart]
        );
        
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO checklist_occurrences 
             (checklist_item_id, client_id, workspace_id, occurrence_date, period_end_date, frequency, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
            [item.id, sampleClient.id, workspace.id, monthStart, monthEnd, item.frequency]
          );
        }
      }
    }
    
    console.log('Occurrences generated!');
    
    await client.query('COMMIT');
    console.log('\n✅ Test data setup complete!');
    
    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log('Workspace ID:', workspace.id);
    console.log('Client ID:', sampleClient.id);
    console.log('Client Name:', sampleClient.client_name);
    
    const itemCount = await pool.query('SELECT frequency, COUNT(*) as count FROM checklist_items WHERE client_id = $1 GROUP BY frequency', [sampleClient.id]);
    console.log('\nChecklist Items:');
    itemCount.rows.forEach(r => console.log(`  ${r.frequency}: ${r.count}`));
    
    const occCount = await pool.query('SELECT status, COUNT(*) as count FROM checklist_occurrences WHERE client_id = $1 GROUP BY status', [sampleClient.id]);
    console.log('\nOccurrences:');
    occCount.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));
    
    const holidayCount = await pool.query('SELECT COUNT(*) as count FROM client_holidays WHERE client_id = $1', [sampleClient.id]);
    console.log('\nHolidays:', holidayCount.rows[0].count);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error setting up test data:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupTestData();
