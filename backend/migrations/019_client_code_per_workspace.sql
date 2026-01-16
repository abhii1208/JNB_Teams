-- ====================================
-- Migration 019: Per-workspace Client Codes
-- ====================================

CREATE TABLE IF NOT EXISTS client_code_counters (
  workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  next_value INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE clients ALTER COLUMN client_code DROP DEFAULT;

DROP INDEX IF EXISTS idx_clients_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_workspace_code_unique ON clients(workspace_id, client_code);
