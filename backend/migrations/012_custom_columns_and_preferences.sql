-- =====================================================
-- Migration 012: Custom Columns (Category/Section) & User Preferences
-- =====================================================

-- =====================================================
-- 1. PROJECT CUSTOM COLUMN OPTIONS (Category/Section dropdown values)
-- =====================================================

-- Table to store project-specific dropdown options for Category and Section
CREATE TABLE IF NOT EXISTS project_column_options (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_name VARCHAR(50) NOT NULL CHECK (column_name IN ('category', 'section')),
  option_value VARCHAR(100) NOT NULL,
  display_order INTEGER DEFAULT 0,
  color VARCHAR(20) DEFAULT '#64748b',
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, column_name, option_value)
);

CREATE INDEX IF NOT EXISTS idx_project_column_options_project ON project_column_options(project_id);
CREATE INDEX IF NOT EXISTS idx_project_column_options_column ON project_column_options(project_id, column_name);

-- =====================================================
-- 2. ADD CUSTOM COLUMNS TO TASKS TABLE
-- =====================================================

-- Add category and section columns to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS section VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100);

CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(project_id, category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(project_id, section) WHERE section IS NOT NULL;

-- =====================================================
-- 3. PROJECT SETTINGS FOR CUSTOM COLUMNS
-- =====================================================

-- Add column configuration to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS enable_category BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_section BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_estimated_hours BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_actual_hours BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_tags BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_external_id BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_completion_percentage BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_column_settings JSONB DEFAULT '{}'::jsonb;

-- =====================================================
-- 4. USER VIEW PREFERENCES (Comprehensive state persistence)
-- =====================================================

-- Create table for user view preferences per workspace
CREATE TABLE IF NOT EXISTS user_view_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- View type preferences
  last_view_type VARCHAR(20) DEFAULT 'table',
  
  -- Column visibility (which columns to show/hide)
  visible_columns JSONB DEFAULT '["name", "project_name", "stage", "status", "priority", "assignee_name", "due_date", "target_date", "created_at"]'::jsonb,
  
  -- Column order (user can reorder columns)
  column_order JSONB DEFAULT '[]'::jsonb,
  
  -- Filters state
  filters JSONB DEFAULT '{}'::jsonb,
  
  -- Sorting state
  sort_by VARCHAR(50) DEFAULT 'created_at',
  sort_order VARCHAR(10) DEFAULT 'desc',
  
  -- Grouping state
  group_by VARCHAR(50) DEFAULT NULL,
  
  -- Calendar preferences
  calendar_view_mode VARCHAR(20) DEFAULT 'month',
  calendar_date_mode VARCHAR(20) DEFAULT 'due',
  calendar_density VARCHAR(20) DEFAULT 'comfortable',
  
  -- Board preferences  
  board_group_by VARCHAR(50) DEFAULT 'status',
  
  -- Pagination
  page_size INTEGER DEFAULT 50,
  
  -- Selected project filter (remembered)
  selected_projects JSONB DEFAULT '[]'::jsonb,
  
  -- Active saved view (if any)
  active_saved_view_id INTEGER DEFAULT NULL,
  
  -- Last active date (for session tracking)
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_user_view_prefs_user ON user_view_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_view_prefs_workspace ON user_view_preferences(workspace_id);

-- =====================================================
-- 5. COLUMN COPY HISTORY (for audit trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS column_copy_history (
  id SERIAL PRIMARY KEY,
  source_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_name VARCHAR(50) NOT NULL,
  copied_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  options_copied INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. DEFAULT DATA SETUP
-- =====================================================

-- Update existing projects to have default column settings
UPDATE projects
SET 
  enable_category = false,
  enable_section = false,
  enable_estimated_hours = false,
  enable_actual_hours = false,
  enable_tags = false,
  enable_external_id = false,
  enable_completion_percentage = false,
  custom_column_settings = '{}'::jsonb
WHERE enable_category IS NULL;

-- =====================================================
-- 7. HELPER FUNCTION FOR COLUMN COPY VALIDATION
-- =====================================================

CREATE OR REPLACE FUNCTION can_copy_column_options(
  p_source_project_id INTEGER,
  p_target_project_id INTEGER,
  p_user_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_source_owner BOOLEAN;
  v_target_owner BOOLEAN;
BEGIN
  -- Check if user is owner of source project
  SELECT EXISTS(
    SELECT 1 FROM project_members 
    WHERE project_id = p_source_project_id 
    AND user_id = p_user_id 
    AND role = 'Owner'
  ) INTO v_source_owner;
  
  -- Check if user is owner of target project
  SELECT EXISTS(
    SELECT 1 FROM project_members 
    WHERE project_id = p_target_project_id 
    AND user_id = p_user_id 
    AND role = 'Owner'
  ) INTO v_target_owner;
  
  RETURN v_source_owner AND v_target_owner;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_view_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_view_prefs_updated ON user_view_preferences;
CREATE TRIGGER trigger_user_view_prefs_updated
  BEFORE UPDATE ON user_view_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_view_preferences_timestamp();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
