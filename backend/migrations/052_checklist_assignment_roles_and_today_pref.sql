-- ====================================
-- Migration 052: Checklist primary/secondary assignees + Today toggle preference
-- ====================================

-- 1) Add assignment role on checklist assignments
ALTER TABLE checklist_assignments
  ADD COLUMN IF NOT EXISTS assignment_role VARCHAR(20);

-- Ensure all existing rows have a role value
UPDATE checklist_assignments
SET assignment_role = COALESCE(assignment_role, 'secondary');

-- Mark one currently-active assignment per item as primary
WITH ranked_active AS (
  SELECT
    id,
    checklist_item_id,
    ROW_NUMBER() OVER (
      PARTITION BY checklist_item_id
      ORDER BY assigned_from, created_at, id
    ) AS rn
  FROM checklist_assignments
  WHERE is_active = TRUE
    AND (assigned_to IS NULL OR assigned_to >= CURRENT_DATE)
)
UPDATE checklist_assignments ca
SET assignment_role = 'primary'
FROM ranked_active ra
WHERE ca.id = ra.id
  AND ra.rn = 1;

-- Keep secondary empty for currently-active existing records:
-- deactivate all extra currently-active assignments per item.
WITH extra_active AS (
  SELECT id
  FROM (
    SELECT
      id,
      checklist_item_id,
      ROW_NUMBER() OVER (
        PARTITION BY checklist_item_id
        ORDER BY
          CASE WHEN assignment_role = 'primary' THEN 0 ELSE 1 END,
          assigned_from,
          created_at,
          id
      ) AS rn
    FROM checklist_assignments
    WHERE is_active = TRUE
      AND (assigned_to IS NULL OR assigned_to >= CURRENT_DATE)
  ) ranked
  WHERE rn > 1
)
UPDATE checklist_assignments ca
SET
  is_active = FALSE,
  assigned_to = COALESCE(ca.assigned_to, CURRENT_DATE)
FROM extra_active ea
WHERE ca.id = ea.id;

-- Finalize role column constraints/default
UPDATE checklist_assignments
SET assignment_role = 'secondary'
WHERE assignment_role IS NULL;

ALTER TABLE checklist_assignments
  ALTER COLUMN assignment_role SET DEFAULT 'secondary';

ALTER TABLE checklist_assignments
  ALTER COLUMN assignment_role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'checklist_assignments_role_check'
  ) THEN
    ALTER TABLE checklist_assignments
      ADD CONSTRAINT checklist_assignments_role_check
      CHECK (assignment_role IN ('primary', 'secondary'));
  END IF;
END $$;

-- 2) Prevent duplicate active assignee rows for the same item/user
CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_assignments_one_active_user
  ON checklist_assignments(checklist_item_id, user_id)
  WHERE is_active = TRUE AND assigned_to IS NULL;

-- 3) Enforce max one active primary assignee per item
CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_assignments_one_active_primary
  ON checklist_assignments(checklist_item_id)
  WHERE is_active = TRUE AND assigned_to IS NULL AND assignment_role = 'primary';

-- 4) Persist per-user Today-tab preference
ALTER TABLE user_view_preferences
  ADD COLUMN IF NOT EXISTS checklist_include_secondary BOOLEAN DEFAULT FALSE;

