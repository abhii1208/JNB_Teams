CREATE TABLE IF NOT EXISTS workspace_announcements (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Update',
  event_date TIMESTAMP NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT workspace_announcements_category_check CHECK (
    category IN ('Meeting', 'Fest', 'Event', 'Update', 'Holiday')
  )
);

CREATE INDEX IF NOT EXISTS idx_workspace_announcements_workspace
  ON workspace_announcements(workspace_id, is_pinned DESC, COALESCE(event_date, created_at) DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_announcements_creator
  ON workspace_announcements(created_by, created_at DESC);
