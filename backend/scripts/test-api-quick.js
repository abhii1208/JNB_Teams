/**
 * Quick API Test for Recurring Module
 * Tests the fixed endpoints
 */

const http = require('http');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';
const EMAIL = 'test001@jnb.com';
const PASSWORD = '8143772362';

function makeRequest(path, method = 'GET', token = null, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (err) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function runTest() {
  try {
    // Step 1: Login
    console.log('🔐 Logging in...');
    const loginResponse = await makeRequest('/api/user/login', 'POST', null, {
      identifier: EMAIL,
      password: PASSWORD
    });
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }
    
    const token = loginResponse.data.token;
    const userId = loginResponse.data.user.id;
    console.log(`✓ Logged in as user ${userId}`);
    
    // Step 2: Get workspaces
    console.log('\n📁 Fetching workspaces...');
    const workspacesResponse = await makeRequest('/api/workspaces', 'GET', token);
    
    if (!workspacesResponse.data || workspacesResponse.data.length === 0) {
      console.log('❌ No workspaces found');
      return;
    }
    
    const workspaceId = workspacesResponse.data[0].id;
    console.log(`✓ Found workspace ${workspaceId}`);
    
    // Step 3: List recurring series - THIS IS THE FIX TEST
    console.log('\n📅 Testing recurring series list (THE FIX)...');
    try {
      const seriesResponse = await makeRequest(
        `/api/recurring/workspace/${workspaceId}?includePaused=true&includeDeleted=false`,
        'GET',
        token
      );
      
      if (seriesResponse.status !== 200) {
        throw new Error(`Got status ${seriesResponse.status}: ${JSON.stringify(seriesResponse.data)}`);
      }
      
      console.log(`✅ SUCCESS! Found ${seriesResponse.data.length} recurring series`);
      
      if (seriesResponse.data.length > 0) {
        console.log('\n📋 Series List:');
        seriesResponse.data.forEach((s, i) => {
          console.log(`   ${i + 1}. ${s.title} - ${s.rule_summary || 'N/A'}`);
          console.log(`      Status: ${s.is_active ? '🟢 Active' : '🔴 Inactive'}`);
          console.log(`      Instances: ${s.total_instances || 0} (${s.completed_instances || 0} completed)`);
        });
      } else {
        console.log('\n⚠️  No recurring series found. Run create-sample-recurring-data.js to add sample data.');
      }
    } catch (err) {
      console.error('\n❌ FAILED TO LIST SERIES:');
      console.error('   Error:', err.message);
      console.error('\n   This means the fix did not work completely.');
      throw err;
    }
    
    console.log('\n✅ All tests passed!');
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTest();
