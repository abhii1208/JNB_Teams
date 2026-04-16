const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getManagerDashboard } = require('../services/taskInsightsService');
const { generateAssistantReply } = require('../services/aiAssistantService');

async function getWorkspaceRole(workspaceId, userId) {
  const result = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return result.rows[0]?.role || null;
}

function isManagerRole(role) {
  return ['Owner', 'Admin', 'ProjectAdmin'].includes(role);
}

router.get('/workspace/:workspaceId/performance', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });

    const result = await pool.query(
      `SELECT
         u.id AS user_id,
         COALESCE(u.first_name || ' ' || u.last_name, u.username) AS user_name,
         COUNT(DISTINCT t.id) FILTER (WHERE p.workspace_id = $1 AND t.deleted_at IS NULL) AS tasks_assigned,
         COUNT(DISTINCT t.id) FILTER (WHERE p.workspace_id = $1 AND t.deleted_at IS NULL AND t.status IN ('Closed', 'Completed')) AS tasks_completed,
         COUNT(DISTINCT t.id) FILTER (WHERE p.workspace_id = $1 AND t.deleted_at IS NULL AND t.status NOT IN ('Closed', 'Completed') AND t.due_date < CURRENT_DATE) AS tasks_overdue,
         COALESCE(SUM(twl.hours), 0)::numeric(10,2) AS hours_worked,
         AVG(
           CASE
             WHEN t.created_at IS NOT NULL AND t.status IN ('Closed', 'Completed') AND t.updated_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600
             ELSE NULL
           END
         )::numeric(10,2) AS average_closure_hours,
         AVG(tr.rating_score)::numeric(10,2) AS manager_rating
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       LEFT JOIN tasks t ON t.assignee_id = u.id
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN task_work_logs twl ON twl.user_id = u.id AND twl.task_id = t.id
       LEFT JOIN team_ratings tr ON tr.employee_id = u.id AND tr.workspace_id = $1
       WHERE wm.workspace_id = $1
       GROUP BY u.id, u.first_name, u.last_name, u.username
       ORDER BY user_name ASC`,
      [workspaceId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get workspace performance error:', err);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

router.get('/workspace/:workspaceId/manager-hours', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!isManagerRole(role)) {
      return res.status(403).json({ error: 'Only managers and admins can view work charts' });
    }

    const result = await pool.query(
      `SELECT
         twl.work_date,
         twl.user_id,
         COALESCE(u.first_name || ' ' || u.last_name, u.username) AS user_name,
         twl.task_id,
         t.name AS task_name,
         p.name AS project_name,
         s.name AS service_name,
         COALESCE(twl.hours, 0)::numeric(10,2) AS hours
       FROM task_work_logs twl
       JOIN tasks t ON t.id = twl.task_id
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = twl.user_id
       LEFT JOIN services s ON s.id = t.service_id
       WHERE p.workspace_id = $1
       ORDER BY twl.work_date DESC, user_name ASC`,
      [workspaceId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get manager work chart error:', err);
    res.status(500).json({ error: 'Failed to fetch work chart data' });
  }
});

router.get('/workspace/:workspaceId/worklogs', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const result = await pool.query(
      `SELECT
         twl.id,
         twl.task_id,
         t.name AS task_name,
         t.description AS task_description,
         p.name AS project_name,
         twl.user_id,
         COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS user_name,
         twl.work_date,
         twl.start_time,
         twl.end_time,
         COALESCE(twl.hours, 0)::numeric(10,2) AS hours,
         twl.notes,
         twl.created_at
       FROM task_work_logs twl
       JOIN tasks t ON t.id = twl.task_id
       JOIN projects p ON p.id = t.project_id
       JOIN users u ON u.id = twl.user_id
       WHERE p.workspace_id = $1
       ORDER BY twl.work_date DESC, twl.created_at DESC`,
      [workspaceId]
    );

    res.json({ logs: result.rows });
  } catch (err) {
    console.error('Get workspace worklogs error:', err);
    res.status(500).json({ error: 'Failed to fetch workspace worklogs' });
  }
});

router.get('/workspace/:workspaceId/manager-dashboard', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!isManagerRole(role)) {
      return res.status(403).json({ error: 'Only managers and admins can view manager dashboard analytics' });
    }

    const data = await getManagerDashboard(
      workspaceId,
      req.query.date_from || null,
      req.query.date_to || null
    );

    res.json(data);
  } catch (err) {
    console.error('Get manager dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch manager dashboard analytics' });
  }
});

