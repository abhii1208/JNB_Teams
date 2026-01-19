-- ====================================
-- Migration 019: Per-workspace Client Codes
-- ====================================

CREATE TABLE IF NOT EXISTS client_code_counters (
  workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  next_value INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE clients ALTER COLUMN client_code DROP DEFAULT;

DROP INDEX IF EXISTS idx_clients_code_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_clients_workspace_code_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM clients
      GROUP BY workspace_id, client_code
      HAVING COUNT(*) > 1
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX idx_clients_workspace_code_unique ON clients(workspace_id, client_code)';
    END IF;
  END IF;
END $$;
