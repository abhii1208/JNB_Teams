-- ====================================
-- Migration 013: Admin Module Support
-- ====================================
-- Purpose: Add optimizations and indexes for admin analytics
-- Add completed_at column if it doesn't exist

-- Add completed_at column to tasks table (for tracking completion timestamp)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP DEFAULT NULL;

-- Add trigger to set completed_at when status changes to Completed
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Completed' AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
    NEW.completed_at = CURRENT_TIMESTAMP;
  ELSIF NEW.status != 'Completed' AND OLD.status = 'Completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_task_completed_at ON tasks;
CREATE TRIGGER trigger_set_task_completed_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_task_completed_at();

-- Add indexes for admin performance queries
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_target_date ON tasks(target_date) WHERE target_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by) WHERE deleted_at IS NULL;

-- Add indexes for project member lookups
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(workspace_id, role);

-- Add indexes for project status
CREATE INDEX IF NOT EXISTS idx_projects_workspace_archived ON projects(workspace_id, archived_at);

-- Comments
COMMENT ON COLUMN tasks.completed_at IS 'Timestamp when task status was changed to Completed (IST timezone aware)';
COMMENT ON INDEX idx_tasks_project_status IS 'Optimize admin project metrics queries';
COMMENT ON INDEX idx_tasks_assignee_status IS 'Optimize admin team member metrics queries';
COMMENT ON INDEX idx_tasks_completed_at IS 'Optimize completed task date range queries';
COMMENT ON INDEX idx_tasks_target_date IS 'Optimize target date compliance queries';
COMMENT ON INDEX idx_tasks_due_date IS 'Optimize due date compliance queries';