router.get('/workspace/:workspaceId/help-queries', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });

    const result = await pool.query(
      `SELECT
         hq.*,
         COALESCE(raised.first_name || ' ' || raised.last_name, raised.username) AS raised_by_name,
         COALESCE(assignee.first_name || ' ' || assignee.last_name, assignee.username) AS assigned_to_name
       FROM help_queries hq
       LEFT JOIN users raised ON raised.id = hq.raised_by
       LEFT JOIN users assignee ON assignee.id = hq.assigned_to
       WHERE hq.workspace_id = $1
       ORDER BY hq.updated_at DESC`,
      [workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get help queries error:', err);
    res.status(500).json({ error: 'Failed to fetch help queries' });
  }
});

router.post('/workspace/:workspaceId/help-queries', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });

    const result = await pool.query(
      `INSERT INTO help_queries (workspace_id, title, description, category, priority, status, raised_by, assigned_to)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'open'), $7, $8)
       RETURNING *`,
      [
        workspaceId,
        title,
        description,
        req.body.category || null,
        req.body.priority || 'medium',
        req.body.status || 'open',
        req.userId,
        req.body.assigned_to || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create help query error:', err);
    res.status(500).json({ error: 'Failed to create help query' });
  }
});

router.get('/help-queries/:queryId/messages', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         hqm.*,
         COALESCE(u.first_name || ' ' || u.last_name, u.username) AS user_name
       FROM help_query_messages hqm
       JOIN help_queries hq ON hq.id = hqm.query_id
       JOIN users u ON u.id = hqm.user_id
       WHERE hqm.query_id = $1
       ORDER BY hqm.created_at ASC`,
      [req.params.queryId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get help query messages error:', err);
    res.status(500).json({ error: 'Failed to fetch help query messages' });
  }
});

router.post('/help-queries/:queryId/messages', async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  try {
    const result = await pool.query(
      `INSERT INTO help_query_messages (query_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.queryId, req.userId, message]
    );
    await pool.query(
      'UPDATE help_queries SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.params.queryId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add help query message error:', err);
    res.status(500).json({ error: 'Failed to add help query message' });
  }
});

router.get('/workspace/:workspaceId/events', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });
    const result = await pool.query(
      'SELECT * FROM corporate_events WHERE workspace_id = $1 ORDER BY event_start ASC',
      [workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get corporate events error:', err);
    res.status(500).json({ error: 'Failed to fetch corporate events' });
  }
});

router.post('/workspace/:workspaceId/events', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!isManagerRole(role)) {
      return res.status(403).json({ error: 'Only authorized roles can manage events' });
    }
    const result = await pool.query(
      `INSERT INTO corporate_events
       (workspace_id, title, description, event_start, event_end, category, audience, location, reminder_minutes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING *`,
      [
        workspaceId,
        req.body.title,
        req.body.description || null,
        req.body.event_start,
        req.body.event_end || null,
        req.body.category || null,
        req.body.audience || null,
        req.body.location || null,
        req.body.reminder_minutes || null,
        req.userId,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create corporate event error:', err);
    res.status(500).json({ error: 'Failed to create corporate event' });
  }
});

router.get('/workspace/:workspaceId/birthdays', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });
    const workspaceResult = await pool.query(
      'SELECT birthdays_enabled FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    if (workspaceResult.rows[0]?.birthdays_enabled === false) {
      return res.json([]);
    }
    const result = await pool.query(
      `SELECT
         u.id,
         COALESCE(u.first_name || ' ' || u.last_name, u.username) AS user_name,
         u.date_of_birth
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
         AND u.date_of_birth IS NOT NULL
         AND EXTRACT(MONTH FROM u.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM u.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
       ORDER BY user_name ASC`,
      [workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get birthdays error:', err);
    res.status(500).json({ error: 'Failed to fetch birthdays' });
  }
});

router.get('/workspace/:workspaceId/rule-book/current', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });
    const result = await pool.query(
      `SELECT rb.*,
              rba.accepted_at,
              rba.scroll_completed,
              rba.timer_completed
       FROM rule_books rb
       LEFT JOIN rule_book_acceptances rba
         ON rba.rule_book_id = rb.id AND rba.user_id = $2
       WHERE rb.workspace_id = $1 AND rb.is_active = TRUE
       ORDER BY rb.updated_at DESC
       LIMIT 1`,
      [workspaceId, req.userId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Get current rule book error:', err);
    res.status(500).json({ error: 'Failed to fetch current rule book' });
  }
});

