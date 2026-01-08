-- ============================================
-- Migration: 008_recurring_module.sql
-- Recurring Tasks Module - Complete Schema
-- Compatible with existing INTEGER-based schema
-- ============================================

-- ============================================
-- 1. RECURRING SERIES (THE BRAIN)
-- Defines intent and rules, never represents real work
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_series (
    id SERIAL PRIMARY KEY,
    
    -- Context (links to existing tables)
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Template (what gets created)
    title VARCHAR(200) NOT NULL,
    description TEXT,
    template JSONB NOT NULL DEFAULT '{}',
    -- template stores: priority, notes, estimated_hours, tags, etc.
    
    -- Recurrence rule (RFC-5545 aligned JSON)
    -- See: RRULE JSON Schema for validation
    recurrence_rule JSONB NOT NULL,
    
    -- Timezone handling (CRITICAL)
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    
    -- Date bounds
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- State management
    paused_at TIMESTAMPTZ,
    last_generated_at DATE,
    
    -- Behavior configuration
    auto_close_after_days INTEGER,
    backfill_policy VARCHAR(20) DEFAULT 'skip' 
        CHECK (backfill_policy IN ('skip', 'generate_overdue', 'auto_close')),
    max_future_instances INTEGER DEFAULT 10,
    
    -- Assignment strategy
    assignment_strategy VARCHAR(20) NOT NULL DEFAULT 'static'
        CHECK (assignment_strategy IN ('static', 'round_robin', 'role_based')),
    static_assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Approval workflow
    requires_approval BOOLEAN DEFAULT false,
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Reminders (array of offsets)
    -- Format: [{"value": 1, "unit": "day"}, {"value": 2, "unit": "hour"}]
    reminder_offsets JSONB DEFAULT '[]',
    
    -- Versioning for audit trail
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Generation lock (prevent race conditions)
    generation_lock_until TIMESTAMPTZ,
    generation_lock_by VARCHAR(100),
    
    -- Standard audit fields
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Safety constraints
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT valid_auto_close CHECK (auto_close_after_days IS NULL OR auto_close_after_days > 0),
    CONSTRAINT valid_max_instances CHECK (max_future_instances > 0 AND max_future_instances <= 365)
);

