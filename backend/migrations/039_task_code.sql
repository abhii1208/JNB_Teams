-- Migration: Add task code system
-- Each workspace has a unique 3-letter prefix and tasks get sequential codes

-- Add code_prefix and next_task_number to workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS code_prefix VARCHAR(3),
ADD COLUMN IF NOT EXISTS next_task_number INTEGER DEFAULT 1;

-- Add task_code to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS task_code VARCHAR(12) UNIQUE;

-- Create index for faster task_code lookups
CREATE INDEX IF NOT EXISTS idx_tasks_task_code ON tasks(task_code);

-- Create index for workspace code_prefix to ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_code_prefix ON workspaces(code_prefix) WHERE code_prefix IS NOT NULL;

-- Function to generate unique 3-letter prefix from workspace name
CREATE OR REPLACE FUNCTION generate_workspace_prefix(ws_name VARCHAR, ws_id INTEGER)
RETURNS VARCHAR(3) AS $$
DECLARE
    base_prefix VARCHAR(3);
    candidate VARCHAR(3);
    counter INTEGER := 0;
    letters VARCHAR(26) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
BEGIN
    -- Clean the name: remove special chars, convert to uppercase
    ws_name := UPPER(REGEXP_REPLACE(ws_name, '[^A-Za-z0-9 ]', '', 'g'));
    
    -- Strategy 1: First 3 letters of the first word
    IF LENGTH(ws_name) >= 3 THEN
        base_prefix := SUBSTRING(ws_name, 1, 3);
    ELSE
        -- Pad with 'X' if name is too short
        base_prefix := RPAD(ws_name, 3, 'X');
    END IF;
    
    candidate := base_prefix;
    
    -- Check if prefix exists (excluding current workspace)
    WHILE EXISTS (SELECT 1 FROM workspaces WHERE code_prefix = candidate AND id != ws_id) LOOP
        counter := counter + 1;
        
        IF counter <= 26 THEN
            -- Try appending different letters to first 2 chars
            candidate := SUBSTRING(base_prefix, 1, 2) || SUBSTRING(letters, counter, 1);
        ELSIF counter <= 52 THEN
            -- Try different second letter
            candidate := SUBSTRING(base_prefix, 1, 1) || SUBSTRING(letters, counter - 26, 1) || SUBSTRING(base_prefix, 3, 1);
        ELSE
            -- Fallback: use workspace ID
            candidate := 'WS' || LPAD(ws_id::VARCHAR, 1, '0');
            EXIT;
        END IF;
    END LOOP;
    
    RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- Function to generate task code
CREATE OR REPLACE FUNCTION generate_task_code(p_project_id INTEGER)
RETURNS VARCHAR(12) AS $$
DECLARE
    ws_id INTEGER;
    ws_prefix VARCHAR(3);
    ws_next_num INTEGER;
    new_code VARCHAR(12);
BEGIN
    -- Get workspace ID from project
    SELECT workspace_id INTO ws_id FROM projects WHERE id = p_project_id;
    
    IF ws_id IS NULL THEN
        RAISE EXCEPTION 'Project not found or has no workspace';
    END IF;
    
    -- Lock the workspace row to prevent concurrent updates
    SELECT code_prefix, next_task_number 
    INTO ws_prefix, ws_next_num 
    FROM workspaces 
    WHERE id = ws_id 
    FOR UPDATE;
    
    -- Generate prefix if not exists
    IF ws_prefix IS NULL THEN
        SELECT name INTO ws_prefix FROM workspaces WHERE id = ws_id;
        ws_prefix := generate_workspace_prefix(ws_prefix, ws_id);
        UPDATE workspaces SET code_prefix = ws_prefix WHERE id = ws_id;
    END IF;
    
    -- Get current number (default to 1 if null)
    IF ws_next_num IS NULL THEN
        ws_next_num := 1;
    END IF;
    
    -- Generate the task code
    new_code := ws_prefix || '-' || LPAD(ws_next_num::VARCHAR, 4, '0');
    
    -- Increment the counter
    UPDATE workspaces SET next_task_number = ws_next_num + 1 WHERE id = ws_id;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing workspaces with prefixes
DO $$
DECLARE
    ws RECORD;
BEGIN
    FOR ws IN SELECT id, name FROM workspaces WHERE code_prefix IS NULL LOOP
        UPDATE workspaces 
        SET code_prefix = generate_workspace_prefix(ws.name, ws.id)
        WHERE id = ws.id;
    END LOOP;
END $$;

-- Backfill existing tasks with codes (ordered by creation date)
DO $$
DECLARE
    ws RECORD;
    task_rec RECORD;
    task_num INTEGER;
    ws_prefix VARCHAR(3);
    candidate_code VARCHAR(12);
BEGIN
    FOR ws IN SELECT id, code_prefix FROM workspaces LOOP
        ws_prefix := ws.code_prefix;

        -- Continue from existing max code number in this workspace (idempotent-safe)
        SELECT COALESCE(
            MAX(
                CASE
                    WHEN t.task_code ~ '^[A-Z0-9]{3}-[0-9]{4}$'
                    THEN SUBSTRING(t.task_code FROM 5)::INTEGER
                    ELSE NULL
                END
            ),
            0
        ) + 1
        INTO task_num
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE p.workspace_id = ws.id;
        
        -- Get all tasks for this workspace ordered by creation date
        FOR task_rec IN 
            SELECT t.id 
            FROM tasks t
            JOIN projects p ON t.project_id = p.id
            WHERE p.workspace_id = ws.id AND t.task_code IS NULL
            ORDER BY t.created_at ASC, t.id ASC
        LOOP
            candidate_code := ws_prefix || '-' || LPAD(task_num::VARCHAR, 4, '0');

            -- Ensure we never collide with an already assigned code
            WHILE EXISTS (SELECT 1 FROM tasks WHERE task_code = candidate_code) LOOP
                task_num := task_num + 1;
                candidate_code := ws_prefix || '-' || LPAD(task_num::VARCHAR, 4, '0');
            END LOOP;

            UPDATE tasks 
            SET task_code = candidate_code
            WHERE id = task_rec.id;
            task_num := task_num + 1;
        END LOOP;
        
        -- Update workspace next_task_number
        UPDATE workspaces SET next_task_number = task_num WHERE id = ws.id;
    END LOOP;
END $$;

-- Add NOT NULL constraint after backfill (for new tasks)
-- Note: We can't add NOT NULL if there might be tasks without codes, 
-- so we'll enforce this in application code instead
