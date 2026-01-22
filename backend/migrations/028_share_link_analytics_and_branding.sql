-- ====================================
-- Migration 028: Share Link Analytics + Workspace Branding
-- ====================================

ALTER TABLE task_share_links
  ADD COLUMN IF NOT EXISTS unlock_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_unlock_attempt_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_unlock_attempt_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_unlocked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_accessed_ip_hash TEXT;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ====================================
-- End of Migration 028
-- ====================================