-- ============================================
-- 2. EXTEND EXISTING TASKS TABLE
-- Add recurring-related columns without breaking existing functionality
-- ============================================
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS series_id INTEGER REFERENCES recurring_series(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_exception BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS occurrence_date DATE;

-- Update status constraint to include auto_closed
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
    CHECK (status IN (
        'Open', 'Pending Approval', 'Closed', 'Rejected', 
        'In Progress', 'Completed', 'Blocked', 'auto_closed', 'Not started'
    ));

-- ============================================
-- 3. RECURRENCE EXCEPTIONS
-- Handles skipped or moved occurrences without corrupting the series
-- ============================================
CREATE TABLE IF NOT EXISTS recurrence_exceptions (
    id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES recurring_series(id) ON DELETE CASCADE,
    
    -- The original computed date
    original_date DATE NOT NULL,
    -- For 'move' exceptions, the new date
    new_date DATE,
    
    exception_type VARCHAR(10) NOT NULL CHECK (exception_type IN ('skip', 'move')),
    reason TEXT,
    
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one exception per date per series
    UNIQUE(series_id, original_date)
);

-- ============================================
-- 4. ASSIGNMENT ROTATION (Round Robin Support)
-- Determines next assignee at generation time
-- ============================================
CREATE TABLE IF NOT EXISTS assignment_rotation (
    id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES recurring_series(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    order_index INTEGER NOT NULL,
    last_assigned_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    
    UNIQUE (series_id, user_id),
    UNIQUE (series_id, order_index)
);

-- ============================================
-- 5. TASK REMINDERS (Materialized)
-- Reminders are generated per instance, not dynamically computed
-- ============================================
CREATE TABLE IF NOT EXISTS task_reminders (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- When to send
    remind_at TIMESTAMPTZ NOT NULL,
    
    -- Execution tracking
    sent_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Notification details
    notification_type VARCHAR(50) DEFAULT 'reminder',
    notification_channel VARCHAR(50) DEFAULT 'in_app', -- in_app, email, push
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 6. GENERATION LOG (For Idempotency & Debugging)
-- Critical for understanding what happened during generation
-- ============================================
CREATE TABLE IF NOT EXISTS generation_log (
    id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES recurring_series(id) ON DELETE CASCADE,
    
    -- The date being processed
    generated_date DATE NOT NULL,
    
    -- The resulting task (if created)
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    
    -- What happened
    status VARCHAR(20) NOT NULL CHECK (status IN ('created', 'skipped', 'moved', 'failed', 'already_exists')),
    
    -- Error tracking
    error_message TEXT,
    
    -- Metadata
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    execution_time_ms INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate processing
    UNIQUE(series_id, generated_date)
);

-- ============================================
-- 7. SERIES AUDIT LOG (Specific to Recurring)
-- More detailed than general activity_logs
-- ============================================
CREATE TABLE IF NOT EXISTS series_audit_log (
    id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES recurring_series(id) ON DELETE CASCADE,
    
    action VARCHAR(50) NOT NULL,
    -- Actions: created, updated, paused, resumed, ended, split, deleted
    
    -- What changed
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 8. INDEXES (Performance Critical)
-- ============================================

-- Series indexes
CREATE INDEX IF NOT EXISTS idx_series_workspace ON recurring_series(workspace_id);
CREATE INDEX IF NOT EXISTS idx_series_project ON recurring_series(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_series_paused ON recurring_series(paused_at) WHERE paused_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_series_active ON recurring_series(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_series_needs_generation ON recurring_series(last_generated_at) 
    WHERE paused_at IS NULL AND deleted_at IS NULL;

-- Tasks recurring indexes
CREATE INDEX IF NOT EXISTS idx_tasks_series ON tasks(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_occurrence ON tasks(series_id, occurrence_date) WHERE series_id IS NOT NULL;

-- Exceptions index
CREATE INDEX IF NOT EXISTS idx_exceptions_series_date ON recurrence_exceptions(series_id, original_date);

-- Reminders indexes
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON task_reminders(remind_at) 
    WHERE sent_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_task ON task_reminders(task_id);

-- Generation log index
CREATE INDEX IF NOT EXISTS idx_generation_log_series ON generation_log(series_id, generated_date);
CREATE INDEX IF NOT EXISTS idx_generation_log_status ON generation_log(status, created_at);

-- Audit log index
CREATE INDEX IF NOT EXISTS idx_series_audit_series ON series_audit_log(series_id);
CREATE INDEX IF NOT EXISTS idx_series_audit_action ON series_audit_log(action);

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to count future instances for a series
CREATE OR REPLACE FUNCTION count_future_instances(p_series_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM tasks
        WHERE series_id = p_series_id
        AND due_date >= CURRENT_DATE
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if date is an exception
CREATE OR REPLACE FUNCTION is_exception_date(p_series_id INTEGER, p_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM recurrence_exceptions
        WHERE series_id = p_series_id
        AND original_date = p_date
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get exception for a date
CREATE OR REPLACE FUNCTION get_exception(p_series_id INTEGER, p_date DATE)
RETURNS TABLE (
    exception_type VARCHAR(10),
    new_date DATE,
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT e.exception_type, e.new_date, e.reason
    FROM recurrence_exceptions e
    WHERE e.series_id = p_series_id
    AND e.original_date = p_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get next round-robin assignee
CREATE OR REPLACE FUNCTION get_next_assignee(p_series_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    -- Get user with oldest last_assigned_at (or never assigned)
    SELECT user_id INTO v_user_id
    FROM assignment_rotation
    WHERE series_id = p_series_id
    AND active = true
    ORDER BY last_assigned_at NULLS FIRST, order_index
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    -- Update last assigned time
    IF v_user_id IS NOT NULL THEN
        UPDATE assignment_rotation
        SET last_assigned_at = NOW()
        WHERE series_id = p_series_id AND user_id = v_user_id;
    END IF;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. AUTO-CLOSE FUNCTION (Called by cron)
-- ============================================
CREATE OR REPLACE FUNCTION auto_close_overdue_recurring_tasks()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH closed_tasks AS (
        UPDATE tasks t
        SET 
            status = 'auto_closed',
            updated_at = NOW()
        FROM recurring_series s
        WHERE t.series_id = s.id
        AND t.status NOT IN ('Completed', 'Closed', 'auto_closed')
        AND t.deleted_at IS NULL
        AND s.auto_close_after_days IS NOT NULL
        AND t.due_date < (CURRENT_DATE - (s.auto_close_after_days || ' days')::interval)
        RETURNING t.id
    )
    SELECT COUNT(*) INTO v_count FROM closed_tasks;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_recurring_series_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recurring_series_updated ON recurring_series;
CREATE TRIGGER trigger_recurring_series_updated
    BEFORE UPDATE ON recurring_series
    FOR EACH ROW
    EXECUTE FUNCTION update_recurring_series_timestamp();

-- ============================================
-- 12. AUDIT TRIGGER FOR SERIES
-- ============================================
CREATE OR REPLACE FUNCTION audit_recurring_series()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO series_audit_log (series_id, action, new_values, performed_by)
        VALUES (NEW.id, 'created', to_jsonb(NEW), NEW.created_by);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Determine action based on what changed
        IF OLD.paused_at IS NULL AND NEW.paused_at IS NOT NULL THEN
            INSERT INTO series_audit_log (series_id, action, old_values, new_values, performed_by)
            VALUES (NEW.id, 'paused', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by);
        ELSIF OLD.paused_at IS NOT NULL AND NEW.paused_at IS NULL THEN
            INSERT INTO series_audit_log (series_id, action, old_values, new_values, performed_by)
            VALUES (NEW.id, 'resumed', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by);
        ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            INSERT INTO series_audit_log (series_id, action, old_values, new_values, performed_by)
            VALUES (NEW.id, 'deleted', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by);
        ELSE
            INSERT INTO series_audit_log (series_id, action, old_values, new_values, performed_by)
            VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_recurring_series ON recurring_series;
CREATE TRIGGER trigger_audit_recurring_series
    AFTER INSERT OR UPDATE ON recurring_series
    FOR EACH ROW
    EXECUTE FUNCTION audit_recurring_series();

-- ============================================
-- DONE!
-- ============================================
