-- ============================================
-- Migration: 009_saved_views.sql
-- Saved Views for Tasks Section
-- ============================================

-- Saved Views Table
CREATE TABLE IF NOT EXISTS saved_views (
    id SERIAL PRIMARY KEY,
    
    -- Context
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for org-wide views
    
    -- View configuration
    name VARCHAR(100) NOT NULL,
    description TEXT,
    view_type VARCHAR(20) NOT NULL DEFAULT 'table' CHECK (view_type IN ('table', 'calendar', 'board')),
    
    -- Configuration JSON
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- config stores: filters, sorting, grouping, columns, etc.
    
    -- Sharing
    visibility VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'team', 'org')),
    is_default BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_views_workspace ON saved_views(workspace_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_views(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_visibility ON saved_views(visibility);

-- User preferences for tasks section
CREATE TABLE IF NOT EXISTS task_user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Preferences
    default_view_id INTEGER REFERENCES saved_views(id) ON DELETE SET NULL,
    default_view_type VARCHAR(20) DEFAULT 'table',
    selected_projects INTEGER[] DEFAULT '{}',
    column_order TEXT[] DEFAULT '{}',
    column_visibility JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, workspace_id)
);

-- Insert default views
-- These will be created per workspace on first access

COMMENT ON TABLE saved_views IS 'Stores saved view configurations for the Tasks section';
COMMENT ON TABLE task_user_preferences IS 'Stores user-specific preferences for the Tasks section';