router.put('/workspace/:workspaceId/rule-book/current', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!isManagerRole(role)) {
      return res.status(403).json({ error: 'Only authorized roles can manage the rule book' });
    }

    const title = String(req.body.title || 'Workspace Rule Book').trim();
    const content = String(req.body.content || '').trim();
    const timerSeconds = Number(req.body.timer_seconds || 120);
    if (!content) {
      return res.status(400).json({ error: 'Rule book content is required' });
    }

    await pool.query(
      `UPDATE rule_books
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE workspace_id = $1`,
      [workspaceId]
    );

    const result = await pool.query(
      `INSERT INTO rule_books (workspace_id, title, content, version, is_active, timer_seconds, created_by, updated_by)
       VALUES ($1, $2, $3, COALESCE((SELECT MAX(version) + 1 FROM rule_books WHERE workspace_id = $1), 1), TRUE, $4, $5, $5)
       RETURNING *`,
      [workspaceId, title, content, timerSeconds, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Upsert rule book error:', err);
    res.status(500).json({ error: 'Failed to save rule book' });
  }
});

router.post('/rule-book/:ruleBookId/accept', async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO rule_book_acceptances (rule_book_id, user_id, accepted_at, scroll_completed, timer_completed)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)
       ON CONFLICT (rule_book_id, user_id)
       DO UPDATE SET
         accepted_at = CURRENT_TIMESTAMP,
         scroll_completed = EXCLUDED.scroll_completed,
         timer_completed = EXCLUDED.timer_completed
       RETURNING *`,
      [req.params.ruleBookId, req.userId, req.body.scroll_completed === true, req.body.timer_completed === true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Accept rule book error:', err);
    res.status(500).json({ error: 'Failed to accept rule book' });
  }
});

router.get('/workspace/:workspaceId/ratings', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });
    const result = await pool.query(
      `SELECT
         tr.*,
         COALESCE(employee.first_name || ' ' || employee.last_name, employee.username) AS employee_name,
         COALESCE(reviewer.first_name || ' ' || reviewer.last_name, reviewer.username) AS reviewer_name
       FROM team_ratings tr
       JOIN users employee ON employee.id = tr.employee_id
       JOIN users reviewer ON reviewer.id = tr.reviewer_id
       WHERE tr.workspace_id = $1
       ORDER BY tr.created_at DESC`,
      [workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get team ratings error:', err);
    res.status(500).json({ error: 'Failed to fetch team ratings' });
  }
});

router.post('/workspace/:workspaceId/ratings', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!isManagerRole(role)) {
      return res.status(403).json({ error: 'Only managers and admins can submit ratings' });
    }
    const result = await pool.query(
      `INSERT INTO team_ratings (workspace_id, cycle_id, employee_id, reviewer_id, rating_score, remarks, period_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [workspaceId, req.body.cycle_id || null, req.body.employee_id, req.userId, req.body.rating_score, req.body.remarks || null, req.body.period_label || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create team rating error:', err);
    res.status(500).json({ error: 'Failed to create team rating' });
  }
});

