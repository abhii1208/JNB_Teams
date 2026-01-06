-- Add deleted_at column to tasks table for soft delete
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Add archived column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);
CREATE INDEX IF NOT EXISTS idx_projects_last_accessed ON projects(last_accessed_at DESC);

-- Update existing status check constraint to include new statuses
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('Open', 'Pending Approval', 'Closed', 'Rejected', 'In Progress', 'Completed', 'Blocked'));
