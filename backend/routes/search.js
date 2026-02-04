/**
 * Global Search Routes
 * Unified search across tasks, projects, clients, and team members
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Middleware to check authentication (assumes authenticateToken is applied before this route)
async function requireWorkspaceAccess(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.body.workspaceId;
    
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID required' });
    }

    console.log('[requireWorkspaceAccess] Checking workspace access for userId:', req.userId, 'workspaceId:', workspaceId);

    const result = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.userId]
    );

    console.log('[requireWorkspaceAccess] Query result:', result.rows.length, 'rows');

    if (result.rows.length === 0) {
      console.log('[requireWorkspaceAccess] No workspace access found');
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    req.workspaceRole = result.rows[0].role;
    req.workspaceId = parseInt(workspaceId);
    console.log('[requireWorkspaceAccess] Access granted, role:', req.workspaceRole);
    next();
  } catch (error) {
    console.error('[requireWorkspaceAccess] Error:', error);
    return res.status(500).json({ error: 'Database error checking workspace access' });
  }
}

/**
 * Global Search API
 * GET /api/search?workspaceId=X&q=searchTerm&types=tasks,projects,clients&limit=10
 * 
 * Returns segregated results by category
 */
router.get('/', requireWorkspaceAccess, async (req, res) => {
  try {
    const { q, types, limit = 10 } = req.query;
    const workspaceId = req.workspaceId;
    const userId = req.userId;
    const searchLimit = Math.min(parseInt(limit) || 10, 50);
    
    console.log('[Search] Query:', q, 'WorkspaceId:', workspaceId, 'UserId:', userId);
    
    if (!q || q.trim().length < 1) {
      return res.json({
        tasks: [],
        projects: [],
        clients: [],
        members: [],
        total: 0,
        query: '',
      });
    }

    const searchTerm = q.trim();
    const searchPattern = `%${searchTerm}%`;
    const searchTypes = types ? types.split(',') : ['tasks', 'projects', 'clients', 'members'];

    const results = {
      tasks: [],
      projects: [],
      clients: [],
      members: [],
      query: searchTerm,
    };

    // Search Tasks - tasks belong to projects, and projects have workspace_id
    if (searchTypes.includes('tasks')) {
      const tasksQuery = `
        SELECT 
          t.id,
          t.name,
          t.description,
          t.status,
          t.priority,
          t.due_date,
          t.target_date,
          t.completion_percentage,
          p.name as project_name,
          p.id as project_id,
          c.client_name,
          c.id as client_id,
          COALESCE(u.first_name || ' ' || u.last_name, u.username) as assignee_name,
          t.created_at,
          t.updated_at,
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
      `;
      
      const tasksResult = await pool.query(tasksQuery, [
        searchTerm,
        workspaceId,
        searchPattern,
        `${searchTerm}%`,
        searchLimit
      ]);
      
      console.log('[Search] Tasks found:', tasksResult.rows.length);
      
      results.tasks = tasksResult.rows.map(task => ({
        id: task.id,
        name: task.name,
        description: task.description?.substring(0, 100),
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        target_date: task.target_date,
        completion_percentage: task.completion_percentage,
        project_name: task.project_name,
        project_id: task.project_id,
        client_name: task.client_name,
        client_id: task.client_id,
        assignee_name: task.assignee_name,
        type: 'task',
      }));
    }

    // Search Projects
    if (searchTypes.includes('projects')) {
      const projectsQuery = `
        SELECT 
          p.id,
          p.name,
          p.description,
          p.status,
          NULL as client_name,
          NULL as client_id,
          COALESCE(cb.first_name || ' ' || cb.last_name, cb.username) as owner_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as task_count,
          p.created_at,
          p.updated_at
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
      `;
      
      const projectsResult = await pool.query(projectsQuery, [
        workspaceId,
        searchPattern,
        searchTerm,
        `${searchTerm}%`,
        searchLimit
      ]);
      
      results.projects = projectsResult.rows.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description?.substring(0, 100),
        status: project.status,
        client_name: project.client_name,
        client_id: project.client_id,
        owner_name: project.owner_name,
        task_count: parseInt(project.task_count) || 0,
        type: 'project',
      }));
    }

    // Search Clients
    if (searchTypes.includes('clients')) {
      const clientsQuery = `
        SELECT 
          c.id,
          c.client_name,
          c.legal_name,
          c.series_no,
          c.client_code,
          c.status,
          c.tags,
          (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.deleted_at IS NULL) as task_count,
          c.created_at,
          c.updated_at
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
      `;
      
      const clientsResult = await pool.query(clientsQuery, [
        workspaceId,
        searchPattern,
        searchTerm,
        `${searchTerm}%`,
        searchLimit
      ]);
      
      console.log('[Search] Clients found:', clientsResult.rows.length);
      
      results.clients = clientsResult.rows.map(client => ({
        id: client.id,
        client_name: client.client_name,
        legal_name: client.legal_name,
        series_no: client.series_no,
        client_code: client.client_code,
        status: client.status,
        tags: client.tags,
        task_count: parseInt(client.task_count) || 0,
        type: 'client',
      }));
    }

    // Search Team Members
    if (searchTypes.includes('members')) {
      const membersQuery = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.first_name,
          u.last_name,
          wm.role,
          u.created_at
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
      `;
      
      const membersResult = await pool.query(membersQuery, [
        workspaceId,
        searchPattern,
        `${searchTerm}%`,
        searchLimit
      ]);
      
      results.members = membersResult.rows.map(member => ({
        id: member.id,
        username: member.username,
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        full_name: member.first_name && member.last_name 
          ? `${member.first_name} ${member.last_name}` 
          : member.username,
        role: member.role,
        type: 'member',
      }));
    }

    results.total = results.tasks.length + results.projects.length + 
                    results.clients.length + results.members.length;

    res.json(results);
  } catch (err) {
    console.error('Global search error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

/**
 * Recent items for quick access (no search query)
 * GET /api/search/recent?workspaceId=X
 */
router.get('/recent', requireWorkspaceAccess, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const userId = req.userId;

    // Get recently accessed/updated items
    const [recentTasks, recentProjects, recentClients] = await Promise.all([
      // Recent tasks (assigned to user or recently updated) - tasks belong to projects
      pool.query(`
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
      `, [workspaceId, userId]),

      // Recent projects (user is member of)
      pool.query(`
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
      `, [workspaceId, userId]),

      // Recent clients (no deleted_at column in clients table)
      pool.query(`
        SELECT c.id, c.client_name, c.series_no, c.status
        FROM clients c
        WHERE c.workspace_id = $1
        ORDER BY c.updated_at DESC
        LIMIT 5
      `, [workspaceId]),
    ]);

    res.json({
      tasks: recentTasks.rows.map(t => ({ ...t, type: 'task' })),
      projects: recentProjects.rows.map(p => ({ ...p, type: 'project' })),
      clients: recentClients.rows.map(c => ({ ...c, type: 'client' })),
    });
  } catch (err) {
    console.error('Recent items error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch recent items' });
  }
});

module.exports = router;
