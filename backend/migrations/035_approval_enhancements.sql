-- Migration: Add Audit Trail, Escalation, and Multiple Approvers features
-- Created: 2026-01-31

-- ============================================
-- 1. AUDIT TRAIL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS approval_audit_log (
    id SERIAL PRIMARY KEY,
    approval_id INTEGER NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'approved', 'rejected', 'escalated', 'reassigned', 'comment_added'
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb -- For storing additional context
);

CREATE INDEX IF NOT EXISTS idx_audit_log_approval_id ON approval_audit_log(approval_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON approval_audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON approval_audit_log(action);

-- ============================================
-- 2. ESCALATION COLUMNS ON APPROVALS
-- ============================================
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS escalation_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT FALSE;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0; -- 0=none, 1=first escalation, 2=second, etc.
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Set default escalation deadline for new approvals (24 hours from creation)
-- This will be handled in application code for new approvals

-- Index for finding approvals to escalate
CREATE INDEX IF NOT EXISTS idx_approvals_escalation ON approvals(status, escalation_deadline, escalated) 
    WHERE status = 'Pending';

-- ============================================
-- 3. MULTIPLE APPROVERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_approvers (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 1, -- 1 = primary, 2 = secondary, etc.
    can_approve BOOLEAN DEFAULT TRUE,
    can_reject BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_approvers_project ON project_approvers(project_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_project_approvers_user ON project_approvers(user_id) WHERE is_active = TRUE;

-- ============================================
-- 4. ESCALATION SETTINGS TABLE (per project)
-- ============================================
CREATE TABLE IF NOT EXISTS project_escalation_settings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    escalation_enabled BOOLEAN DEFAULT TRUE,
    escalation_hours INTEGER DEFAULT 24, -- Hours before escalation
    escalation_levels INTEGER DEFAULT 2, -- 1 = admins only, 2 = admins then owner
    send_reminders BOOLEAN DEFAULT TRUE,
    reminder_interval_hours INTEGER DEFAULT 8, -- Send reminder every X hours
    notify_requester_on_escalation BOOLEAN DEFAULT TRUE,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. MIGRATE EXISTING TAGGED APPROVERS TO NEW TABLE
-- ============================================
INSERT INTO project_approvers (project_id, user_id, priority, added_at, is_active)
SELECT id, approval_tagged_member_id, 1, CURRENT_TIMESTAMP, TRUE
FROM projects 
WHERE approval_tagged_member_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ============================================
-- 6. COMMENTS/NOTES ON APPROVALS
-- ============================================
CREATE TABLE IF NOT EXISTS approval_comments (
    id SERIAL PRIMARY KEY,
    approval_id INTEGER NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_internal BOOLEAN DEFAULT FALSE -- Internal notes visible only to approvers
);

CREATE INDEX IF NOT EXISTS idx_approval_comments_approval ON approval_comments(approval_id);

-- ============================================
-- 7. UPDATE EXISTING PENDING APPROVALS WITH ESCALATION DEADLINE
-- ============================================
UPDATE approvals 
SET escalation_deadline = created_at + INTERVAL '24 hours'
WHERE status = 'Pending' AND escalation_deadline IS NULL;

COMMENT ON TABLE approval_audit_log IS 'Tracks all actions taken on approval requests for audit purposes';
COMMENT ON TABLE project_approvers IS 'Stores multiple approvers per project with priority levels';
COMMENT ON TABLE project_escalation_settings IS 'Project-specific escalation configuration';
COMMENT ON TABLE approval_comments IS 'Comments and notes on approval requests';
