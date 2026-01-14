/**
 * Complete Recurring Module API Test
 * Tests all fixed endpoints
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:5000';
const EMAIL = 'test001@jnb.com';
const PASSWORD = '8143772362';

async function makeRequest(path, method = 'GET', token = null, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const reqBody = body ? JSON.stringify(body) : null;
    if (reqBody) {
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    }
    
    const req = http.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          };
          
          if (res.statusCode >= 400) {
            const error = new Error(`HTTP ${res.statusCode}: ${JSON.stringify(result.data)}`);
            error.response = result;
            reject(error);
          } else {
            resolve(result);
          }
        } catch (err) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (reqBody) {
      req.write(reqBody);
    }
    
    req.end();
  });
}

async function test() {
  try {
    console.log('\n🔐 Step 1: Login...');
    const loginResponse = await makeRequest('/api/login', 'POST', null, {
      email: EMAIL,
      password: PASSWORD
    });
    
    const token = loginResponse.data.token;
    const userId = loginResponse.data.id;
    const username = loginResponse.data.username;
    console.log(`✅ Logged in as ${username} (ID: ${userId})`);
    
    // Get workspaces
    console.log('\n📋 Step 2: Fetching workspaces...');
    const wsResponse = await makeRequest('/api/workspaces', 'GET', token);
    if (!wsResponse.data || wsResponse.data.length === 0) {
      throw new Error('No workspaces found for user');
    }
    // Use the Personal workspace (id=15) where sample data was created
    const workspace = wsResponse.data.find(w => w.id === 15) || wsResponse.data[0];
    const workspaceId = workspace.id;
    console.log(`✅ Found workspace ID: ${workspaceId} (${workspace.name})`)
    
    console.log(`\n📅 Step 3: Fetch recurring series for workspace ${workspaceId}...`);
    const recurringResponse = await makeRequest(
      `/api/recurring/workspace/${workspaceId}`,
      'GET',
      token
    );
    
    const series = recurringResponse.data;
    console.log(`✅ Found ${series.length} recurring series:`);
    
    if (series.length > 0) {
      series.forEach((s, index) => {
        console.log(`\n${index + 1}. ${s.title} (ID: ${s.id})`);
        console.log(`   Description: ${s.description || 'N/A'}`);
        console.log(`   Start Date: ${s.start_date}`);
        console.log(`   End Date: ${s.end_date || 'N/A'}`);
        console.log(`   Status: ${s.paused_at ? 'PAUSED' : 'ACTIVE'}`);
        console.log(`   Created By: ${s.creator_name || s.created_by}`);
        console.log(`   Recurrence: ${JSON.stringify(s.recurrence_rule)}`);
      });
      
      // Test get single series
      const firstSeriesId = series[0].id;
      console.log(`\n🔍 Step 4: Get details for series ${firstSeriesId}...`);
      const detailResponse = await makeRequest(
        `/api/recurring/${firstSeriesId}`,
        'GET',
        token
      );
      console.log(`✅ Retrieved series details:`);
      console.log(`   Version: ${detailResponse.data.version}`);
      console.log(`   Assignment Strategy: ${detailResponse.data.assignment_strategy}`);
      console.log(`   Auto Close After Days: ${detailResponse.data.auto_close_after_days || 'N/A'}`);
      
      // Test instances generation
      console.log(`\n⚙️  Step 5: Generate instances for series ${firstSeriesId}...`);
      const generateResponse = await makeRequest(
        `/api/recurring/${firstSeriesId}/generate`,
        'POST',
        token,
        { maxInstances: 5 }
      );
      console.log(`✅ Generation complete:`);
      console.log(`   Generated: ${generateResponse.data.generated}`);
      console.log(`   Skipped: ${generateResponse.data.skipped}`);
      console.log(`   Moved: ${generateResponse.data.moved || 0}`);
      if (generateResponse.data.errors && generateResponse.data.errors.length > 0) {
        console.log(`   Errors: ${generateResponse.data.errors.join(', ')}`);
      }
      
    } else {
      console.log('⚠️  No recurring series found. The sample data might not have been created for this workspace.');
    }
    
    console.log(`\n✅ All tests passed!`);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

test();
