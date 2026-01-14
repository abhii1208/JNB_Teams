const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Middleware to check if user is Owner or Admin
async function checkAdminAccess(req, res, next) {
  try {
    const { workspaceId } = req.params;
    
    // Cast workspaceId to integer to prevent type mismatch
    const workspaceIdInt = parseInt(workspaceId, 10);
    if (isNaN(workspaceIdInt)) {
      return res.status(400).json({ error: 'Invalid workspace ID' });
    }
    
    const result = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceIdInt, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    
    const role = result.rows[0].role;
    if (!['Owner', 'Admin'].includes(role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.workspaceRole = role;
    next();
  } catch (err) {
    console.error('Check admin access error:', err);
    res.status(500).json({ error: 'Access check failed' });
  }
}

// Helper function to convert UTC timestamp to IST date (YYYY-MM-DD)
function toISTDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  // Add 5:30 hours for IST
  date.setHours(date.getHours() + 5);
  date.setMinutes(date.getMinutes() + 30);
  return date.toISOString().split('T')[0];
}

// Get today in IST (YYYY-MM-DD)
function getTodayIST() {
  const now = new Date();
  now.setHours(now.getHours() + 5);
  now.setMinutes(now.getMinutes() + 30);
  return now.toISOString().split('T')[0];
}

// ============================================
// Admin → Projects Tab
// ============================================

// GET /admin/:workspaceId/projects
// Returns all projects with metrics
router.get('/:workspaceId/projects', checkAdminAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const {
      date_from,
      date_to,
      include_archived = 'false'
    } = req.query;

    const today = getTodayIST();
    
    // Build date filter for completed tasks
    let completedDateFilter = '';
    const params = [workspaceId];
    
    if (date_from && date_to) {
      completedDateFilter = `AND (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(date_from, date_to);
    } else if (date_from) {
      completedDateFilter = `AND (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length + 1}`;
      params.push(date_from);
    } else if (date_to) {
      completedDateFilter = `AND (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length + 1}`;
      params.push(date_to);
    }

    const todayParam = params.length + 1;
    params.push(today);

    const archivedFilter = include_archived === 'true' ? '' : 'AND p.archived_at IS NULL';

    const query = `
      SELECT 
        p.id,
        p.name,
        p.icon,
        p.color,
        p.status,
        p.created_at,
        p.archived_at,
        u.first_name || ' ' || u.last_name as owner_name,
        u.id as owner_id,
        
        -- Total tasks
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as total_tasks,
        
        -- Open tasks
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'Completed' AND t.deleted_at IS NULL) as open_tasks,
        
        -- Completed tasks (in date range)
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND t.status = 'Completed' 
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as completed_tasks,
        
        -- Target metrics
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as on_target_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as late_vs_target_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND t.status != 'Completed'
         AND t.target_date IS NOT NULL
         AND t.target_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as target_overdue_open,
        
        -- Due metrics
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND t.status = 'Completed'
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as on_due_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND t.status = 'Completed'
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as late_vs_due_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND t.status != 'Completed'
         AND t.due_date IS NOT NULL
         AND t.due_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as due_overdue_open,
        
        -- Combined metrics
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as recovered,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = p.id 
         AND ((t.status = 'Completed' AND t.due_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date)
              OR (t.status != 'Completed' AND t.due_date IS NOT NULL AND t.due_date < $${todayParam}))
         AND t.deleted_at IS NULL
         ${date_from || date_to ? completedDateFilter.replace('AND', 'AND (t.status != \'Completed\' OR') + ')' : ''}
        ) as critical_late,
        
        -- Team members (avatars)
        (SELECT json_agg(json_build_object(
          'id', u2.id,
          'name', u2.first_name || ' ' || u2.last_name,
          'avatar', SUBSTRING(u2.first_name, 1, 1) || SUBSTRING(u2.last_name, 1, 1)
        ))
         FROM project_members pm2
         JOIN users u2 ON pm2.user_id = u2.id
         WHERE pm2.project_id = p.id
         LIMIT 10
        ) as team_members,
        
        (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) as team_size
        
      FROM projects p
      JOIN users u ON p.created_by = u.id
      WHERE p.workspace_id = $1
      ${archivedFilter}
      ORDER BY p.created_at DESC
    `;

    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get admin projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects', details: err.message });
  }
});

// GET /admin/:workspaceId/projects/:projectId/team-metrics
// Returns team metrics for a specific project
router.get('/:workspaceId/projects/:projectId/team-metrics', checkAdminAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { date_from, date_to } = req.query;
    
    // Cast projectId to integer to prevent type mismatch
    const projectIdInt = parseInt(projectId, 10);
    if (isNaN(projectIdInt)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }Int
    
    const today = getTodayIST();
    
    // Build date filter
    let completedDateFilter = '';
    const params = [projectId];
    
    if (date_from && date_to) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(date_from, date_to);
    } else if (date_from) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length + 1}`;
      params.push(date_from);
    } else if (date_to) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length + 1}`;
      params.push(date_to);
    }

    const todayParam = params.length + 1;
    params.push(today);

    // Get project summary
    const projectQuery = `
      SELECT 
        p.id,
        p.name,
        p.icon,
        p.color,
        u.first_name || ' ' || u.last_name as owner_name,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as team_size,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'Completed' AND deleted_at IS NULL) as open_tasks,
        (SELECT COUNT(*) FROM tasks 
         WHERE project_id = p.id 
         AND status = 'Completed' 
         AND deleted_at IS NULL
         ${completedDateFilter}
        ) as completed_tasks,
        (SELECT COUNT(*) FROM tasks 
         WHERE project_id = p.id 
         AND status != 'Completed'
         AND target_date IS NOT NULL
         AND target_date < $${todayParam}
         AND deleted_at IS NULL
        ) as target_overdue_open,
        (SELECT COUNT(*) FROM tasks 
         WHERE project_id = p.id 
         AND status != 'Completed'
         AND due_date IS NOT NULL
         AND due_date < $${todayParam}
         AND deleted_at IS NULL
        ) as due_overdue_open,
        (SELECT COUNT(*) FROM tasks 
         WHERE project_id = p.id 
         AND ((status = 'Completed' AND due_date IS NOT NULL AND (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > due_date)
              OR (status != 'Completed' AND due_date IS NOT NULL AND due_date < $${todayParam}))
         AND deleted_at IS NULL
        ) as critical_late
      FROM projects p
      JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `;
    
    const projectResult = await pool.query(projectQuery, params);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get member metrics
    const memberQuery = `
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as name,
        SUBSTRING(u.first_name, 1, 1) || SUBSTRING(u.last_name, 1, 1) as avatar,
        pm.role,
        
        -- Tasks assigned (open)
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status != 'Completed'
         AND t.deleted_at IS NULL
        ) as assigned_open,
        
        -- Completed (range)
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status = 'Completed'
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as completed,
        
        -- Target metrics
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as on_target_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as late_vs_target_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status != 'Completed'
         AND t.target_date IS NOT NULL
         AND t.target_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as target_overdue_open,
        
        -- Due metrics
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status = 'Completed'
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as on_due_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status = 'Completed'
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as late_vs_due_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status != 'Completed'
         AND t.due_date IS NOT NULL
         AND t.due_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as due_overdue_open,
        
        -- Combined metrics
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as recovered,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND ((t.status = 'Completed' AND t.due_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date)
              OR (t.status != 'Completed' AND t.due_date IS NOT NULL AND t.due_date < $${todayParam}))
         AND t.deleted_at IS NULL
        ) as critical_late,
        
        -- Avg slippage days (optional - for completed with target date)
        (SELECT COALESCE(AVG(
          (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date - t.target_date
        ), 0)
         FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as avg_slippage_days
        
        -- Target compliance %
        ,(SELECT CASE 
          WHEN SUM(CASE WHEN t.target_date IS NOT NULL AND t.status = 'Completed' THEN 1 ELSE 0 END) > 0
          THEN ROUND(
            (SUM(CASE WHEN t.target_date IS NOT NULL AND t.status = 'Completed' AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.target_date THEN 1 ELSE 0 END)::numeric / 
             SUM(CASE WHEN t.target_date IS NOT NULL AND t.status = 'Completed' THEN 1 ELSE 0 END)::numeric) * 100, 1
          )
          ELSE NULL
         END
         FROM tasks t
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as target_compliance_pct
        
        -- Due compliance %
        ,(SELECT CASE 
          WHEN SUM(CASE WHEN t.due_date IS NOT NULL AND t.status = 'Completed' THEN 1 ELSE 0 END) > 0
          THEN ROUND(
            (SUM(CASE WHEN t.due_date IS NOT NULL AND t.status = 'Completed' AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date THEN 1 ELSE 0 END)::numeric / 
             SUM(CASE WHEN t.due_date IS NOT NULL AND t.status = 'Completed' THEN 1 ELSE 0 END)::numeric) * 100, 1
          )
          ELSE NULL
         END
         FROM tasks t
         WHERE t.project_id = $1 
         AND t.assignee_id = u.id 
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as due_compliance_pct
        
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY assigned_open DESC, critical_late DESC
    `;

    const memberResult = await pool.query(memberQuery, params);
    
    // Get unassigned tasks metrics
    const unassignedQuery = `
      SELECT 
        'Unassigned' as name,
        'UN' as avatar,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id IS NULL 
         AND t.status != 'Completed'
         AND t.deleted_at IS NULL
        ) as assigned_open,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id IS NULL 
         AND t.status = 'Completed'
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as completed,
        
        0 as on_target_completed,
        0 as late_vs_target_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id IS NULL 
         AND t.status != 'Completed'
         AND t.target_date IS NOT NULL
         AND t.target_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as target_overdue_open,
        
        0 as on_due_completed,
        0 as late_vs_due_completed,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id IS NULL 
         AND t.status != 'Completed'
         AND t.due_date IS NOT NULL
         AND t.due_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as due_overdue_open,
        
        0 as recovered,
        
        (SELECT COUNT(*) FROM tasks t 
         WHERE t.project_id = $1 
         AND t.assignee_id IS NULL 
         AND t.status != 'Completed'
         AND t.due_date IS NOT NULL
         AND t.due_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as critical_late,
        
        0 as avg_slippage_days
    `;

    const unassignedResult = await pool.query(unassignedQuery, params);
    
    res.json({
      project: projectResult.rows[0],
      members: [...memberResult.rows, ...unassignedResult.rows]
    });
  } catch (err) {
    console.error('Get project team metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch team metrics', details: err.message });
  }
});

// ============================================
// Admin → Team Tab
// ============================================

// GET /admin/:workspaceId/team
// Returns all team members with metrics
router.get('/:workspaceId/team', checkAdminAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { date_from, date_to } = req.query;
    
    const today = getTodayIST();
    
    // Build date filter
    let completedDateFilter = '';
    let createdDateFilter = '';
    const params = [workspaceId];
    
    if (date_from && date_to) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      createdDateFilter = `AND (t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(date_from, date_to);
    } else if (date_from) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length + 1}`;
      createdDateFilter = `AND (t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length + 1}`;
      params.push(date_from);
    } else if (date_to) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length + 1}`;
      createdDateFilter = `AND (t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length + 1}`;
      params.push(date_to);
    }

    const todayParam = params.length + 1;
    params.push(today);

    const query = `
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as name,
        SUBSTRING(u.first_name, 1, 1) || SUBSTRING(u.last_name, 1, 1) as avatar,
        wm.role,
        'Active' as status,
        
        -- Project involvement
        (SELECT COUNT(DISTINCT pm.project_id) 
         FROM project_members pm
         JOIN projects p ON pm.project_id = p.id
         WHERE pm.user_id = u.id 
         AND p.workspace_id = $1
         AND p.archived_at IS NULL
        ) as projects_involved,
        
        (SELECT COUNT(*) 
         FROM projects p
         WHERE p.created_by = u.id 
         AND p.workspace_id = $1
         AND p.archived_at IS NULL
        ) as projects_owned,
        
        -- Tasks created (range)
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.created_by = u.id 
         AND p.workspace_id = $1
         AND t.deleted_at IS NULL
         ${createdDateFilter}
        ) as tasks_created,
        
        -- Tasks assigned (open)
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status != 'Completed'
         AND t.deleted_at IS NULL
        ) as assigned_open,
        
        -- Tasks completed (range)
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as completed,
        
        -- Target metrics
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as on_target_completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as late_vs_target_completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status != 'Completed'
         AND t.target_date IS NOT NULL
         AND t.target_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as target_overdue_open,
        
        -- Target compliance %
        (SELECT CASE 
          WHEN SUM(CASE WHEN t.target_date IS NOT NULL AND t.status = 'Completed' THEN 1 ELSE 0 END) > 0
          THEN ROUND(
            (SUM(CASE WHEN t.target_date IS NOT NULL AND t.status = 'Completed' AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.target_date THEN 1 ELSE 0 END)::numeric / 
             SUM(CASE WHEN t.target_date IS NOT NULL AND t.status = 'Completed' THEN 1 ELSE 0 END)::numeric) * 100, 1
          )
          ELSE NULL
         END
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as target_compliance_pct,
        
        -- Due metrics
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as on_due_completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as late_vs_due_completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status != 'Completed'
         AND t.due_date IS NOT NULL
         AND t.due_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as due_overdue_open,
        
        -- Due compliance %
        (SELECT CASE 
          WHEN SUM(CASE WHEN t.due_date IS NOT NULL AND t.status = 'Completed' THEN 1 ELSE 0 END) > 0
          THEN ROUND(
            (SUM(CASE WHEN t.due_date IS NOT NULL AND t.status = 'Completed' AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date THEN 1 ELSE 0 END)::numeric / 
             SUM(CASE WHEN t.due_date IS NOT NULL AND t.status = 'Completed' THEN 1 ELSE 0 END)::numeric) * 100, 1
          )
          ELSE NULL
         END
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as due_compliance_pct,
        
        -- Combined metrics
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as recovered,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND ((t.status = 'Completed' AND t.due_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date)
              OR (t.status != 'Completed' AND t.due_date IS NOT NULL AND t.due_date < $${todayParam}))
         AND t.deleted_at IS NULL
        ) as critical_late,
        
        -- Avg slippage days
        (SELECT COALESCE(AVG(
          (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date - t.target_date
        ), 0)
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as avg_slippage_days,
        
        -- Missing dates %
        (SELECT ROUND(
          (SUM(CASE WHEN t.target_date IS NULL THEN 1 ELSE 0 END)::numeric /
           NULLIF(COUNT(*), 0)) * 100, 1
        )
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.deleted_at IS NULL
        ) as no_target_date_pct,
        
        (SELECT ROUND(
          (SUM(CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END)::numeric /
           NULLIF(COUNT(*), 0)) * 100, 1
        )
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.deleted_at IS NULL
        ) as no_due_date_pct
        
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1
      ORDER BY due_overdue_open DESC, critical_late DESC, assigned_open DESC
    `;

    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get admin team error:', err);
    res.status(500).json({ error: 'Failed to fetch team metrics', details: err.message });
  }
});

