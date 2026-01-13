-- Add project-level settings for task workflow and visibility
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS members_can_create_tasks BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS members_can_close_tasks BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_rejection_reason BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_close_after_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS member_task_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_task_approval BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_settings_to_admin BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS freeze_columns JSONB DEFAULT '[]'::jsonb;

UPDATE projects
  SET members_can_create_tasks = true
  WHERE members_can_create_tasks IS NULL;

UPDATE projects
  SET members_can_close_tasks = true
  WHERE members_can_close_tasks IS NULL;

UPDATE projects
  SET require_rejection_reason = true
  WHERE require_rejection_reason IS NULL;

UPDATE projects
  SET auto_close_after_days = 0
  WHERE auto_close_after_days IS NULL;

UPDATE projects
  SET member_task_approval = false
  WHERE member_task_approval IS NULL;

UPDATE projects
  SET admin_task_approval = true
  WHERE admin_task_approval IS NULL;

UPDATE projects
  SET show_settings_to_admin = true
  WHERE show_settings_to_admin IS NULL;

UPDATE projects
  SET freeze_columns = '[]'::jsonb
  WHERE freeze_columns IS NULL;
