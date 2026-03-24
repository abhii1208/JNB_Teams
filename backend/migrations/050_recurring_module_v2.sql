-- =====================================================
-- RECURRING MODULE V2 - Complete Rebuild
-- Simple, reliable recurring task system
-- =====================================================

-- Drop old tables (backup data first if needed)
DROP TABLE IF EXISTS recurrence_exceptions CASCADE;
DROP TABLE IF EXISTS recurring_audit_log CASCADE;
DROP TABLE IF EXISTS assignment_rotation CASCADE;
DROP TABLE IF EXISTS recurring_series CASCADE;

-- =====================================================
-- MAIN TABLE: recurring_tasks
-- Stores recurring task templates and patterns
-- =====================================================
CREATE TABLE IF NOT EXISTS recurring_tasks (
    id SERIAL PRIMARY KEY,
    
    -- Ownership
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    
    -- Task template
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'Medium',
    assignee_id INTEGER REFERENCES users(id),
    
    -- Recurrence pattern (simple!)
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_value INTEGER NOT NULL DEFAULT 1,  -- every N days/weeks/months/years
    
    -- For weekly: which days (array of 0-6, 0=Sunday)
    week_days INTEGER[] DEFAULT NULL,
    
    -- For monthly: which day of month (1-31, or -1 for last day)
    month_day INTEGER DEFAULT NULL,
    
    -- For yearly: month and day
    year_month INTEGER DEFAULT NULL,  -- 1-12
    year_day INTEGER DEFAULT NULL,    -- 1-31
    
    -- Schedule
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE DEFAULT NULL,  -- NULL = no end
    
    -- Settings
    reminder_days INTEGER DEFAULT 1,  -- remind N days before due date
    auto_assign BOOLEAN DEFAULT true, -- auto-assign to assignee_id
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_generated_date DATE DEFAULT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_workspace ON recurring_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_project ON recurring_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_active ON recurring_tasks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_frequency ON recurring_tasks(frequency);

-- =====================================================
-- Update tasks table: add recurring_task_id reference
-- =====================================================
-- First check if column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'recurring_task_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN recurring_task_id INTEGER REFERENCES recurring_tasks(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(recurring_task_id) WHERE recurring_task_id IS NOT NULL;
    END IF;
END $$;

-- =====================================================
-- HELPER: Get next occurrence date for a recurring task
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_occurrence(
    p_frequency VARCHAR,
    p_interval INTEGER,
    p_week_days INTEGER[],
    p_month_day INTEGER,
    p_year_month INTEGER,
    p_year_day INTEGER,
    p_from_date DATE
) RETURNS DATE AS $$
DECLARE
    v_next DATE;
    v_dow INTEGER;
    v_found BOOLEAN := false;
    v_check_date DATE;
    v_target_day INTEGER;
    v_days_in_month INTEGER;
BEGIN
    -- Start from the day after from_date
    v_check_date := p_from_date + 1;
    
    CASE p_frequency
        WHEN 'daily' THEN
            -- Simply add interval days
            v_next := p_from_date + p_interval;
            
        WHEN 'weekly' THEN
            -- Find next matching day of week
            IF p_week_days IS NULL OR array_length(p_week_days, 1) IS NULL THEN
                -- Default to same day next week
                v_next := p_from_date + (7 * p_interval);
            ELSE
                -- Find next matching day
                FOR i IN 1..14 LOOP  -- Check up to 2 weeks
                    v_dow := EXTRACT(DOW FROM v_check_date)::INTEGER;
                    IF v_dow = ANY(p_week_days) THEN
                        v_next := v_check_date;
                        v_found := true;
                        EXIT;
                    END IF;
                    v_check_date := v_check_date + 1;
                END LOOP;
                
                IF NOT v_found THEN
                    v_next := p_from_date + 7;  -- Fallback
                END IF;
            END IF;
            
        WHEN 'monthly' THEN
            -- Find next month occurrence
            v_target_day := COALESCE(p_month_day, EXTRACT(DAY FROM p_from_date)::INTEGER);
            
            IF v_target_day = -1 THEN
                -- Last day of month
                v_next := (DATE_TRUNC('month', p_from_date) + INTERVAL '2 months' - INTERVAL '1 day')::DATE;
            ELSE
                -- Specific day
                v_next := (DATE_TRUNC('month', p_from_date) + INTERVAL '1 month')::DATE;
                v_days_in_month := EXTRACT(DAY FROM (v_next + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER;
                v_next := v_next + LEAST(v_target_day, v_days_in_month) - 1;
            END IF;
            
        WHEN 'yearly' THEN
            -- Same date next year
            v_next := p_from_date + INTERVAL '1 year';
            
        ELSE
            v_next := p_from_date + 1;
    END CASE;
    
    RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Success message
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Recurring Module V2 migration complete!';
END $$;
