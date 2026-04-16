-- ====================================
-- Migration 056: Persist app-level user preferences
-- ====================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS app_sidebar_collapsed BOOLEAN DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS app_presence_status VARCHAR(20) DEFAULT 'online';

UPDATE users
SET
  app_sidebar_collapsed = COALESCE(app_sidebar_collapsed, FALSE),
  app_presence_status = COALESCE(app_presence_status, 'online');

ALTER TABLE users
  ALTER COLUMN app_sidebar_collapsed SET DEFAULT FALSE;

ALTER TABLE users
  ALTER COLUMN app_presence_status SET DEFAULT 'online';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_app_presence_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_app_presence_status_check
      CHECK (app_presence_status IN ('online', 'busy', 'away'));
  END IF;
END $$;
