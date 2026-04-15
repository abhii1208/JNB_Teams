-- Migration 057: Enterprise extensions foundation
-- Services, task comments/work logs/reminders, support/help queries, performance,
-- ratings, birthday/rule-book/event foundations, email rules, and leave workflow shell

-- =====================================================
-- USER / WORKSPACE EXTENSIONS
-- =====================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS birthdays_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS rule_book_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rule_book_mandatory BOOLEAN DEFAULT FALSE;

-- =====================================================
-- SERVICES
-- =====================================================

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_services_workspace_active
  ON services(workspace_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id) ON DELETE SET NULL;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS worked_hours NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_tasks_service_id ON tasks(service_id) WHERE deleted_at IS NULL;

-- =====================================================
-- TASK COMMENTS / WORK LOGS / REMINDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id
  ON task_comments(task_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS task_work_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  hours NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_work_logs_task_id ON task_work_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_work_logs_user_date ON task_work_logs(user_id, work_date DESC);

CREATE TABLE IF NOT EXISTS task_reminders (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  delivery_channels JSONB NOT NULL DEFAULT '["in_app"]'::jsonb,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON task_reminders(task_id, sent_at DESC);

-- =====================================================
-- HELP / QUERY / ESCALATION
-- =====================================================

CREATE TABLE IF NOT EXISTS help_queries (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  raised_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_help_queries_workspace_status ON help_queries(workspace_id, status);

CREATE TABLE IF NOT EXISTS help_query_messages (
  id SERIAL PRIMARY KEY,
  query_id INTEGER NOT NULL REFERENCES help_queries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_help_query_messages_query_id ON help_query_messages(query_id, created_at);

-- =====================================================
-- CORPORATE EVENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS corporate_events (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_start TIMESTAMP NOT NULL,
  event_end TIMESTAMP,
  category VARCHAR(100),
  audience VARCHAR(100),
  location VARCHAR(200),
  reminder_minutes INTEGER,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corporate_events_workspace_start ON corporate_events(workspace_id, event_start);

-- =====================================================
-- RULE BOOK
-- =====================================================

CREATE TABLE IF NOT EXISTS rule_books (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL DEFAULT 'Rule Book',
  content TEXT NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  timer_seconds INTEGER NOT NULL DEFAULT 120,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rule_book_acceptances (
  id SERIAL PRIMARY KEY,
  rule_book_id INTEGER NOT NULL REFERENCES rule_books(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scroll_completed BOOLEAN NOT NULL DEFAULT FALSE,
  timer_completed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (rule_book_id, user_id)
);

-- =====================================================
-- RATINGS / PERFORMANCE
-- =====================================================

CREATE TABLE IF NOT EXISTS rating_cycles (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'closed')),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_ratings (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  cycle_id INTEGER REFERENCES rating_cycles(id) ON DELETE SET NULL,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating_score NUMERIC(4,2) NOT NULL,
  remarks TEXT,
  period_label VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_ratings_employee ON team_ratings(employee_id, created_at DESC);

-- =====================================================
-- AI / NEWS / FEATURE FLAGS
-- =====================================================

CREATE TABLE IF NOT EXISTS workspace_ai_settings (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  provider VARCHAR(50),
  model VARCHAR(100),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_news_topics (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  topic VARCHAR(150) NOT NULL,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_feature_settings (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- EMAIL RULES
-- =====================================================

CREATE TABLE IF NOT EXISTS workspace_email_rules (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  channels JSONB NOT NULL DEFAULT '["in_app"]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, rule_key)
);

-- =====================================================
-- LEAVE WORKFLOW SHELL
-- =====================================================

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(6,2) NOT NULL,
  reason TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'special_approval', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_approval_stages (
  id SERIAL PRIMARY KEY,
  leave_request_id INTEGER NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  stage_order INTEGER NOT NULL,
  approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  comments TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_workspace_status ON leave_requests(workspace_id, status);
