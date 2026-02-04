/**
 * Create test data for checklist module in Testing workspace
 * Workspace ID: 28, User ID: 7 (test001@jnb.com)
 */
const { pool } = require('../db');

const WORKSPACE_ID = 28;
const USER_ID = 7;

async function createTestData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('=== Creating Test Data for Workspace 28 ===\n');
    
    // 1. Create a test client
    console.log('1. Creating test client...');
    const clientResult = await client.query(`
      INSERT INTO clients (workspace_id, client_name, client_code, status, owner_user_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (workspace_id, client_code) DO UPDATE SET
        client_name = EXCLUDED.client_name,
        status = EXCLUDED.status
      RETURNING id, client_name, client_code
    `, [WORKSPACE_ID, 'Test Client ABC', 'TCABC', 'Active', USER_ID, 'Test client for checklist testing']);
    
    const testClient = clientResult.rows[0];
    console.log(`   ✅ Client created: ${testClient.client_name} (ID: ${testClient.id})\n`);
    
    // 2. Create checklist categories
    console.log('2. Creating checklist categories...');
    const categories = ['Compliance', 'Operations', 'Reporting', 'Finance'];
    const categoryIds = {};
    
    for (const cat of categories) {
      const catResult = await client.query(`
        INSERT INTO checklist_categories (workspace_id, name)
        VALUES ($1, $2)
        ON CONFLICT (workspace_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name
      `, [WORKSPACE_ID, cat]);
      categoryIds[cat] = catResult.rows[0].id;
      console.log(`   ✅ Category: ${cat} (ID: ${categoryIds[cat]})`);
    }
    console.log('');
    
    // 3. Create checklist items (3 daily, 3 weekly, 3 monthly)
    console.log('3. Creating checklist items...');
    const checklistItems = [
      // Daily items
      { title: 'Daily Attendance Report', frequency: 'daily', category: 'Operations', description: 'Review and verify daily attendance records' },
      { title: 'Bank Reconciliation Check', frequency: 'daily', category: 'Finance', description: 'Verify bank transactions match records' },
      { title: 'Customer Support Tickets', frequency: 'daily', category: 'Operations', description: 'Review and respond to support tickets' },
      
      // Weekly items
      { title: 'Weekly Team Meeting Notes', frequency: 'weekly', category: 'Operations', description: 'Document weekly team meeting action items' },
      { title: 'Weekly Sales Report', frequency: 'weekly', category: 'Reporting', description: 'Compile and submit weekly sales figures' },
      { title: 'Inventory Check', frequency: 'weekly', category: 'Operations', description: 'Verify inventory levels and reorder needs' },
      
      // Monthly items
      { title: 'Monthly GST Filing', frequency: 'monthly', category: 'Compliance', description: 'Prepare and file monthly GST returns' },
      { title: 'Monthly Performance Review', frequency: 'monthly', category: 'Operations', description: 'Review team performance metrics' },
      { title: 'Monthly Financial Statement', frequency: 'monthly', category: 'Reporting', description: 'Prepare monthly financial statements' },
    ];
    
    const createdItems = [];
    for (const item of checklistItems) {
      const itemResult = await client.query(`
        INSERT INTO checklist_items (
          workspace_id, client_id, title, description, frequency, 
          category, is_active, created_by, effective_from
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
        ON CONFLICT DO NOTHING
        RETURNING id, title, frequency
      `, [
        WORKSPACE_ID, testClient.id, item.title, item.description,
        item.frequency, item.category, true, USER_ID
      ]);
      
      if (itemResult.rows.length > 0) {
        createdItems.push(itemResult.rows[0]);
        console.log(`   ✅ ${item.frequency.toUpperCase().padEnd(7)} - ${item.title} (ID: ${itemResult.rows[0].id})`);
      } else {
        // Item already exists, get its ID
        const existingItem = await client.query(
          'SELECT id, title FROM checklist_items WHERE workspace_id = $1 AND client_id = $2 AND title = $3',
          [WORKSPACE_ID, testClient.id, item.title]
        );
        if (existingItem.rows.length > 0) {
          createdItems.push(existingItem.rows[0]);
          console.log(`   ⏭️  ${item.frequency.toUpperCase().padEnd(7)} - ${item.title} (already exists, ID: ${existingItem.rows[0].id})`);
        }
      }
    }
    console.log('');
    
    // 4. Create client holidays for 2026
    console.log('4. Creating holidays for 2026...');
    const holidays = [
      { date: '2026-01-26', name: 'Republic Day' },
      { date: '2026-03-10', name: 'Holi' },
      { date: '2026-04-14', name: 'Ambedkar Jayanti' },
      { date: '2026-05-01', name: 'May Day' },
      { date: '2026-08-15', name: 'Independence Day' },
      { date: '2026-10-02', name: 'Gandhi Jayanti' },
      { date: '2026-10-21', name: 'Dussehra' },
      { date: '2026-11-09', name: 'Diwali' },
      { date: '2026-11-10', name: 'Diwali Day 2' },
      { date: '2026-12-25', name: 'Christmas' },
    ];
    
    for (const h of holidays) {
      await client.query(`
        INSERT INTO client_holidays (client_id, holiday_date, name, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (client_id, holiday_date) DO UPDATE SET name = EXCLUDED.name
      `, [testClient.id, h.date, h.name, USER_ID]);
      console.log(`   ✅ ${h.date} - ${h.name}`);
    }
    console.log('');
    
    // 5. Generate occurrences for February and March 2026
    console.log('5. Generating checklist occurrences for Feb-Mar 2026...');
    
    // Get working days for Feb 2026 (excluding weekends and holidays)
    const generateOccurrences = async (itemId, frequency, clientId) => {
      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-03-31');
      let count = 0;
      
      // Get holidays for this client
      const holidaysResult = await client.query(
        'SELECT holiday_date FROM client_holidays WHERE client_id = $1',
        [clientId]
      );
      const holidayDates = holidaysResult.rows.map(r => r.holiday_date);
      
      const isHoliday = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        return holidayDates.includes(dateStr);
      };
      
      const isWeekend = (date) => {
        const day = date.getDay();
        return day === 0 || day === 6;
      };
      
      let currentDate = new Date(startDate);
      let weekCounter = 0;
      let lastWeek = -1;
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        const weekOfYear = Math.floor((currentDate - new Date(currentDate.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        
        let shouldCreate = false;
        let periodEndDate = dateStr;
        
        if (frequency === 'daily') {
          // Daily: every weekday that's not a holiday
          shouldCreate = !isWeekend(currentDate) && !isHoliday(currentDate);
        } else if (frequency === 'weekly') {
          // Weekly: first working day of each week
          if (weekOfYear !== lastWeek && !isWeekend(currentDate) && !isHoliday(currentDate)) {
            shouldCreate = true;
            lastWeek = weekOfYear;
            // Period end is the Sunday of that week
            const sunday = new Date(currentDate);
            sunday.setDate(sunday.getDate() + (7 - dayOfWeek));
            periodEndDate = sunday.toISOString().split('T')[0];
          }
        } else if (frequency === 'monthly') {
          // Monthly: first working day of the month
          if (currentDate.getDate() <= 7 && !isWeekend(currentDate) && !isHoliday(currentDate)) {
            // Check if this is the first working day of the month
            let checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            while (isWeekend(checkDate) || isHoliday(checkDate)) {
              checkDate.setDate(checkDate.getDate() + 1);
            }
            if (checkDate.getDate() === currentDate.getDate()) {
              shouldCreate = true;
              // Period end is end of month
              const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
              periodEndDate = endOfMonth.toISOString().split('T')[0];
            }
          }
        }
        
        if (shouldCreate) {
          await client.query(`
            INSERT INTO checklist_occurrences (
              checklist_item_id, client_id, workspace_id, occurrence_date, period_end_date, frequency, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
            ON CONFLICT (checklist_item_id, occurrence_date) DO NOTHING
          `, [itemId, clientId, WORKSPACE_ID, dateStr, periodEndDate, frequency]);
          count++;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return count;
    };
    
    let totalOccurrences = 0;
    for (const item of createdItems) {
      const freq = item.frequency || 
        (await client.query('SELECT frequency FROM checklist_items WHERE id = $1', [item.id])).rows[0]?.frequency;
      const count = await generateOccurrences(item.id, freq, testClient.id);
      totalOccurrences += count;
    }
    console.log(`   ✅ Created ${totalOccurrences} occurrences for Feb-Mar 2026\n`);
    
    await client.query('COMMIT');
    
    console.log('=== Summary ===');
    console.log(`Workspace ID: ${WORKSPACE_ID}`);
    console.log(`User ID: ${USER_ID}`);
    console.log(`Client: ${testClient.client_name} (ID: ${testClient.id})`);
    console.log(`Categories: ${categories.length}`);
    console.log(`Checklist Items: ${createdItems.length}`);
    console.log(`Holidays: ${holidays.length}`);
    console.log(`Total Occurrences: ${totalOccurrences}`);
    console.log('\n✅ Test data setup complete!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating test data:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createTestData();
