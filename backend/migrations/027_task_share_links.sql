-- ====================================
-- Migration 027: Task Share Links (Snapshot)
-- ====================================

CREATE TABLE IF NOT EXISTS task_share_links (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  is_protected BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  allowed_columns TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  task_count INTEGER NOT NULL DEFAULT 0,
  mode VARCHAR(20) NOT NULL DEFAULT 'snapshot' CHECK (mode IN ('snapshot')),
  view_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_share_link_tasks (
  share_link_id INTEGER NOT NULL REFERENCES task_share_links(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (share_link_id, task_id)
);

CREATE TABLE IF NOT EXISTS task_share_link_snapshots (
  share_link_id INTEGER NOT NULL REFERENCES task_share_links(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (share_link_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_share_links_workspace ON task_share_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_share_links_slug ON task_share_links(slug);
CREATE INDEX IF NOT EXISTS idx_task_share_links_expires ON task_share_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_task_share_links_revoked ON task_share_links(revoked_at);
CREATE INDEX IF NOT EXISTS idx_task_share_links_created ON task_share_links(created_at);
CREATE INDEX IF NOT EXISTS idx_task_share_link_tasks_task ON task_share_link_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_share_link_snapshots_share ON task_share_link_snapshots(share_link_id);

-- ====================================
-- End of Migration 027
-- ====================================
