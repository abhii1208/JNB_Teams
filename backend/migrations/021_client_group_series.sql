-- ====================================
-- Migration 021: Client Group + Series
-- ====================================

-- Ensure client code counters exists (for installations missing 019)
CREATE TABLE IF NOT EXISTS client_code_counters (
  workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  next_value INTEGER NOT NULL DEFAULT 1
);

-- Add optional client grouping metadata
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_group VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS series_no VARCHAR(50);
