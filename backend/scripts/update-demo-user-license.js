/**
 * Update Demo User License Type
 * Sets JNBtest@JNB.com to licensed_admin
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'team_app',
});

const DEMO_EMAIL = 'JNBtest@JNB.com';
const LICENSE_TYPE = 'licensed_admin';

async function updateLicense() {
  try {
    console.log(`🔍 Updating license for ${DEMO_EMAIL}...`);
    
    const result = await pool.query(
      'UPDATE users SET license_type = $1 WHERE email = $2 RETURNING id, username, email, license_type',
      [LICENSE_TYPE, DEMO_EMAIL]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User not found:', DEMO_EMAIL);
      process.exit(1);
    }
    
    console.log('✅ License updated successfully!');
    console.log('\n📊 User Details:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Username: ${result.rows[0].username}`);
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   License Type: ${result.rows[0].license_type}`);
    
  } catch (error) {
    console.error('❌ Error updating license:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateLicense();
