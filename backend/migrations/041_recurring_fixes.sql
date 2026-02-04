-- ============================================
-- Migration: 041_recurring_fixes.sql
-- Recurring Module Fixes - Critical to Low Priority
-- Date: 2026-02-04
-- ============================================

-- ============================================
-- CRITICAL FIX #1: Change prevent_future default to FALSE
-- This was causing daily tasks to be skipped because
-- the system wouldn't create tasks for "tomorrow"
-- ============================================
ALTER TABLE recurring_series 
ALTER COLUMN prevent_future SET DEFAULT false;

-- Update existing series that have the old problematic default
-- Only update series that are in 'auto' mode and actively generating
UPDATE recurring_series 
SET prevent_future = false 
WHERE prevent_future = true 
AND generation_mode = 'auto'
AND deleted_at IS NULL
AND paused_at IS NULL;

-- ============================================
-- HIGH PRIORITY FIX #7: Increase max_future_instances default
-- 10 is too low for weekly tasks (only ~2 months)
-- Changing to 30 for ~7 months of weekly tasks
-- ============================================
ALTER TABLE recurring_series 
ALTER COLUMN max_future_instances SET DEFAULT 30;

-- Update existing series with low max_future_instances
UPDATE recurring_series 
SET max_future_instances = 30 
WHERE max_future_instances = 10
AND deleted_at IS NULL;

-- ============================================
-- LOW PRIORITY FIX #15: Add missing index on tasks.occurrence_date
-- Improves query performance for recurring task lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_occurrence_date 
ON tasks(occurrence_date) 
WHERE occurrence_date IS NOT NULL;

-- Also add composite index for series + occurrence lookups
CREATE INDEX IF NOT EXISTS idx_tasks_series_occurrence 
ON tasks(series_id, occurrence_date) 
WHERE series_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================
-- LOW PRIORITY FIX #12: Add retention policy for generation_log
-- Add a cleanup function that can be called periodically
-- ============================================

-- Add index for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_generation_log_created_at 
ON generation_log(created_at);

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_generation_logs(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM generation_log 
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MEDIUM PRIORITY: Add look_ahead_days column to simplify configuration
-- This replaces the confusing prevent_future + generate_past combination
-- ============================================
ALTER TABLE recurring_series 
ADD COLUMN IF NOT EXISTS look_ahead_days INTEGER DEFAULT 1
CHECK (look_ahead_days >= 0 AND look_ahead_days <= 365);

COMMENT ON COLUMN recurring_series.look_ahead_days IS 
'Number of days ahead to generate tasks. 0 = today only, 1 = today + tomorrow, etc. Replaces complex prevent_future logic.';

-- ============================================
-- HIGH PRIORITY: Add retry tracking columns
-- For failed generation retry mechanism
-- ============================================
ALTER TABLE recurring_series 
ADD COLUMN IF NOT EXISTS last_generation_error TEXT,
ADD COLUMN IF NOT EXISTS generation_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Create index for retry queries
CREATE INDEX IF NOT EXISTS idx_recurring_series_next_retry 
ON recurring_series(next_retry_at) 
WHERE next_retry_at IS NOT NULL AND deleted_at IS NULL;

-- ============================================
-- Update comments for documentation
-- ============================================
COMMENT ON COLUMN recurring_series.prevent_future IS 
'DEPRECATED: Use look_ahead_days instead. If true, do not generate instances for future dates.';

COMMENT ON COLUMN recurring_series.generate_past IS 
'If true and start_date is before today, generate instances for past dates up to today.';

COMMENT ON COLUMN recurring_series.last_generation_error IS 
'Last error message from generation attempt, for debugging.';

COMMENT ON COLUMN recurring_series.generation_retry_count IS 
'Number of consecutive failed generation attempts.';

COMMENT ON COLUMN recurring_series.next_retry_at IS 
'When to retry generation after a failure. NULL means no retry pending.';

-- ============================================
-- Log this migration
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 041_recurring_fixes.sql completed successfully';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '  - prevent_future default changed to FALSE';
    RAISE NOTICE '  - max_future_instances default changed to 30';
    RAISE NOTICE '  - Added index on tasks.occurrence_date';
    RAISE NOTICE '  - Added generation_log cleanup function';
    RAISE NOTICE '  - Added look_ahead_days column';
    RAISE NOTICE '  - Added retry tracking columns';
END $$;
