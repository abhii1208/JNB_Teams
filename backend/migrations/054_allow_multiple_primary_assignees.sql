-- ====================================
-- Migration 054: Allow multiple active primary assignees per checklist item
-- ====================================

-- Previous model enforced exactly one active primary per checklist item.
-- New model supports multiple primary assignees.
DROP INDEX IF EXISTS idx_checklist_assignments_one_active_primary;
