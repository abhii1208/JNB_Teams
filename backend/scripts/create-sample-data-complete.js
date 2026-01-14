/**
 * Create comprehensive sample recurring series for testing
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

async function createSampleData() {
  try {
    console.log('\n🔐 Logging in...');
    const loginResponse = await makeRequest('/api/login', 'POST', null, {
      email: EMAIL,
      password: PASSWORD
    });
    
    const token = loginResponse.data.token;
    const userId = loginResponse.data.id;
    console.log(`✅ Logged in as user ID: ${userId}`);
    
    const wsResponse = await makeRequest('/api/workspaces', 'GET', token);
    const workspace = wsResponse.data.find(w => w.id === 15) || wsResponse.data[0];
    const workspaceId = workspace.id;
    
    const projectsResponse = await makeRequest(`/api/projects/workspace/${workspaceId}`, 'GET', token);
    const project = projectsResponse.data && projectsResponse.data.length > 0 ? projectsResponse.data[0] : null;
    const projectId = project ? project.id : null;
    
    console.log(`\n📋 Creating sample series in workspace: ${workspace.name} (ID: ${workspaceId})`);
    console.log(`   Project: ${project ? project.name : 'None'} (ID: ${projectId || 'null'})`);
    
    const sampleSeries = [
      {
        title: 'Weekly Sprint Planning',
        description: 'Plan the upcoming week\'s sprint tasks and goals',
        recurrence_rule: { freq: 'WEEKLY', interval: 1, byday: ['MO'] },
        timezone: 'America/Los_Angeles',
        start_date: '2026-01-20',
        end_date: '2026-06-30',
        assignment_strategy: 'static',
        static_assignee_id: userId,
        template: { priority: 'high', estimated_hours: 2 }
      },
      {
        title: 'Monthly Financial Review',
        description: 'Review monthly expenses and budget allocation',
        recurrence_rule: { freq: 'MONTHLY', interval: 1, bymonthday: [1] },
        timezone: 'America/Los_Angeles',
        start_date: '2026-02-01',
        assignment_strategy: 'static',
        static_assignee_id: userId,
        auto_close_after_days: 7,
        template: { priority: 'high', estimated_hours: 3 }
      },
      {
        title: 'Quarterly Board Meeting Prep',
        description: 'Prepare materials and agenda for quarterly board meeting',
        recurrence_rule: { freq: 'MONTHLY', interval: 3, bymonthday: [15] },
        timezone: 'America/Los_Angeles',
        start_date: '2026-01-15',
        end_date: '2026-12-31',
        assignment_strategy: 'static',
        static_assignee_id: userId,
        requires_approval: true,
        approver_id: userId,
        template: { priority: 'high', estimated_hours: 8 }
      },
      {
        title: 'Bi-weekly Team 1:1s',
        description: 'Individual check-ins with each team member',
        recurrence_rule: { freq: 'WEEKLY', interval: 2, byday: ['TU'] },
        timezone: 'America/Los_Angeles',
        start_date: '2026-01-21',
        end_date: '2026-12-31',
        assignment_strategy: 'static',
        static_assignee_id: userId,
        template: { priority: 'medium', estimated_hours: 4 }
      },
      {
        title: 'End of Month Reports',
        description: 'Compile and submit monthly progress reports',
        recurrence_rule: { freq: 'MONTHLY', interval: 1, bymonthday: [-1] },
        timezone: 'America/Los_Angeles',
        start_date: '2026-01-31',
        assignment_strategy: 'static',
        static_assignee_id: userId,
        auto_close_after_days: 3,
        template: { priority: 'high', estimated_hours: 2 }
      }
    ];
    
    console.log(`\n➕ Creating ${sampleSeries.length} sample recurring series...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const series of sampleSeries) {
      try {
        const payload = {
          workspace_id: workspaceId,
          project_id: projectId,
          ...series
        };
        
        const response = await makeRequest('/api/recurring', 'POST', token, payload);
        console.log(`✅ ${series.title} (ID: ${response.data.id})`);
        successCount++;
      } catch (error) {
        console.log(`❌ ${series.title} - ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully created: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    console.log(`\n🧪 Testing series list...\n`);
    const listResponse = await makeRequest(`/api/recurring/workspace/${workspaceId}`, 'GET', token);
    console.log(`✅ Total recurring series in workspace: ${listResponse.data.length}`);
    
    listResponse.data.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i+1}. ${s.title} - ${s.paused_at ? 'PAUSED' : 'ACTIVE'}`);
    });
    
    console.log(`\n✅ Sample data creation complete!`);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ Failed: ${error.message}`);
    process.exit(1);
  }
}

createSampleData();
