-- ====================================
-- Migration 030: Task Project Links
-- ====================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS enable_multi_project_links BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS task_project_links (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_task_project_links_task ON task_project_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_project_links_project ON task_project_links(project_id);

-- ====================================
-- End of Migration 030
-- ====================================
