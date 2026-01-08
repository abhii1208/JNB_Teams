/**
 * Recurring Module API Test Script
 * Tests all recurring endpoints with sample data
 * 
 * Usage: node test_recurring_api.js
 */

const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // Set this from login response

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Helper for HTTP requests
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/');
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(TEST_TOKEN && { 'Authorization': `Bearer ${TEST_TOKEN}` })
            }
        };

        const req = lib.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ status: res.statusCode, data: json });
                    } else {
                        resolve({ status: res.statusCode, error: json });
                    }
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Test helpers
let passed = 0;
let failed = 0;
let createdSeriesId = null;

function log(type, message) {
    const color = type === 'PASS' ? colors.green : type === 'FAIL' ? colors.red : type === 'INFO' ? colors.blue : colors.yellow;
    console.log(`${color}[${type}]${colors.reset} ${message}`);
}

async function test(name, fn) {
    try {
        await fn();
        passed++;
        log('PASS', name);
    } catch (err) {
        failed++;
        log('FAIL', `${name}: ${err.message}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

// Test Data
const sampleSeries = {
    title: 'Weekly Team Meeting',
    description: 'Regular sync-up meeting every Monday at 10 AM',
    recurrence_rule: {
        frequency: 'weekly',
        interval: 1,
        byDayOfWeek: ['MO'],
        timeOfDay: '10:00'
    },
    start_date: new Date().toISOString().split('T')[0],
    timezone: 'America/New_York',
    lead_days: 3,
    assignment_strategy: 'fixed',
    requires_approval: false
};

const dailySeries = {
    title: 'Daily Standup',
    description: 'Daily standup at 9 AM',
    recurrence_rule: {
        frequency: 'daily',
        interval: 1,
        timeOfDay: '09:00'
    },
    start_date: new Date().toISOString().split('T')[0],
    timezone: 'UTC',
    lead_days: 1,
    assignment_strategy: 'fixed'
};

const monthlySeries = {
    title: 'Monthly Report',
    description: 'Generate monthly analytics report',
    recurrence_rule: {
        frequency: 'monthly',
        interval: 1,
        byMonthDay: [1],
        timeOfDay: '08:00'
    },
    start_date: new Date().toISOString().split('T')[0],
    timezone: 'America/Los_Angeles',
    lead_days: 5,
    assignment_strategy: 'fixed',
    auto_close_after_days: 7
};

// Run Tests
async function runTests() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Recurring Module API Test Suite     ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    log('INFO', `Base URL: ${BASE_URL}`);
    console.log('');

    // Health check
    await test('Health check - GET /recurring', async () => {
        const res = await request('GET', 'recurring');
        assert(res.status === 200 || res.status === 401, `Expected 200 or 401, got ${res.status}`);
    });

    // Create series
    await test('Create recurring series - POST /recurring', async () => {
        const res = await request('POST', 'recurring', sampleSeries);
        assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.error)}`);
        assert(res.data.id, 'Response should contain id');
        createdSeriesId = res.data.id;
        log('INFO', `Created series ID: ${createdSeriesId}`);
    });

    // List series
    await test('List all series - GET /recurring', async () => {
        const res = await request('GET', 'recurring');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data), 'Response should be an array');
    });

    // Get single series
    if (createdSeriesId) {
        await test('Get series by ID - GET /recurring/:id', async () => {
            const res = await request('GET', `recurring/${createdSeriesId}`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.data.title === sampleSeries.title, 'Title should match');
        });

        // Preview dates
        await test('Preview next occurrences - POST /recurring/:id/preview', async () => {
            const res = await request('POST', `recurring/${createdSeriesId}/preview`, { count: 5 });
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(Array.isArray(res.data.dates), 'Should return dates array');
        });

        // Update series
        await test('Update series - PUT /recurring/:id', async () => {
            const res = await request('PUT', `recurring/${createdSeriesId}`, {
                title: 'Weekly Team Meeting - Updated',
                scope: 'this_and_future'
            });
            assert(res.status === 200, `Expected 200, got ${res.status}`);
        });

        // Pause series
        await test('Pause series - POST /recurring/:id/pause', async () => {
            const res = await request('POST', `recurring/${createdSeriesId}/pause`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
        });

        // Resume series
        await test('Resume series - POST /recurring/:id/resume', async () => {
            const res = await request('POST', `recurring/${createdSeriesId}/resume`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
        });

        // Add exception
        const exceptionDate = new Date();
        exceptionDate.setDate(exceptionDate.getDate() + 14);
        const exceptionDateStr = exceptionDate.toISOString().split('T')[0];

        await test('Add exception - POST /recurring/:id/exception', async () => {
            const res = await request('POST', `recurring/${createdSeriesId}/exception`, {
                original_date: exceptionDateStr,
                exception_type: 'skip',
                reason: 'Holiday'
            });
            assert(res.status === 201 || res.status === 200, `Expected 201 or 200, got ${res.status}`);
        });

        // List exceptions
        await test('List exceptions - GET /recurring/:id (with exceptions)', async () => {
            const res = await request('GET', `recurring/${createdSeriesId}`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            // Exceptions may be in res.data.exceptions
        });

        // Remove exception
        await test('Remove exception - DELETE /recurring/:id/exception/:date', async () => {
            const res = await request('DELETE', `recurring/${createdSeriesId}/exception/${exceptionDateStr}`);
            assert(res.status === 200 || res.status === 204, `Expected 200 or 204, got ${res.status}`);
        });

        // Generate instances manually
        await test('Generate instances - POST /recurring/:id/generate', async () => {
            const res = await request('POST', `recurring/${createdSeriesId}/generate`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            log('INFO', `Generated ${res.data.generated || 0} instances`);
        });

        // Get audit log
        await test('Get audit log - GET /recurring/:id/audit', async () => {
            const res = await request('GET', `recurring/${createdSeriesId}/audit`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
        });

        // Delete series
        await test('Delete series - DELETE /recurring/:id', async () => {
            const res = await request('DELETE', `recurring/${createdSeriesId}`);
            assert(res.status === 200 || res.status === 204, `Expected 200 or 204, got ${res.status}`);
        });

        // Verify deletion
        await test('Verify deletion - GET /recurring/:id should fail', async () => {
            const res = await request('GET', `recurring/${createdSeriesId}`);
            assert(res.status === 404, `Expected 404, got ${res.status}`);
        });
    }

    // Summary
    console.log('');
    console.log('════════════════════════════════════════');
    console.log(`  Results: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}`);
    console.log('════════════════════════════════════════');

    process.exit(failed > 0 ? 1 : 0);
}

// Run
runTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
