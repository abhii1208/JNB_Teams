require('dotenv').config();
const { pool } = require('./db');

async function checkTimestamps() {
  try {
    // Check current server time
    const serverTimeResult = await pool.query(`
      SELECT 
        CURRENT_TIMESTAMP as server_time,
        NOW() as now_time
    `);
    console.log('\n=== SERVER TIMEZONE INFO ===');
    console.log('Server time (raw):', serverTimeResult.rows[0].server_time);
    console.log('NOW() (raw):', serverTimeResult.rows[0].now_time);

    // Check last few chat messages
    const messagesResult = await pool.query(`
      SELECT 
        id,
        content,
        created_at
      FROM chat_messages 
      ORDER BY id DESC 
      LIMIT 3
    `);
    console.log('\n=== LAST 3 CHAT MESSAGES (with IST offset) ===');
    messagesResult.rows.forEach(msg => {
      console.log(`ID ${msg.id}: ${msg.content?.substring(0, 30)}...`);
      console.log(`  created_at (from DB): ${msg.created_at}`);
      
      // Simulate frontend parsing
      const jsDate = new Date(msg.created_at);
      console.log(`  JS Date object: ${jsDate}`);
      console.log(`  toISOString(): ${jsDate.toISOString()}`);
    });

    // Test what frontend would see
    console.log('\n=== FRONTEND SIMULATION ===');
    if (messagesResult.rows.length > 0) {
      const timestamp = messagesResult.rows[0].created_at;
      console.log('Timestamp from API:', timestamp);
      
      const { formatInTimeZone } = require('date-fns-tz');
      const formatted = formatInTimeZone(new Date(timestamp), 'Asia/Kolkata', 'h:mm a');
      console.log('Formatted for IST display:', formatted);
    }

    console.log('\n=== CURRENT TIME CHECK ===');
    const now = new Date();
    console.log('JS Current time:', now.toString());
    const { formatInTimeZone } = require('date-fns-tz');
    console.log('Current IST time:', formatInTimeZone(now, 'Asia/Kolkata', 'h:mm:ss a'));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTimestamps();
