-- ====================================
-- Migration 038: Monthly Client Checklist Module
-- A workspace-scoped, per-client operations/compliance tracker
-- ====================================

-- ============================================
-- 1. WORKSPACE SETTINGS FOR CHECKLIST MODULE
-- ============================================

-- Add timezone setting to workspaces if not exists
ALTER TABLE workspaces 
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;

-- Workspace-level checklist reminder settings
CREATE TABLE IF NOT EXISTS workspace_checklist_settings (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Reminder times (stored as HH:MM in 24h format)
  daily_reminder_time TIME DEFAULT '09:00:00',
  weekly_reminder_day INTEGER DEFAULT 3, -- 1=Mon, 3=Wed, 7=Sun
  monthly_reminder_day INTEGER DEFAULT 25,
  monthly_final_reminder BOOLEAN DEFAULT TRUE, -- Send on last day of month
  
  -- General settings
  enable_reminders BOOLEAN DEFAULT TRUE,
  reminder_before_deadline_hours INTEGER DEFAULT 2, -- Final notice before window closes
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id)
);

-- ============================================
-- 2. CLIENT-SPECIFIC SETTINGS
-- ============================================

-- Client-specific checklist settings (extends clients table)
CREATE TABLE IF NOT EXISTS client_checklist_settings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Weekend exemption (if true, Sat/Sun are auto-exempt for daily items)
  weekend_exemption BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id)
);

-- ============================================
-- 3. CLIENT HOLIDAYS
-- ============================================