router.get('/workspace/:workspaceId/ai-settings', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });
    const result = await pool.query(
      'SELECT * FROM workspace_ai_settings WHERE workspace_id = $1',
      [workspaceId]
    );
    res.json(result.rows[0] || { workspace_id: workspaceId, enabled: false, config: {} });
  } catch (err) {
    console.error('Get AI settings error:', err);
    res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

router.put('/workspace/:workspaceId/ai-settings', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!isManagerRole(role)) {
      return res.status(403).json({ error: 'Only authorized roles can manage AI settings' });
    }
    const result = await pool.query(
      `INSERT INTO workspace_ai_settings (workspace_id, enabled, provider, model, config, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (workspace_id)
       DO UPDATE SET
         enabled = EXCLUDED.enabled,
         provider = EXCLUDED.provider,
         model = EXCLUDED.model,
         config = EXCLUDED.config,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [workspaceId, req.body.enabled === true, req.body.provider || null, req.body.model || null, JSON.stringify(req.body.config || {}), req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update AI settings error:', err);
    res.status(500).json({ error: 'Failed to update AI settings' });
  }
});

router.post('/workspace/:workspaceId/ai-assistant', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  const message = String(req.body?.message || '').trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const result = await generateAssistantReply({
      workspaceId,
      userId: req.userId,
      message,
      history,
    });

    res.json(result);
  } catch (err) {
    console.error('Enterprise AI assistant error:', err);
    res.status(err.status || 500).json({
      error: err.status === 403 ? err.message : 'Failed to generate AI response',
    });
  }
});

router.get('/workspace/:workspaceId/news-topics', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM workspace_news_topics WHERE workspace_id = $1 ORDER BY topic ASC',
      [req.params.workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get news topics error:', err);
    res.status(500).json({ error: 'Failed to fetch news topics' });
  }
});

router.post('/workspace/:workspaceId/news-topics', async (req, res) => {
  try {
    const role = await getWorkspaceRole(Number(req.params.workspaceId), req.userId);
    if (!isManagerRole(role)) {
      return res.status(403).json({ error: 'Only authorized roles can manage news topics' });
    }
    const result = await pool.query(
      `INSERT INTO workspace_news_topics (workspace_id, topic, category, is_active, created_by)
       VALUES ($1, $2, $3, COALESCE($4, TRUE), $5)
       RETURNING *`,
      [req.params.workspaceId, req.body.topic, req.body.category || null, req.body.is_active, req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create news topic error:', err);
    res.status(500).json({ error: 'Failed to create news topic' });
  }
});

router.get('/workspace/:workspaceId/email-rules', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM workspace_email_rules WHERE workspace_id = $1 ORDER BY rule_key ASC',
      [req.params.workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get email rules error:', err);
    res.status(500).json({ error: 'Failed to fetch email rules' });
  }
});

router.put('/workspace/:workspaceId/email-rules/:ruleKey', async (req, res) => {
  try {
    const role = await getWorkspaceRole(Number(req.params.workspaceId), req.userId);
    if (!isManagerRole(role)) {
      return res.status(403).json({ error: 'Only authorized roles can manage email rules' });
    }
    const result = await pool.query(
      `INSERT INTO workspace_email_rules (workspace_id, rule_key, enabled, channels, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (workspace_id, rule_key)
       DO UPDATE SET enabled = EXCLUDED.enabled, channels = EXCLUDED.channels, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.params.workspaceId, req.params.ruleKey, req.body.enabled !== false, JSON.stringify(req.body.channels || ['in_app'])]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update email rule error:', err);
    res.status(500).json({ error: 'Failed to update email rule' });
  }
});

