-- Convert foreign key references to recurring_series from UUID to INTEGER
-- After migration 015 changed recurring_series.id to INTEGER

BEGIN;

-- Step 1: Check if tasks.series_id exists and is UUID
DO $$
DECLARE
    series_id_type TEXT;
BEGIN
    SELECT data_type INTO series_id_type
    FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'series_id';
    
    IF series_id_type = 'uuid' THEN
        RAISE NOTICE 'Converting tasks.series_id from UUID to INTEGER...';
        
        -- Drop foreign key constraint if exists
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_series_id_fkey;
        
        -- Convert the column - this will clear all existing data since UUID -> INTEGER is not directly convertible
        -- All existing task-series links will be lost
        ALTER TABLE tasks ALTER COLUMN series_id DROP DEFAULT;
        ALTER TABLE tasks ALTER COLUMN series_id TYPE INTEGER USING NULL;
        
        -- Recreate foreign key
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_series_id_fkey 
        FOREIGN KEY (series_id) REFERENCES recurring_series(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'tasks.series_id converted to INTEGER';
    ELSE
        RAISE NOTICE 'tasks.series_id is already %', series_id_type;
    END IF;
END $$;

-- Step 2: Check if recurrence_exceptions.series_id exists and is UUID
DO $$
DECLARE
    series_id_type TEXT;
BEGIN
    SELECT data_type INTO series_id_type
    FROM information_schema.columns
    WHERE table_name = 'recurrence_exceptions' AND column_name = 'series_id';
    
    IF series_id_type = 'uuid' THEN
        RAISE NOTICE 'Converting recurrence_exceptions.series_id from UUID to INTEGER...';
        
        -- Drop foreign key constraint if exists
        ALTER TABLE recurrence_exceptions DROP CONSTRAINT IF EXISTS recurrence_exceptions_series_id_fkey;
        
        -- Convert the column
        ALTER TABLE recurrence_exceptions ALTER COLUMN series_id DROP DEFAULT;
        ALTER TABLE recurrence_exceptions ALTER COLUMN series_id TYPE INTEGER USING NULL;
        
        -- Recreate foreign key
        ALTER TABLE recurrence_exceptions 
        ADD CONSTRAINT recurrence_exceptions_series_id_fkey 
        FOREIGN KEY (series_id) REFERENCES recurring_series(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'recurrence_exceptions.series_id converted to INTEGER';
    ELSE
        RAISE NOTICE 'recurrence_exceptions.series_id is already %', series_id_type;
    END IF;
END $$;

-- Step 3: Also convert recurrence_exceptions.id from UUID to INTEGER for consistency
DO $$
DECLARE
    id_type TEXT;
BEGIN
    SELECT data_type INTO id_type
    FROM information_schema.columns
    WHERE table_name = 'recurrence_exceptions' AND column_name = 'id';
    
    IF id_type = 'uuid' THEN
        RAISE NOTICE 'Converting recurrence_exceptions.id from UUID to SERIAL...';
        
        -- Drop primary key
        ALTER TABLE recurrence_exceptions DROP CONSTRAINT IF EXISTS recurrence_exceptions_pkey;
        
        -- Add new serial column
        ALTER TABLE recurrence_exceptions ADD COLUMN id_new SERIAL;
        
        -- Drop old id
        ALTER TABLE recurrence_exceptions DROP COLUMN id;
        
        -- Rename new column
        ALTER TABLE recurrence_exceptions RENAME COLUMN id_new TO id;
        
        -- Set as primary key
        ALTER TABLE recurrence_exceptions ADD PRIMARY KEY (id);
        
        RAISE NOTICE 'recurrence_exceptions.id converted to SERIAL';
    ELSE
        RAISE NOTICE 'recurrence_exceptions.id is already %', id_type;
    END IF;
END $$;

COMMIT;

-- Verification
SELECT 'After migration - Column types:' as info;
SELECT 
    table_name,
    column_name, 
    data_type
FROM information_schema.columns 
WHERE (table_name = 'tasks' AND column_name = 'series_id')
   OR (table_name = 'recurrence_exceptions' AND column_name IN ('id', 'series_id'))
ORDER BY table_name, column_name;
