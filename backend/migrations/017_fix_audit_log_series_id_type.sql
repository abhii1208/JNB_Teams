-- Fix series_audit_log.series_id type mismatch
-- After migration 015 changed recurring_series.id to INTEGER

BEGIN;

-- Convert series_audit_log.series_id from UUID to INTEGER
DO $$
DECLARE
    series_id_type TEXT;
BEGIN
    SELECT data_type INTO series_id_type
    FROM information_schema.columns
    WHERE table_name = 'series_audit_log' AND column_name = 'series_id';
    
    IF series_id_type = 'uuid' THEN
        RAISE NOTICE 'Converting series_audit_log.series_id from UUID to INTEGER...';
        
        -- Drop foreign key constraint if exists
        ALTER TABLE series_audit_log DROP CONSTRAINT IF EXISTS series_audit_log_series_id_fkey;
        
        -- Delete existing audit log entries (they have UUID references that can't be converted)
        DELETE FROM series_audit_log;
        
        -- Convert the column
        ALTER TABLE series_audit_log ALTER COLUMN series_id TYPE INTEGER USING series_id::text::integer;
        
        -- Recreate foreign key
        ALTER TABLE series_audit_log 
        ADD CONSTRAINT series_audit_log_series_id_fkey 
        FOREIGN KEY (series_id) REFERENCES recurring_series(id) ON DELETE CASCADE;
        
        RAISE NOTICE '✅ series_audit_log.series_id converted to INTEGER';
    ELSE
        RAISE NOTICE 'series_audit_log.series_id is already %', series_id_type;
    END IF;
END $$;

COMMIT;

-- Verification
SELECT 'After migration - series_audit_log.series_id type:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'series_audit_log' AND column_name = 'series_id';
