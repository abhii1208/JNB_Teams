-- Fix generation_log.series_id type mismatch
-- After migration 015 changed recurring_series.id to INTEGER

BEGIN;

-- Convert generation_log.series_id from UUID to INTEGER
DO $$
DECLARE
    series_id_type TEXT;
BEGIN
    SELECT data_type INTO series_id_type
    FROM information_schema.columns
    WHERE table_name = 'generation_log' AND column_name = 'series_id';
    
    IF series_id_type = 'uuid' THEN
        RAISE NOTICE 'Converting generation_log.series_id from UUID to INTEGER...';
        
        -- Drop foreign key constraint if exists
        ALTER TABLE generation_log DROP CONSTRAINT IF EXISTS generation_log_series_id_fkey;
        
        -- Clear existing rows that reference UUIDs
        DELETE FROM generation_log;
        
        -- Convert the column
        ALTER TABLE generation_log ALTER COLUMN series_id TYPE INTEGER USING series_id::text::integer;
        
        -- Recreate foreign key
        ALTER TABLE generation_log 
        ADD CONSTRAINT generation_log_series_id_fkey 
        FOREIGN KEY (series_id) REFERENCES recurring_series(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'generation_log.series_id converted to INTEGER';
    ELSE
        RAISE NOTICE 'generation_log.series_id is already %', series_id_type;
    END IF;
END $$;

COMMIT;

-- Verification
SELECT 'After migration - generation_log.series_id type:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'generation_log' AND column_name = 'series_id';
