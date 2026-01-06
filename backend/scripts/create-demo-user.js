/**
 * Create Demo User Script
 * Creates the demo user account with specified credentials
 * Run with: node scripts/create-demo-user.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'team_app',
});

const DEMO_USER = {
  email: 'JNBtest@JNB.com',
  password: '8143772362',
  username: 'jnbtest',
  firstName: 'JNB',
  lastName: 'Test'
};

async function createDemoUser() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking if demo user exists...');
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [DEMO_USER.email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Demo user already exists:');
      console.log(`   Email: ${existingUser.rows[0].email}`);
      console.log(`   Username: ${existingUser.rows[0].username}`);
      console.log(`   ID: ${existingUser.rows[0].id}`);
      return;
    }
    
    console.log('👤 Creating demo user...');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(DEMO_USER.password, 12);
    
    // Insert the user
    const result = await client.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, first_name, last_name`,
      [
        DEMO_USER.username,
        DEMO_USER.email,
        hashedPassword,
        DEMO_USER.firstName,
        DEMO_USER.lastName
      ]
    );
    
    const newUser = result.rows[0];
    
    console.log('\n✅ Demo user created successfully!');
    console.log('\n📊 User Details:');
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Name: ${newUser.first_name} ${newUser.last_name}`);
    console.log(`   Password: ${DEMO_USER.password}`);
    console.log('\n🎉 You can now login with these credentials!');
    
  } catch (error) {
    console.error('❌ Error creating demo user:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the creation
createDemoUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
