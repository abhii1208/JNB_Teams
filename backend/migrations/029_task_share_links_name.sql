-- ====================================
-- Migration 029: Task Share Link Name
-- ====================================

ALTER TABLE task_share_links
  ADD COLUMN IF NOT EXISTS name VARCHAR(120);

-- ====================================
-- End of Migration 029
-- ====================================
