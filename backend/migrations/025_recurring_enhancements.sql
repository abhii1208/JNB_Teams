-- ============================================
-- Migration: 025_recurring_enhancements.sql
-- Recurring Module Enhancements
-- Adds generation mode and backfill options
-- ============================================

-- Add generation_mode column to control automatic vs manual instance generation
ALTER TABLE recurring_series
ADD COLUMN IF NOT EXISTS generation_mode VARCHAR(20) DEFAULT 'auto'
    CHECK (generation_mode IN ('auto', 'manual'));

-- Add generate_past column to control whether past instances are created when start_date is before today
ALTER TABLE recurring_series
ADD COLUMN IF NOT EXISTS generate_past BOOLEAN DEFAULT true;

-- Add prevent_future column to prevent creating instances for future dates
ALTER TABLE recurring_series
ADD COLUMN IF NOT EXISTS prevent_future BOOLEAN DEFAULT true;

-- Add next_occurrence column to cache the next expected date
ALTER TABLE recurring_series
ADD COLUMN IF NOT EXISTS next_occurrence DATE;

-- Add category column for easier filtering/grouping
ALTER TABLE recurring_series
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Add color column for visual distinction
ALTER TABLE recurring_series
ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#0f766e';

-- Create index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_recurring_series_category ON recurring_series(category);

-- Create index for next_occurrence queries
CREATE INDEX IF NOT EXISTS idx_recurring_series_next_occurrence ON recurring_series(next_occurrence);

-- Update comment
COMMENT ON COLUMN recurring_series.generation_mode IS 'auto: generate instances automatically on create/update. manual: only generate when explicitly requested via Generate Now button.';
COMMENT ON COLUMN recurring_series.generate_past IS 'If true and start_date is before today, generate instances for past dates up to today.';
COMMENT ON COLUMN recurring_series.prevent_future IS 'If true, do not generate instances for future dates (only up to today).';
