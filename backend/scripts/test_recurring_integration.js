/**
 * Quick Integration Test for Recurring Module
 * Run with: node test_recurring_integration.js
 */

require('dotenv').config();
const http = require('http');

const BASE = 'http://localhost:5000/api';
let authToken = null;

// Helper for HTTP requests
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE + '/');
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(type, msg) {
    const c = type === '✓' ? colors.green : type === '✗' ? colors.red : colors.blue;
    console.log(`${c}${type}${colors.reset} ${msg}`);
}

async function run() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  Recurring Module Integration Test       ║');
    console.log('╚══════════════════════════════════════════╝\n');

    try {
        // 1. Login
        log('→', 'Logging in...');
        const loginRes = await request('POST', 'login', {
            email: 'default@local.test',
            password: 'testpass123'
        });
        
        if (loginRes.status !== 200 || !loginRes.data.token) {
            log('✗', 'Login failed. Response: ' + JSON.stringify(loginRes.data));
            console.log('\n⚠️  Please check credentials and try again');
            process.exit(1);
        }
        
        authToken = loginRes.data.token;
        log('✓', `Logged in as: ${loginRes.data.user?.email || 'user'}`);


        // 2. List recurring series (need workspace ID)
        log('→', 'Fetching recurring series for workspace 1...');
        const listRes = await request('GET', 'recurring/workspace/1');
        if (listRes.status === 200) {
            log('✓', `Found ${listRes.data.length || 0} recurring series`);
            if (listRes.data.length > 0) {
                console.log('   Sample series:');
                listRes.data.slice(0, 3).forEach(s => {
                    console.log(`   - [${s.id}] ${s.title}`);
                });
            }
        } else {
            log('✗', `List failed: ${listRes.status} - ${JSON.stringify(listRes.data)}`);
        }

        // 3. Create a new series
        log('→', 'Creating new recurring series...');
        const createRes = await request('POST', 'recurring', {
            title: 'Test Integration Series',
            description: 'Created by integration test',
            recurrence_rule: {
                freq: 'WEEKLY',
                interval: 1,
                byday: ['MO', 'WE', 'FR']
            },
            start_date: new Date().toISOString().split('T')[0],
            timezone: 'UTC',
            assignment_strategy: 'static',
            workspace_id: 1
        });

        if (createRes.status === 201) {
            log('✓', `Created series ID: ${createRes.data.id}`);
            const seriesId = createRes.data.id;

            // 4. Get series details
            log('→', 'Fetching series details...');
            const detailRes = await request('GET', `recurring/${seriesId}`);
            if (detailRes.status === 200) {
                log('✓', `Got details: ${detailRes.data.title}`);
            }

            // 5. Preview occurrences
            log('→', 'Previewing next occurrences...');
            const previewRes = await request('POST', `recurring/${seriesId}/preview`, { count: 5 });
            if (previewRes.status === 200) {
                log('✓', `Next ${previewRes.data.dates?.length || 0} dates: ${(previewRes.data.dates || []).join(', ')}`);
            }

            // 6. Pause and resume
            log('→', 'Testing pause/resume...');
            const pauseRes = await request('POST', `recurring/${seriesId}/pause`);
            if (pauseRes.status === 200) {
                log('✓', 'Paused successfully');
            }
            
            const resumeRes = await request('POST', `recurring/${seriesId}/resume`);
            if (resumeRes.status === 200) {
                log('✓', 'Resumed successfully');
            }

            // 7. Add exception
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const exDate = nextWeek.toISOString().split('T')[0];
            
            log('→', `Adding skip exception for ${exDate}...`);
            const excRes = await request('POST', `recurring/${seriesId}/exception`, {
                original_date: exDate,
                exception_type: 'skip',
                reason: 'Test exception'
            });
            if (excRes.status === 201 || excRes.status === 200) {
                log('✓', 'Exception added');
            }

            // 8. Manual generate
            log('→', 'Manually generating instances...');
            const genRes = await request('POST', `recurring/${seriesId}/generate`);
            if (genRes.status === 200) {
                log('✓', `Generated ${genRes.data.generated || 0} instances`);
            }

            // 9. Delete test series
            log('→', 'Cleaning up test series...');
            const delRes = await request('DELETE', `recurring/${seriesId}`);
            if (delRes.status === 200 || delRes.status === 204) {
                log('✓', 'Test series deleted');
            }

        } else {
            log('✗', `Create failed: ${createRes.status} - ${JSON.stringify(createRes.data)}`);
        }

        console.log('\n════════════════════════════════════════════');
        console.log(`${colors.green}✓ All integration tests completed!${colors.reset}`);
        console.log('════════════════════════════════════════════\n');

    } catch (err) {
        console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
        process.exit(1);
    }
}

run();
