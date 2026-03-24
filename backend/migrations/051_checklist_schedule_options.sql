-- ====================================
-- Migration 051: Checklist scheduling options + defaults
-- ====================================

-- 1) Make completion rule default stricter (all assignees)
ALTER TABLE checklist_items
  ALTER COLUMN completion_rule SET DEFAULT 'all';

-- 2) Add schedule options for weekly/monthly checklist items
ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS weekly_schedule_type VARCHAR(20) DEFAULT 'any_day',
  ADD COLUMN IF NOT EXISTS weekly_day_of_week INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_schedule_type VARCHAR(20) DEFAULT 'any_day',
  ADD COLUMN IF NOT EXISTS monthly_day_of_month INTEGER;

-- 3) Align workspace settings used by service/UI
ALTER TABLE workspace_checklist_settings
  ADD COLUMN IF NOT EXISTS auto_mark_missed BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_late_confirmation BOOLEAN DEFAULT TRUE;
