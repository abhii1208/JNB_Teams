-- Add archived_at column to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NULL;

-- Index for archived_at filtering
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON tasks(archived_at);
