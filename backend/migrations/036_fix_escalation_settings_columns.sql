-- Migration: Fix escalation settings table columns
-- Created: 2026-01-31

-- Rename columns to match API expectations
ALTER TABLE project_escalation_settings 
    ADD COLUMN IF NOT EXISTS escalation_hours INTEGER DEFAULT 24;

ALTER TABLE project_escalation_settings 
    ADD COLUMN IF NOT EXISTS escalation_levels INTEGER DEFAULT 2;

ALTER TABLE project_escalation_settings 
    ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Migrate data from old columns if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_escalation_settings' AND column_name = 'first_escalation_hours') THEN
        UPDATE project_escalation_settings SET escalation_hours = first_escalation_hours WHERE escalation_hours IS NULL;
    END IF;
END $$;

-- Drop old columns if they exist
ALTER TABLE project_escalation_settings DROP COLUMN IF EXISTS first_escalation_hours;
ALTER TABLE project_escalation_settings DROP COLUMN IF EXISTS second_escalation_hours;
ALTER TABLE project_escalation_settings DROP COLUMN IF EXISTS escalate_to_owner;