CREATE TABLE IF NOT EXISTS client_holidays (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_client_holidays_client ON client_holidays(client_id);
CREATE INDEX IF NOT EXISTS idx_client_holidays_date ON client_holidays(holiday_date);

-- ============================================
-- 4. CHECKLIST ITEM TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS checklist_items (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Item details
  title VARCHAR(300) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- E.g., "Compliance", "Operations", "Finance", etc.
  
  -- Frequency: 'daily', 'weekly', 'monthly'
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  
  -- Effective date range (no retrospective effect)
  effective_from DATE NOT NULL,
  effective_to DATE, -- NULL means indefinite
  
  -- Completion rule for multiple assignees
  completion_rule VARCHAR(20) DEFAULT 'any' CHECK (completion_rule IN ('all', 'any')),
  -- 'all': All assignees must confirm
  -- 'any': First confirmation completes; others can add remarks
  
  -- Whether remarks are required during confirmation
  remarks_required BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_client ON checklist_items(client_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_workspace ON checklist_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_frequency ON checklist_items(frequency);
CREATE INDEX IF NOT EXISTS idx_checklist_items_active ON checklist_items(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_checklist_items_effective ON checklist_items(effective_from, effective_to);

-- ============================================
-- 5. CHECKLIST ITEM ASSIGNMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS checklist_assignments (
  id SERIAL PRIMARY KEY,
  checklist_item_id INTEGER NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Assignment effective dates (for future reassignment)
  assigned_from DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_to DATE, -- NULL means indefinite
  
  is_active BOOLEAN DEFAULT TRUE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(checklist_item_id, user_id, assigned_from)
);

CREATE INDEX IF NOT EXISTS idx_checklist_assignments_item ON checklist_assignments(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_user ON checklist_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_active ON checklist_assignments(is_active) WHERE is_active = TRUE;

-- ============================================
-- 6. CHECKLIST OCCURRENCES (Generated Instances)
-- ============================================

-- Status enum: 'pending', 'confirmed', 'missed', 'late_confirmed', 'exempt'
CREATE TABLE IF NOT EXISTS checklist_occurrences (
  id SERIAL PRIMARY KEY,
  checklist_item_id INTEGER NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- For daily: specific date
  -- For weekly: Monday of that week
  -- For monthly: First day of that month
  occurrence_date DATE NOT NULL,
  
  -- Period end date (for weekly/monthly)
  -- Daily: same as occurrence_date
  -- Weekly: Sunday of that week
  -- Monthly: Last day of that month
  period_end_date DATE NOT NULL,
  
  -- Frequency (denormalized for query efficiency)
  frequency VARCHAR(20) NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'missed', 'late_confirmed', 'exempt')),
  
  -- Exemption reason (if status = 'exempt')
  exemption_reason VARCHAR(200),
  
  -- Whether this occurrence was auto-generated or manually created
  auto_generated BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(checklist_item_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_checklist_occurrences_item ON checklist_occurrences(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_checklist_occurrences_client ON checklist_occurrences(client_id);
CREATE INDEX IF NOT EXISTS idx_checklist_occurrences_workspace ON checklist_occurrences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_checklist_occurrences_date ON checklist_occurrences(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_checklist_occurrences_period ON checklist_occurrences(occurrence_date, period_end_date);
CREATE INDEX IF NOT EXISTS idx_checklist_occurrences_status ON checklist_occurrences(status);
CREATE INDEX IF NOT EXISTS idx_checklist_occurrences_date_status ON checklist_occurrences(occurrence_date, status);

-- ============================================
-- 7. CHECKLIST CONFIRMATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS checklist_confirmations (
  id SERIAL PRIMARY KEY,
  occurrence_id INTEGER NOT NULL REFERENCES checklist_occurrences(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Confirmation details
  confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT,
  
  -- Late confirmation by admin
  is_late_confirm BOOLEAN DEFAULT FALSE,
  late_confirm_reason TEXT,
  late_confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- The date on which confirmation was made (workspace timezone)
  confirmation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  UNIQUE(occurrence_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_confirmations_occurrence ON checklist_confirmations(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_checklist_confirmations_user ON checklist_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_confirmations_date ON checklist_confirmations(confirmation_date);

-- ============================================
-- 8. AUDIT LOG FOR LATE CONFIRMATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS checklist_audit_log (
  id SERIAL PRIMARY KEY,
  occurrence_id INTEGER NOT NULL REFERENCES checklist_occurrences(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'late_confirm', 'status_override', 'exemption_added', etc.
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Details
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  reason TEXT,
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checklist_audit_log_occurrence ON checklist_audit_log(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_checklist_audit_log_action ON checklist_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_checklist_audit_log_user ON checklist_audit_log(performed_by);

-- ============================================
-- 9. CHECKLIST CATEGORIES (Optional predefined)
-- ============================================

CREATE TABLE IF NOT EXISTS checklist_categories (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#64748b',
  icon VARCHAR(50) DEFAULT 'checklist',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_checklist_categories_workspace ON checklist_categories(workspace_id);

-- ============================================
-- 10. HELPER FUNCTIONS
-- ============================================

-- Function to get week start (Monday) for a given date
CREATE OR REPLACE FUNCTION get_week_start(d DATE)
RETURNS DATE AS $$
BEGIN
  RETURN d - (EXTRACT(ISODOW FROM d)::INT - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get week end (Sunday) for a given date
CREATE OR REPLACE FUNCTION get_week_end(d DATE)
RETURNS DATE AS $$
BEGIN
  RETURN d + (7 - EXTRACT(ISODOW FROM d)::INT);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get month start for a given date
CREATE OR REPLACE FUNCTION get_month_start(d DATE)
RETURNS DATE AS $$
BEGIN
  RETURN DATE_TRUNC('month', d)::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get month end for a given date
CREATE OR REPLACE FUNCTION get_month_end(d DATE)
RETURNS DATE AS $$
BEGIN
  RETURN (DATE_TRUNC('month', d) + INTERVAL '1 month - 1 day')::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if a date range contains any holiday for a client
CREATE OR REPLACE FUNCTION has_holiday_in_range(p_client_id INTEGER, p_start_date DATE, p_end_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM client_holidays 
    WHERE client_id = p_client_id 
    AND holiday_date BETWEEN p_start_date AND p_end_date
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 11. INSERT DEFAULT CATEGORIES
-- ============================================

-- This will be done per workspace when checklist module is enabled

-- ============================================
-- 12. VIEWS FOR REPORTING
-- ============================================

-- Monthly summary view
CREATE OR REPLACE VIEW v_checklist_monthly_summary AS
SELECT 
  co.workspace_id,
  co.client_id,
  c.client_name,
  DATE_TRUNC('month', co.occurrence_date)::DATE as month,
  co.frequency,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE co.status = 'confirmed') as confirmed,
  COUNT(*) FILTER (WHERE co.status = 'missed') as missed,
  COUNT(*) FILTER (WHERE co.status = 'late_confirmed') as late_confirmed,
  COUNT(*) FILTER (WHERE co.status = 'exempt') as exempt,
  COUNT(*) FILTER (WHERE co.status = 'pending') as pending,
  ROUND(
    (COUNT(*) FILTER (WHERE co.status IN ('confirmed', 'late_confirmed', 'exempt'))::NUMERIC / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as completion_percentage
FROM checklist_occurrences co
JOIN clients c ON co.client_id = c.id
GROUP BY co.workspace_id, co.client_id, c.client_name, DATE_TRUNC('month', co.occurrence_date), co.frequency;

-- User performance view
CREATE OR REPLACE VIEW v_checklist_user_performance AS
SELECT 
  ca.user_id,
  u.username,
  COALESCE(u.first_name || ' ' || u.last_name, u.username) as user_name,
  co.workspace_id,
  DATE_TRUNC('month', co.occurrence_date)::DATE as month,
  COUNT(DISTINCT co.id) as assigned_items,
  COUNT(DISTINCT cc.id) as confirmed_items,
  COUNT(DISTINCT cc.id) FILTER (WHERE cc.is_late_confirm = TRUE) as late_confirmed,
  ROUND(
    (COUNT(DISTINCT cc.id)::NUMERIC / NULLIF(COUNT(DISTINCT co.id), 0) * 100), 2
  ) as confirmation_rate
FROM checklist_assignments ca
JOIN checklist_items ci ON ca.checklist_item_id = ci.id
JOIN checklist_occurrences co ON ci.id = co.checklist_item_id
JOIN users u ON ca.user_id = u.id
LEFT JOIN checklist_confirmations cc ON co.id = cc.occurrence_id AND ca.user_id = cc.user_id
WHERE ca.is_active = TRUE
  AND co.occurrence_date >= ca.assigned_from
  AND (ca.assigned_to IS NULL OR co.occurrence_date <= ca.assigned_to)
GROUP BY ca.user_id, u.username, u.first_name, u.last_name, co.workspace_id, DATE_TRUNC('month', co.occurrence_date);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