router.get('/workspace/:workspaceId/leave-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lr.*,
              COALESCE(u.first_name || ' ' || u.last_name, u.username) AS requester_name,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', las.id,
                  'stage_order', las.stage_order,
                  'approver_id', las.approver_id,
                  'status', las.status,
                  'comments', las.comments,
                  'acted_at', las.acted_at
                ) ORDER BY las.stage_order)
                FROM leave_approval_stages las
                WHERE las.leave_request_id = lr.id
              ), '[]'::json) AS approval_stages
       FROM leave_requests lr
       JOIN users u ON u.id = lr.requester_id
       WHERE lr.workspace_id = $1
       ORDER BY lr.created_at DESC`,
      [req.params.workspaceId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get leave requests error:', err);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

router.post('/workspace/:workspaceId/leave-requests', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  try {
    const role = await getWorkspaceRole(workspaceId, req.userId);
    if (!role) return res.status(403).json({ error: 'Not a member of this workspace' });

    const totalDays = Number(req.body.total_days || 0);
    const specialApprovalRequired = totalDays > 7;
    const status = specialApprovalRequired ? 'special_approval' : 'pending';
    const policyRule = specialApprovalRequired ? 'more_than_7_days' : 'standard';
    const leaveResult = await pool.query(
      `INSERT INTO leave_requests (workspace_id, requester_id, leave_type, start_date, end_date, total_days, reason, status, special_approval_required, policy_rule, current_stage_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
       RETURNING *`,
      [workspaceId, req.userId, req.body.leave_type, req.body.start_date, req.body.end_date, totalDays, req.body.reason || null, status, specialApprovalRequired, policyRule]
    );

    const leaveRequest = leaveResult.rows[0];
    let stageCandidates = [];
    const managerResult = await pool.query(
      `SELECT u.manager_user_id
       FROM users u
       JOIN workspace_members wm ON wm.user_id = u.manager_user_id AND wm.workspace_id = $1
       WHERE u.id = $2`,
      [workspaceId, req.userId]
    );

    const managerUserId = managerResult.rows[0]?.manager_user_id || null;
    if (managerUserId && managerUserId !== req.userId) {
      stageCandidates.push(managerUserId);
    }

    if (specialApprovalRequired) {
      const approverRows = await pool.query(
        `SELECT user_id
         FROM workspace_members
         WHERE workspace_id = $1 AND role IN ('Owner', 'Admin')
         ORDER BY CASE role WHEN 'Owner' THEN 1 ELSE 2 END, joined_at ASC
         LIMIT 2`,
        [workspaceId]
      );

      approverRows.rows.forEach((row) => {
        if (row.user_id !== req.userId && !stageCandidates.includes(row.user_id)) {
          stageCandidates.push(row.user_id);
        }
      });
    } else {
      const fallbackManagerRows = await pool.query(
        `SELECT user_id
         FROM workspace_members
         WHERE workspace_id = $1 AND role IN ('Owner', 'Admin', 'ProjectAdmin')
         ORDER BY CASE role WHEN 'Owner' THEN 1 WHEN 'Admin' THEN 2 ELSE 3 END, joined_at ASC
         LIMIT 1`,
        [workspaceId]
      );
      fallbackManagerRows.rows.forEach((row) => {
        if (row.user_id !== req.userId && !stageCandidates.includes(row.user_id)) {
          stageCandidates.push(row.user_id);
        }
      });
    }

    let stageOrder = 1;
    for (const approverId of stageCandidates) {
      await pool.query(
        `INSERT INTO leave_approval_stages (leave_request_id, stage_order, approver_id, status)
         VALUES ($1, $2, $3, $4)`,
        [leaveRequest.id, stageOrder, approverId, stageOrder === 1 ? 'pending' : 'waiting']
      );
      stageOrder += 1;
    }

    if (stageCandidates.length === 0) {
      await pool.query(
        `UPDATE leave_requests
         SET status = 'approved', final_approved_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [leaveRequest.id]
      );
      leaveRequest.status = 'approved';
      leaveRequest.final_approved_at = new Date().toISOString();
    }

    res.status(201).json(leaveRequest);
  } catch (err) {
    console.error('Create leave request error:', err);
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

router.get('/leave-requests/:leaveRequestId/stages', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT las.*,
              COALESCE(u.first_name || ' ' || u.last_name, u.username) AS approver_name
       FROM leave_approval_stages las
       JOIN leave_requests lr ON lr.id = las.leave_request_id
       JOIN users u ON u.id = las.approver_id
       WHERE las.leave_request_id = $1
       ORDER BY las.stage_order ASC`,
      [req.params.leaveRequestId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get leave approval stages error:', err);
    res.status(500).json({ error: 'Failed to fetch leave approval stages' });
  }
});

router.post('/leave-requests/:leaveRequestId/stages/:stageId/action', async (req, res) => {
  const action = String(req.body.action || '').toLowerCase();
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const stageResult = await client.query(
      `SELECT las.*, lr.workspace_id, lr.requester_id, lr.current_stage_order, lr.status AS leave_status
       FROM leave_approval_stages las
       JOIN leave_requests lr ON lr.id = las.leave_request_id
       WHERE las.id = $1 AND las.leave_request_id = $2
       FOR UPDATE`,
      [req.params.stageId, req.params.leaveRequestId]
    );

    const stage = stageResult.rows[0];
    if (!stage) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Leave approval stage not found' });
    }

    if (Number(stage.approver_id) !== Number(req.userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not assigned to this approval stage' });
    }

    if (stage.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This approval stage has already been processed' });
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    await client.query(
      `UPDATE leave_approval_stages
       SET status = $1, comments = $2, acted_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [nextStatus, req.body.comments || null, stage.id]
    );

    if (action === 'reject') {
      await client.query(
        `UPDATE leave_requests
         SET status = 'rejected'
         WHERE id = $1`,
        [req.params.leaveRequestId]
      );
    } else {
      const nextStageResult = await client.query(
        `SELECT id
         FROM leave_approval_stages
         WHERE leave_request_id = $1 AND stage_order = $2`,
        [req.params.leaveRequestId, Number(stage.stage_order) + 1]
      );

      if (nextStageResult.rows.length) {
        await client.query(
          `UPDATE leave_approval_stages
           SET status = 'pending'
           WHERE id = $1`,
          [nextStageResult.rows[0].id]
        );
        await client.query(
          `UPDATE leave_requests
           SET current_stage_order = $2, status = 'special_approval'
           WHERE id = $1`,
          [req.params.leaveRequestId, Number(stage.stage_order) + 1]
        );
      } else {
        await client.query(
          `UPDATE leave_requests
           SET status = 'approved',
               final_approved_at = CURRENT_TIMESTAMP,
               current_stage_order = $2
           WHERE id = $1`,
          [req.params.leaveRequestId, Number(stage.stage_order)]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update leave approval stage error:', err);
    res.status(500).json({ error: 'Failed to update leave approval stage' });
  } finally {
    client.release();
  }
});

module.exports = router;
