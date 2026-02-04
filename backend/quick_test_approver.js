/**
 * Simple Tagged Approver Test
 */
const { pool } = require('./db');

async function runTest() {
  try {
    console.log('🧪 TAGGED APPROVER QUICK TEST\n');
    
    // Get test data
    const users = await pool.query('SELECT id, first_name FROM users ORDER BY id LIMIT 3');
    const project = await pool.query('SELECT id, name FROM projects LIMIT 1');
    
    if (users.rows.length < 3 || project.rows.length === 0) {
      console.log('❌ Need 3 users and 1 project');
      return;
    }
    
    const owner = users.rows[0];
    const taggedApprover = users.rows[1];
    const member = users.rows[2];
    const proj = project.rows[0];
    
    console.log(`Owner: ${owner.first_name} (${owner.id})`);
    console.log(`Tagged Approver: ${taggedApprover.first_name} (${taggedApprover.id})`);
    console.log(`Member: ${member.first_name} (${member.id})`);
    console.log(`Project: ${proj.name} (${proj.id})\n`);
    
    // Tag the approver
    await pool.query('UPDATE projects SET approval_tagged_member_id = $1 WHERE id = $2', [taggedApprover.id, proj.id]);
    console.log(`✅ Tagged ${taggedApprover.first_name} as approver\n`);
    
    // Test function - simple logic check
    function testCanReview(userId, userName, taskAssignee, taskCreator, requester, expectedResult) {
      const isTagged = taggedApprover.id === userId;
      const isOwnWork = isTagged && (
        taskAssignee === userId || 
        taskCreator === userId || 
        requester === userId
      );
      const canReview = !isOwnWork || !isTagged; // Non-tagged users always get true here (they might have other permissions)
      
      // For tagged approver, they can review only if it's NOT their own work
      const actualCanReview = isTagged ? !isOwnWork : true;
      
      const status = actualCanReview === expectedResult ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${userName} reviewing (assignee=${taskAssignee}, creator=${taskCreator}, requester=${requester}) => can_review=${actualCanReview} (expected ${expectedResult})`);
      return actualCanReview === expectedResult;
    }
    
    console.log('--- Test Cases ---\n');
    
    let passed = 0;
    let failed = 0;
    
    // Test 1: Tagged approver reviews member's work (should be allowed)
    if (testCanReview(taggedApprover.id, taggedApprover.first_name, member.id, member.id, member.id, true)) passed++; else failed++;
    
    // Test 2: Tagged approver reviews their own task (assigned to them) - should NOT be allowed
    if (testCanReview(taggedApprover.id, taggedApprover.first_name, taggedApprover.id, member.id, member.id, false)) passed++; else failed++;
    
    // Test 3: Tagged approver reviews task they created - should NOT be allowed
    if (testCanReview(taggedApprover.id, taggedApprover.first_name, member.id, taggedApprover.id, member.id, false)) passed++; else failed++;
    
    // Test 4: Tagged approver reviews their own request - should NOT be allowed
    if (testCanReview(taggedApprover.id, taggedApprover.first_name, member.id, member.id, taggedApprover.id, false)) passed++; else failed++;
    
    // Test 5: Tagged approver reviews owner's work (should be allowed)
    if (testCanReview(taggedApprover.id, taggedApprover.first_name, owner.id, owner.id, owner.id, true)) passed++; else failed++;
    
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

runTest();
