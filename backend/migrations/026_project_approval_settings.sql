-- Add auto-approve and task approval settings to projects
-- Feature 5: Auto-approve for owner/admin tasks
-- Feature 8: Task approval required setting

ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_approve_owner_tasks BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_approve_admin_tasks BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS task_approval_required BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN projects.auto_approve_owner_tasks IS 'When true, tasks completed by project owner are auto-approved';
COMMENT ON COLUMN projects.auto_approve_admin_tasks IS 'When true, tasks completed by project admin are auto-approved';
COMMENT ON COLUMN projects.task_approval_required IS 'When false, tasks do not require approval workflow';
