-- ====================================
-- Migration 053: Backfill missing checklist primary assignments
-- ====================================

-- Some legacy checklist items can exist without any active assignment rows.
-- Backfill those items with a primary assignee so they appear in Manage Items
-- and assignee Today lists.

WITH candidate_primary AS (
  SELECT
    ci.id AS checklist_item_id,
    ci.workspace_id,
    ci.effective_from,
    ci.created_by,
    CASE
      WHEN creator.user_id IS NOT NULL THEN ci.created_by
      ELSE fallback_admin.user_id
    END AS primary_user_id
  FROM checklist_items ci
  LEFT JOIN workspace_members creator
    ON creator.workspace_id = ci.workspace_id
   AND creator.user_id = ci.created_by
  LEFT JOIN LATERAL (
    SELECT wm.user_id
    FROM workspace_members wm
    WHERE wm.workspace_id = ci.workspace_id
      AND wm.role IN ('Owner', 'Admin')
    ORDER BY CASE WHEN wm.role = 'Owner' THEN 0 ELSE 1 END, wm.joined_at
    LIMIT 1
  ) AS fallback_admin ON TRUE
  WHERE ci.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM checklist_assignments ca
      WHERE ca.checklist_item_id = ci.id
        AND ca.is_active = TRUE
        AND ca.assigned_to IS NULL
    )
)
INSERT INTO checklist_assignments (
  checklist_item_id,
  user_id,
  assignment_role,
  assigned_from,
  assigned_by,
  is_active
)
SELECT
  cp.checklist_item_id,
  cp.primary_user_id,
  'primary',
  COALESCE(cp.effective_from, CURRENT_DATE),
  COALESCE(cp.created_by, cp.primary_user_id),
  TRUE
FROM candidate_primary cp
WHERE cp.primary_user_id IS NOT NULL
ON CONFLICT (checklist_item_id, user_id, assigned_from)
DO UPDATE SET
  is_active = TRUE,
  assigned_to = NULL,
  assignment_role = 'primary';