// GET /admin/:workspaceId/team/:userId/details
// Returns detailed metrics for a specific user
router.get('/:workspaceId/team/:userId/details', checkAdminAccess, async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const { date_from, date_to } = req.query;
    
    const today = getTodayIST();
    
    // Build date filter
    let completedDateFilter = '';
    const params = [workspaceId, userId];
    
    if (date_from && date_to) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(date_from, date_to);
    } else if (date_from) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length + 1}`;
      params.push(date_from);
    } else if (date_to) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length + 1}`;
      params.push(date_to);
    }

    const todayParam = params.length + 1;
    params.push(today);

    // Get user summary
    const summaryQuery = `
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as name,
        SUBSTRING(u.first_name, 1, 1) || SUBSTRING(u.last_name, 1, 1) as avatar,
        wm.role,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status != 'Completed'
         AND t.deleted_at IS NULL
        ) as assigned_open,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as on_target_completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as late_vs_target_completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status != 'Completed'
         AND t.target_date IS NOT NULL
         AND t.target_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as target_overdue_open,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as on_due_completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as late_vs_due_completed,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status != 'Completed'
         AND t.due_date IS NOT NULL
         AND t.due_date < $${todayParam}
         AND t.deleted_at IS NULL
        ) as due_overdue_open,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND t.status = 'Completed'
         AND t.target_date IS NOT NULL
         AND t.due_date IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
         AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date
         AND t.deleted_at IS NULL
         ${completedDateFilter}
        ) as recovered,
        
        (SELECT COUNT(*) 
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assignee_id = u.id 
         AND p.workspace_id = $1
         AND ((t.status = 'Completed' AND t.due_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date)
              OR (t.status != 'Completed' AND t.due_date IS NOT NULL AND t.due_date < $${todayParam}))
         AND t.deleted_at IS NULL
        ) as critical_late
        
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1 AND u.id = $2
    `;

    const summaryResult = await pool.query(summaryQuery, params);
    if (summaryResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in workspace' });
    }

    // Get task lists for drilldowns
    const targetOverdueQuery = `
      SELECT t.id, t.name, p.name as project_name, p.color, t.target_date, t.priority
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = $2
      AND p.workspace_id = $1
      AND t.status != 'Completed'
      AND t.target_date IS NOT NULL
      AND t.target_date < $${todayParam}
      AND t.deleted_at IS NULL
      ORDER BY t.target_date ASC
      LIMIT 20
    `;

    const dueOverdueQuery = `
      SELECT t.id, t.name, p.name as project_name, p.color, t.due_date, t.priority
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = $2
      AND p.workspace_id = $1
      AND t.status != 'Completed'
      AND t.due_date IS NOT NULL
      AND t.due_date < $${todayParam}
      AND t.deleted_at IS NULL
      ORDER BY t.due_date ASC
      LIMIT 20
    `;

    const completedLateTargetQuery = `
      SELECT t.id, t.name, p.name as project_name, p.color, t.target_date, t.completed_at,
        (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date - t.target_date as days_late
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = $2
      AND p.workspace_id = $1
      AND t.status = 'Completed'
      AND t.target_date IS NOT NULL
      AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date
      AND t.deleted_at IS NULL
      ${completedDateFilter}
      ORDER BY days_late DESC
      LIMIT 20
    `;

    const completedLateDueQuery = `
      SELECT t.id, t.name, p.name as project_name, p.color, t.due_date, t.completed_at,
        (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date - t.due_date as days_late
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = $2
      AND p.workspace_id = $1
      AND t.status = 'Completed'
      AND t.due_date IS NOT NULL
      AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date
      AND t.deleted_at IS NULL
      ${completedDateFilter}
      ORDER BY days_late DESC
      LIMIT 20
    `;

    const recentlyCompletedQuery = `
      SELECT t.id, t.name, p.name as project_name, p.color, t.completed_at
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = $2
      AND p.workspace_id = $1
      AND t.status = 'Completed'
      AND t.deleted_at IS NULL
      ${completedDateFilter}
      ORDER BY t.completed_at DESC
      LIMIT 20
    `;

    const [targetOverdue, dueOverdue, completedLateTarget, completedLateDue, recentlyCompleted] = await Promise.all([
      pool.query(targetOverdueQuery, params),
      pool.query(dueOverdueQuery, params),
      pool.query(completedLateTargetQuery, params),
      pool.query(completedLateDueQuery, params),
      pool.query(recentlyCompletedQuery, params)
    ]);

    res.json({
      summary: summaryResult.rows[0],
      drilldowns: {
        target_overdue_open: targetOverdue.rows,
        due_overdue_open: dueOverdue.rows,
        completed_late_target: completedLateTarget.rows,
        completed_late_due: completedLateDue.rows,
        recently_completed: recentlyCompleted.rows
      }
    });
  } catch (err) {
    console.error('Get member details error:', err);
    res.status(500).json({ error: 'Failed to fetch member details', details: err.message });
  }
});

