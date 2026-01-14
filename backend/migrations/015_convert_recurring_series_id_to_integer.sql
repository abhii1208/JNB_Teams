-- Convert recurring_series.id from UUID to INTEGER (SERIAL)
-- This fixes the pg_advisory_lock incompatibility and aligns with the rest of the schema

BEGIN;

-- Step 1: Check current state
SELECT 'Current recurring_series.id type:' as info;
SELECT data_type 
FROM information_schema.columns 
WHERE table_name = 'recurring_series' AND column_name = 'id';

-- Step 2: Create a new temporary column for integer IDs
ALTER TABLE recurring_series ADD COLUMN IF NOT EXISTS id_new SERIAL;

-- Step 3: Check if tasks table has recurring_series_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'recurring_series_id'
    ) THEN
        -- Add temporary column in tasks
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_series_id_new INTEGER;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assignment_rotation' AND column_name = 'series_id'
    ) THEN
        -- Add temporary column in assignment_rotation
        ALTER TABLE assignment_rotation ADD COLUMN IF NOT EXISTS series_id_new INTEGER;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recurring_exceptions' AND column_name = 'series_id'
    ) THEN
        -- Add temporary column in recurring_exceptions
        ALTER TABLE recurring_exceptions ADD COLUMN IF NOT EXISTS series_id_new INTEGER;
    END IF;
END $$;

-- Step 4: Create mapping and update references
-- Map old UUID ids to new integer ids
UPDATE recurring_series 
SET id_new = nextval('recurring_series_id_new_seq');

-- Update tasks table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'recurring_series_id'
    ) THEN
        -- Update tasks references
        UPDATE tasks t
        SET recurring_series_id_new = rs.id_new
        FROM recurring_series rs
        WHERE t.recurring_series_id = rs.id;
    END IF;
END $$;

-- Update assignment_rotation if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assignment_rotation' AND column_name = 'series_id'
    ) THEN
        UPDATE assignment_rotation ar
        SET series_id_new = rs.id_new
        FROM recurring_series rs
        WHERE ar.series_id = rs.id;
    END IF;
END $$;

-- Update recurring_exceptions if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recurring_exceptions' AND column_name = 'series_id'
    ) THEN
        UPDATE recurring_exceptions re
        SET series_id_new = rs.id_new
        FROM recurring_series rs
        WHERE re.series_id = rs.id;
    END IF;
END $$;

-- Step 5: Drop old columns and constraints
ALTER TABLE recurring_series DROP CONSTRAINT IF EXISTS recurring_series_pkey CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'recurring_series_id'
    ) THEN
        ALTER TABLE tasks DROP COLUMN IF EXISTS recurring_series_id;
        ALTER TABLE tasks RENAME COLUMN recurring_series_id_new TO recurring_series_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assignment_rotation' AND column_name = 'series_id'
    ) THEN
        ALTER TABLE assignment_rotation DROP COLUMN IF EXISTS series_id;
        ALTER TABLE assignment_rotation RENAME COLUMN series_id_new TO series_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recurring_exceptions' AND column_name = 'series_id'
    ) THEN
        ALTER TABLE recurring_exceptions DROP COLUMN IF EXISTS series_id;
        ALTER TABLE recurring_exceptions RENAME COLUMN series_id_new TO series_id;
    END IF;
END $$;

-- Step 6: Rename new column to id
ALTER TABLE recurring_series DROP COLUMN id;
ALTER TABLE recurring_series RENAME COLUMN id_new TO id;

-- Step 7: Set as primary key
ALTER TABLE recurring_series ADD PRIMARY KEY (id);

-- Step 8: Recreate foreign key constraints
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'recurring_series_id') THEN
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_recurring_series_id_fkey 
        FOREIGN KEY (recurring_series_id) REFERENCES recurring_series(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_rotation' AND column_name = 'series_id') THEN
        ALTER TABLE assignment_rotation 
        ADD CONSTRAINT assignment_rotation_series_id_fkey 
        FOREIGN KEY (series_id) REFERENCES recurring_series(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recurring_exceptions' AND column_name = 'series_id') THEN
        ALTER TABLE recurring_exceptions 
        ADD CONSTRAINT recurring_exceptions_series_id_fkey 
        FOREIGN KEY (series_id) REFERENCES recurring_series(id) ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;

-- Verification
SELECT 'After migration - recurring_series.id type:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recurring_series' AND column_name = 'id';

SELECT 'Count of recurring_series records:' as info;
SELECT COUNT(*) as count FROM recurring_series;
