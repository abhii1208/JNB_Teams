-- Migration: Fix generate_task_code function
-- Bug: Was storing workspace name in VARCHAR(3) variable before calling generate_workspace_prefix

CREATE OR REPLACE FUNCTION generate_task_code(p_project_id INTEGER)
RETURNS VARCHAR(12) AS $$
DECLARE
    ws_id INTEGER;
    ws_prefix VARCHAR(3);
    ws_name VARCHAR(255);  -- Use separate variable for name
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
        -- Get the workspace name into a properly sized variable
        SELECT name INTO ws_name FROM workspaces WHERE id = ws_id;
        -- Generate prefix from the name
        ws_prefix := generate_workspace_prefix(ws_name, ws_id);
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
