-- Allow recurring_series.project_id to be NULL (project is optional)

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'recurring_series'
          AND column_name = 'project_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE recurring_series ALTER COLUMN project_id DROP NOT NULL;
    END IF;
END $$;

-- Verification
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'recurring_series'
  AND column_name = 'project_id';
