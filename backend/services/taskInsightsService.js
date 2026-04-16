const { pool } = require('../db');

function buildDateFilter(fieldName, startDate, endDate, params) {
  const clauses = [];
  if (startDate) {
    params.push(startDate);
    clauses.push(`${fieldName} >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    clauses.push(`${fieldName} <= $${params.length}`);
  }
  return clauses;
}

async function getWorkspacePerformanceMetrics(workspaceId, startDate, endDate) {
  const params = [workspaceId];
  const completedDateClauses = buildDateFilter('t.updated_at::date', startDate, endDate, params);
  const updatedDateClauses = buildDateFilter('a.created_at::date', startDate, endDate, params);

  const query = `
    WITH workspace_users AS (
      SELECT wm.user_id, wm.role
      FROM workspace_members wm
      WHERE wm.workspace_id = $1
    ),
    assigned AS (
      SELECT
        t.assignee_id AS user_id,
        COUNT(*)::int AS assigned_total,
        COUNT(*) FILTER (WHERE t.status IN ('Closed', 'Completed') OR t.stage = 'Completed')::int AS completed_total,
        COUNT(*) FILTER (
          WHERE (t.status IN ('Closed', 'Completed') OR t.stage = 'Completed')
            AND t.due_date IS NOT NULL
            AND t.updated_at IS NOT NULL
            AND t.updated_at::date <= t.due_date
        )::int AS on_time_total,
        COUNT(*) FILTER (
          WHERE (t.status IN ('Closed', 'Completed') OR t.stage = 'Completed')
            AND t.due_date IS NOT NULL
            AND t.updated_at IS NOT NULL
            AND t.updated_at::date > t.due_date
        )::int AS late_total
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.workspace_id = $1
        AND t.deleted_at IS NULL
        AND t.assignee_id IS NOT NULL
      GROUP BY t.assignee_id
    ),
    updated AS (
      SELECT
        a.user_id,
        COUNT(*) FILTER (WHERE a.action = 'Updated' AND a.type = 'Task')::int AS tasks_updated,
        COUNT(*) FILTER (WHERE a.action = 'Commented' AND a.type = 'Task Comment')::int AS comments_added,
        COUNT(*) FILTER (WHERE a.action = 'Logged Time' AND a.type = 'Task Time')::int AS time_entries
      FROM activity_logs a
      WHERE a.workspace_id = $1
        ${updatedDateClauses.length ? `AND ${updatedDateClauses.join(' AND ')}` : ''}
      GROUP BY a.user_id
    ),
    completed_in_range AS (
      SELECT
        t.assignee_id AS user_id,
        COUNT(*)::int AS completed_in_range
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.workspace_id = $1
        AND t.assignee_id IS NOT NULL
        AND t.deleted_at IS NULL
        AND (t.status IN ('Closed', 'Completed') OR t.stage = 'Completed')
        ${completedDateClauses.length ? `AND ${completedDateClauses.join(' AND ')}` : ''}
      GROUP BY t.assignee_id
    )
    SELECT
      u.user_id,
      u.role,
      COALESCE(NULLIF(TRIM(profile.first_name || ' ' || profile.last_name), ''), profile.username, profile.email) AS name,
      profile.email,
      COALESCE(assigned.assigned_total, 0) AS assigned_total,
      COALESCE(assigned.completed_total, 0) AS completed_total,
      COALESCE(completed_in_range.completed_in_range, 0) AS completed_in_range,
      COALESCE(updated.tasks_updated, 0) AS tasks_updated,
      COALESCE(updated.comments_added, 0) AS comments_added,
      COALESCE(updated.time_entries, 0) AS time_entries,
      ROUND(
        CASE WHEN COALESCE(assigned.assigned_total, 0) = 0 THEN 0
        ELSE (COALESCE(assigned.completed_total, 0)::numeric / assigned.assigned_total::numeric) * 100 END,
        2
      ) AS completion_rate,
      ROUND(
        CASE WHEN COALESCE(assigned.completed_total, 0) = 0 THEN 0
        ELSE (COALESCE(assigned.on_time_total, 0)::numeric / assigned.completed_total::numeric) * 100 END,
        2
      ) AS timeliness_rate,
      (
        COALESCE(updated.tasks_updated, 0)
        + COALESCE(updated.comments_added, 0)
        + COALESCE(updated.time_entries, 0)
      ) AS activity_level
    FROM workspace_users u
    JOIN users profile ON profile.id = u.user_id
    LEFT JOIN assigned ON assigned.user_id = u.user_id
    LEFT JOIN updated ON updated.user_id = u.user_id
    LEFT JOIN completed_in_range ON completed_in_range.user_id = u.user_id
    ORDER BY activity_level DESC, completed_total DESC, name ASC
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

async function getWorkspaceWorkHours(workspaceId, startDate, endDate, bucket = 'day') {
  const truncMap = {
    day: 'day',
    week: 'week',
    month: 'month',
  };
  const safeBucket = truncMap[bucket] || 'day';
  const params = [workspaceId];
  const clauses = buildDateFilter('twl.work_date', startDate, endDate, params);

  const query = `
    SELECT
      twl.user_id,
      COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS name,
      DATE_TRUNC('${safeBucket}', twl.work_date::timestamp) AS bucket_start,
      ROUND(SUM(COALESCE(twl.hours, 0))::numeric, 2) AS hours
    FROM task_work_logs twl
    JOIN tasks t ON t.id = twl.task_id
    JOIN projects p ON p.id = t.project_id
    JOIN users u ON u.id = twl.user_id
    WHERE p.workspace_id = $1
      ${clauses.length ? `AND ${clauses.join(' AND ')}` : ''}
    GROUP BY twl.user_id, name, bucket_start
    ORDER BY bucket_start DESC, name ASC
  `;

  const summaryQuery = `
    SELECT
      twl.user_id,
      COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS name,
      ROUND(SUM(COALESCE(twl.hours, 0))::numeric, 2) AS total_hours
    FROM task_work_logs twl
    JOIN tasks t ON t.id = twl.task_id
    JOIN projects p ON p.id = t.project_id
    JOIN users u ON u.id = twl.user_id
    WHERE p.workspace_id = $1
      ${clauses.length ? `AND ${clauses.join(' AND ')}` : ''}
    GROUP BY twl.user_id, name
    ORDER BY total_hours DESC, name ASC
  `;

  const [seriesResult, summaryResult] = await Promise.all([
    pool.query(query, params),
    pool.query(summaryQuery, params),
  ]);

  return {
    bucket: safeBucket,
    series: seriesResult.rows,
    summary: summaryResult.rows,
  };
}

async function getManagerDashboard(workspaceId, startDate, endDate) {
  const [performance, workHours] = await Promise.all([
    getWorkspacePerformanceMetrics(workspaceId, startDate, endDate),
    getWorkspaceWorkHours(workspaceId, startDate, endDate, 'week'),
  ]);

  const params = [workspaceId];
  const clauses = buildDateFilter('t.updated_at::date', startDate, endDate, params);
  const statusQuery = `
    SELECT
      COALESCE(t.status, 'Unknown') AS status,
      COUNT(*)::int AS count
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE p.workspace_id = $1
      AND t.deleted_at IS NULL
      ${clauses.length ? `AND ${clauses.join(' AND ')}` : ''}
    GROUP BY COALESCE(t.status, 'Unknown')
    ORDER BY count DESC, status ASC
  `;

  const workloadQuery = `
    SELECT
      t.assignee_id AS user_id,
      COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email, 'Unassigned') AS name,
      COUNT(*) FILTER (WHERE t.status NOT IN ('Closed', 'Completed') AND COALESCE(t.stage, '') <> 'Completed')::int AS open_tasks,
      COUNT(*) FILTER (WHERE t.status IN ('Closed', 'Completed') OR COALESCE(t.stage, '') = 'Completed')::int AS completed_tasks
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE p.workspace_id = $1
      AND t.deleted_at IS NULL
    GROUP BY t.assignee_id, name
    ORDER BY open_tasks DESC, completed_tasks DESC, name ASC
  `;

  const [statusResult, workloadResult] = await Promise.all([
    pool.query(statusQuery, params),
    pool.query(workloadQuery, [workspaceId]),
  ]);

  return {
    performance,
    work_hours: workHours,
    task_status: statusResult.rows,
    workload: workloadResult.rows,
  };
}

module.exports = {
  getManagerDashboard,
};
