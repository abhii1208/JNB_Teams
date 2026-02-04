require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testAllSearchQueries() {
  try {
    console.log('\n========================================');
    console.log('  TESTING ALL SEARCH QUERIES');
    console.log('========================================\n');

    const workspaceId = 28;
    const userId = 1;
    const searchTerm = 'test';
    const searchPattern = `%${searchTerm}%`;
    const searchLimit = 10;

    // Test 1: Recent Tasks Query
    console.log('1️⃣  Testing Recent Tasks Query...');
    const recentTasks = await pool.query(`
      SELECT 
        t.id, t.name, t.status, t.priority, t.due_date,
        p.name as project_name, p.id as project_id
      FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE p.workspace_id = $1 
        AND t.deleted_at IS NULL 
        AND t.archived_at IS NULL
        AND (t.assignee_id = $2 OR t.created_by = $2)
      ORDER BY t.updated_at DESC
      LIMIT 5
    `, [workspaceId, userId]);
    console.log('   ✅ Recent tasks: ' + recentTasks.rows.length + ' rows');

    // Test 2: Recent Projects Query (FIXED)
    console.log('2️⃣  Testing Recent Projects Query...');
    const recentProjects = await pool.query(`
      SELECT 
        p.id, p.name, p.status,
        NULL as client_name,
        p.updated_at
      FROM projects p
      WHERE p.workspace_id = $1 
        AND p.archived = FALSE
        AND (p.created_by = $2 OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = $2
        ))
      ORDER BY p.updated_at DESC
      LIMIT 5
    `, [workspaceId, userId]);
    console.log('   ✅ Recent projects: ' + recentProjects.rows.length + ' rows');

    // Test 3: Recent Clients Query
    console.log('3️⃣  Testing Recent Clients Query...');
    const recentClients = await pool.query(`
      SELECT c.id, c.client_name, c.series_no, c.status
      FROM clients c
      WHERE c.workspace_id = $1
      ORDER BY c.updated_at DESC
      LIMIT 5
    `, [workspaceId]);
    console.log('   ✅ Recent clients: ' + recentClients.rows.length + ' rows');

    // Test 4: Search Tasks Query
    console.log('4️⃣  Testing Search Tasks Query...');
    const searchTasks = await pool.query(`
      SELECT 
        t.id, t.name, t.description, t.status, t.priority, t.due_date, t.target_date,
        t.completion_percentage, p.name as project_name, p.id as project_id,
        c.client_name, c.id as client_id,
        COALESCE(u.first_name || ' ' || u.last_name, u.username) as assignee_name,
        t.created_at, t.updated_at,
        ts_rank(
          to_tsvector('english', COALESCE(t.name, '') || ' ' || COALESCE(t.description, '')),
          plainto_tsquery('english', $1)
        ) as relevance
      FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE p.workspace_id = $2
        AND t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND (
          t.name ILIKE $3
          OR t.description ILIKE $3
          OR t.id::text = $1
        )
      ORDER BY 
        CASE WHEN t.name ILIKE $4 THEN 0 ELSE 1 END,
        relevance DESC,
        t.updated_at DESC
      LIMIT $5
    `, [searchTerm, workspaceId, searchPattern, `${searchTerm}%`, searchLimit]);
    console.log('   ✅ Search tasks: ' + searchTasks.rows.length + ' rows');

    // Test 5: Search Projects Query
    console.log('5️⃣  Testing Search Projects Query...');
    const searchProjects = await pool.query(`
      SELECT 
        p.id, p.name, p.description, p.status, NULL as client_name, NULL as client_id,
        COALESCE(cb.first_name || ' ' || cb.last_name, cb.username) as owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as task_count,
        p.created_at, p.updated_at
      FROM projects p
      LEFT JOIN users cb ON p.created_by = cb.id
      WHERE p.workspace_id = $1
        AND p.archived = FALSE
        AND (
          p.name ILIKE $2
          OR p.description ILIKE $2
          OR p.id::text = $3
        )
      ORDER BY 
        CASE WHEN p.name ILIKE $4 THEN 0 ELSE 1 END,
        p.updated_at DESC
      LIMIT $5
    `, [workspaceId, searchPattern, searchTerm, `${searchTerm}%`, searchLimit]);
    console.log('   ✅ Search projects: ' + searchProjects.rows.length + ' rows');

    // Test 6: Search Clients Query
    console.log('6️⃣  Testing Search Clients Query...');
    const searchClients = await pool.query(`
      SELECT 
        c.id, c.client_name, c.legal_name, c.series_no, c.client_code, c.status, c.tags,
        (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.deleted_at IS NULL) as task_count,
        c.created_at, c.updated_at
      FROM clients c
      WHERE c.workspace_id = $1
        AND (
          c.client_name ILIKE $2
          OR c.legal_name ILIKE $2
          OR c.series_no ILIKE $2
          OR c.client_code ILIKE $2
          OR c.id::text = $3
        )
      ORDER BY 
        CASE WHEN c.client_name ILIKE $4 THEN 0 ELSE 1 END,
        c.updated_at DESC
      LIMIT $5
    `, [workspaceId, searchPattern, searchTerm, `${searchTerm}%`, searchLimit]);
    console.log('   ✅ Search clients: ' + searchClients.rows.length + ' rows');

    // Test 7: Search Members Query
    console.log('7️⃣  Testing Search Members Query...');
    const searchMembers = await pool.query(`
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, wm.role, u.created_at
      FROM users u
      JOIN workspace_members wm ON u.id = wm.user_id
      WHERE wm.workspace_id = $1
        AND (
          u.username ILIKE $2
          OR u.email ILIKE $2
          OR u.first_name ILIKE $2
          OR u.last_name ILIKE $2
          OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $2
        )
      ORDER BY 
        CASE WHEN u.first_name ILIKE $3 OR u.username ILIKE $3 THEN 0 ELSE 1 END,
        u.first_name, u.last_name
      LIMIT $4
    `, [workspaceId, searchPattern, `${searchTerm}%`, searchLimit]);
    console.log('   ✅ Search members: ' + searchMembers.rows.length + ' rows');

    console.log('\n========================================');
    console.log('  ✅ ALL QUERIES PASSED!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testAllSearchQueries();
