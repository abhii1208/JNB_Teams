/**
 * Test creating a new recurring series
 */

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
    console.log(`✅ Logged in as user ID: ${userId}`);
    
    console.log('\n📋 Step 2: Fetching workspaces...');
    const wsResponse = await makeRequest('/api/workspaces', 'GET', token);
    const workspace = wsResponse.data.find(w => w.id === 15) || wsResponse.data[0];
    const workspaceId = workspace.id;
    console.log(`✅ Using workspace: ${workspace.name} (ID: ${workspaceId})`);
    
    console.log('\n📋 Step 3: Fetching projects...');
    const projectsResponse = await makeRequest(`/api/projects/workspace/${workspaceId}`, 'GET', token);
    const project = projectsResponse.data && projectsResponse.data.length > 0 ? projectsResponse.data[0] : null;
    const projectId = project ? project.id : null;
    console.log(`✅ Using project: ${project ? project.name : 'None'} (ID: ${projectId || 'null'})`);
    
    console.log('\n➕ Step 4: Creating new recurring series...');
    const newSeries = {
      workspace_id: workspaceId,
      project_id: projectId,
      title: 'Test Daily Task - ' + Date.now(),
      description: 'Automated test task created via API',
      recurrence_rule: {
        freq: 'DAILY',
        interval: 1,
        byday: ['MO', 'TU', 'WE', 'TH', 'FR']
      },
      timezone: 'America/Los_Angeles',
      start_date: '2026-01-15',
      end_date: '2026-03-15',
      assignment_strategy: 'static',
      static_assignee_id: userId,
      auto_close_after_days: 7,
      max_future_instances: 10,
      requires_approval: false,
      template: {
        priority: 'medium',
        estimated_hours: 1
      }
    };
    
    const createResponse = await makeRequest('/api/recurring', 'POST', token, newSeries);
    console.log(`✅ Created recurring series!`);
    console.log(`   ID: ${createResponse.data.id}`);
    console.log(`   Title: ${createResponse.data.title}`);
    console.log(`   Start Date: ${createResponse.data.start_date}`);
    
    console.log('\n✅ All tests passed! Series creation working.');
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

test();
