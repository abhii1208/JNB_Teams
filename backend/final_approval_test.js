const http = require('http');

// Test users:
// test001@jnb.com (ID: 7) - Owner of project 20
// test002@jnb.com (ID: 17) - Admin + Tagged Approver in project 20
// test003@jnb.com (ID: 18) - Regular member in project 20

async function login(email, password) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ email, password });
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
        };
        const req = http.request(options, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                const parsed = JSON.parse(body);
                resolve(parsed.token);
            });
        });
        req.write(data);
        req.end();
    });
}

async function getApprovals(token) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/approvals',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        };
        const req = http.request(options, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
        });
        req.end();
    });
}

async function approve(token, approvalId) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: `/api/approvals/${approvalId}/approve`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        };
        const req = http.request(options, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.end();
    });
}

async function reject(token, approvalId, reason) {
    return new Promise((resolve) => {
        const data = JSON.stringify({ rejection_reason: reason });
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: `/api/approvals/${approvalId}/reject`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': data.length }
        };
        const req = http.request(options, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.write(data);
        req.end();
    });
}

async function runFinalTests() {
    console.log('='.repeat(60));
    console.log('FINAL COMPREHENSIVE APPROVAL LOGIC TESTS');
    console.log('='.repeat(60));
    
    // Create fresh test approvals first
    const { pool } = require('./db');
    
    // Get a task from project 20
    const tasks = await pool.query(`SELECT id FROM tasks WHERE project_id = 20 AND deleted_at IS NULL LIMIT 1`);
    const taskId = tasks.rows[0].id;
    
    // Create approval for test002 (requester_id = 17)
    const a1 = await pool.query(`
        INSERT INTO approvals (project_id, task_id, requester_id, status, type, reason, details, created_at)
        VALUES (20, $1, 17, 'Pending', 'task', 'Test', 'test002 approval', NOW())
        RETURNING id
    `, [taskId]);
    const test002ApprovalId = a1.rows[0].id;
    console.log(`Created approval #${test002ApprovalId} for test002`);
    
    // Create approval for test003 (requester_id = 18)
    const a2 = await pool.query(`
        INSERT INTO approvals (project_id, task_id, requester_id, status, type, reason, details, created_at)
        VALUES (20, $1, 18, 'Pending', 'task', 'Test', 'test003 approval', NOW())
        RETURNING id
    `, [taskId]);
    const test003ApprovalId = a2.rows[0].id;
    console.log(`Created approval #${test003ApprovalId} for test003`);
    
    console.log('\n--- TEST 1: test002 (tagged approver) gets approvals ---');
    const token002 = await login('test002@jnb.com', '8143772362');
    const approvals002 = await getApprovals(token002);
    
    const own = approvals002.data.find(a => a.id === test002ApprovalId);
    const other = approvals002.data.find(a => a.id === test003ApprovalId);
    
    console.log(`Own approval #${test002ApprovalId}: can_review=${own?.can_review}`);
    console.log(`Other's approval #${test003ApprovalId}: can_review=${other?.can_review}`);
    
    const test1Pass = own?.can_review === false && other?.can_review === true;
    console.log(test1Pass ? '✅ TEST 1 PASSED' : '❌ TEST 1 FAILED');
    
    console.log('\n--- TEST 2: test002 tries to approve own request ---');
    const result2 = await approve(token002, test002ApprovalId);
    console.log(`Status: ${result2.status}`);
    const test2Pass = result2.status === 403;
    console.log(test2Pass ? '✅ TEST 2 PASSED - Blocked with 403' : '❌ TEST 2 FAILED');
    
    console.log('\n--- TEST 3: test002 tries to reject own request ---');
    const result3 = await reject(token002, test002ApprovalId, 'test');
    console.log(`Status: ${result3.status}`);
    const test3Pass = result3.status === 403;
    console.log(test3Pass ? '✅ TEST 3 PASSED - Blocked with 403' : '❌ TEST 3 FAILED');
    
    console.log('\n--- TEST 4: test002 approves test003\'s request ---');
    const result4 = await approve(token002, test003ApprovalId);
    console.log(`Status: ${result4.status}`);
    const test4Pass = result4.status === 200;
    console.log(test4Pass ? '✅ TEST 4 PASSED - Approved successfully' : '❌ TEST 4 FAILED');
    
    console.log('\n--- TEST 5: Owner (test001) approves test002\'s request ---');
    const token001 = await login('test001@jnb.com', '8143772362');
    const result5 = await approve(token001, test002ApprovalId);
    console.log(`Status: ${result5.status}`);
    const test5Pass = result5.status === 200;
    console.log(test5Pass ? '✅ TEST 5 PASSED - Owner approved tagged user\'s request' : '❌ TEST 5 FAILED');
    
    console.log('\n' + '='.repeat(60));
    const allPassed = test1Pass && test2Pass && test3Pass && test4Pass && test5Pass;
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED! Approval logic is working correctly.');
    } else {
        console.log('❌ SOME TESTS FAILED');
    }
    console.log('='.repeat(60));
    
    // Cleanup - close pool
    await pool.end();
}

runFinalTests();
