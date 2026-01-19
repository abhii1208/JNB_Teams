-- Migration 022: Task client association

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id) WHERE client_id IS NOT NULL;

-- Backfill existing tasks with the project's primary client (if available)
UPDATE tasks t
SET client_id = pc.client_id
FROM project_clients pc
WHERE t.client_id IS NULL
  AND pc.project_id = t.project_id
  AND pc.is_primary = TRUE;
