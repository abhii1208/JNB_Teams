-- Backfill task statuses that stayed at Open/Not started even when stage changed.
-- Kept idempotent because migrate.js replays all migrations on every run.

UPDATE tasks
SET
  status = CASE
    WHEN stage = 'In-process' THEN 'In Progress'
    WHEN stage = 'On-hold' THEN 'Blocked'
    WHEN stage = 'Completed' THEN 'Pending Approval'
    WHEN stage = 'Planned' THEN 'Open'
    ELSE status
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE
  (stage = 'In-process' AND status IN ('Open', 'Not started'))
  OR (stage = 'On-hold' AND status IN ('Open', 'Not started'))
  OR (stage = 'Completed' AND status IN ('Open', 'Not started'))
  OR (stage = 'Planned' AND status = 'Not started');

