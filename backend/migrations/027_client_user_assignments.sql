-- Migration: Add client user assignments for checklist module
-- Created: 2026-02-03
-- This allows workspace owners/admins to assign users to specific clients
-- Users can only see checklists for clients they are assigned to

-- ============================================
-- CLIENT USER ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS client_user_assignments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    UNIQUE(client_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_client_user_assignments_client_id ON client_user_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_user_assignments_user_id ON client_user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_client_user_assignments_workspace_id ON client_user_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_user_assignments_active ON client_user_assignments(client_id, user_id) WHERE is_active = TRUE;

-- Add comments
COMMENT ON TABLE client_user_assignments IS 'Assigns workspace users to specific clients for checklist access';
COMMENT ON COLUMN client_user_assignments.client_id IS 'The client the user is assigned to';
COMMENT ON COLUMN client_user_assignments.user_id IS 'The user being assigned to the client';
COMMENT ON COLUMN client_user_assignments.workspace_id IS 'The workspace this assignment belongs to';
COMMENT ON COLUMN client_user_assignments.assigned_by IS 'Admin/Owner who made the assignment';
COMMENT ON COLUMN client_user_assignments.is_active IS 'Whether the assignment is currently active';