// GET /admin/:workspaceId/projects/:projectId/tasks
// Returns filtered task list for project drilldowns
router.get('/:workspaceId/projects/:projectId/tasks', checkAdminAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { metric, assignee_id, date_from, date_to } = req.query;
    
    const today = getTodayIST();
    const params = [projectId];
    
    let completedDateFilter = '';
    if (date_from && date_to) {
      completedDateFilter = `AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(date_from, date_to);
    }

    const todayParam = params.length + 1;
    params.push(today);

    let metricFilter = '';
    if (metric === 'on_target_completed') {
      metricFilter = `AND t.status = 'Completed' AND t.target_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.target_date ${completedDateFilter}`;
    } else if (metric === 'late_vs_target_completed') {
      metricFilter = `AND t.status = 'Completed' AND t.target_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date ${completedDateFilter}`;
    } else if (metric === 'target_overdue_open') {
      metricFilter = `AND t.status != 'Completed' AND t.target_date IS NOT NULL AND t.target_date < $${todayParam}`;
    } else if (metric === 'on_due_completed') {
      metricFilter = `AND t.status = 'Completed' AND t.due_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date ${completedDateFilter}`;
    } else if (metric === 'late_vs_due_completed') {
      metricFilter = `AND t.status = 'Completed' AND t.due_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date ${completedDateFilter}`;
    } else if (metric === 'due_overdue_open') {
      metricFilter = `AND t.status != 'Completed' AND t.due_date IS NOT NULL AND t.due_date < $${todayParam}`;
    } else if (metric === 'recovered') {
      metricFilter = `AND t.status = 'Completed' AND t.target_date IS NOT NULL AND t.due_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.target_date AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= t.due_date ${completedDateFilter}`;
    } else if (metric === 'critical_late') {
      metricFilter = `AND ((t.status = 'Completed' AND t.due_date IS NOT NULL AND (t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date > t.due_date) OR (t.status != 'Completed' AND t.due_date IS NOT NULL AND t.due_date < $${todayParam}))`;
    } else if (metric === 'open_tasks') {
      metricFilter = `AND t.status != 'Completed'`;
    } else if (metric === 'completed_tasks') {
      metricFilter = `AND t.status = 'Completed' ${completedDateFilter}`;
    }

    let assigneeFilter = '';
    if (assignee_id === 'unassigned') {
      assigneeFilter = 'AND t.assignee_id IS NULL';
    } else if (assignee_id) {
      assigneeFilter = `AND t.assignee_id = ${parseInt(assignee_id)}`;
    }

    const query = `
      SELECT 
        t.id,
        t.name,
        t.status,
        t.priority,
        t.target_date,
        t.due_date,
        t.completed_at,
        t.created_at,
        u.first_name || ' ' || u.last_name as assignee_name,
        SUBSTRING(COALESCE(u.first_name, ''), 1, 1) || SUBSTRING(COALESCE(u.last_name, ''), 1, 1) as assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = $1
      AND t.deleted_at IS NULL
      ${metricFilter}
      ${assigneeFilter}
      ORDER BY 
        CASE WHEN t.status != 'Completed' THEN 0 ELSE 1 END,
        t.due_date ASC NULLS LAST,
        t.target_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get project tasks drilldown error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
  }
});

module.exports = router;
