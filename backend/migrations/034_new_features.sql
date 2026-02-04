-- Migration 034: New Features
-- 1. Task approval tagging (designate a member to approve tasks per project)
-- 2. Project ownership transfer support
-- 3. File attachments for tasks, clients, and chat

-- =====================================================
-- 1. TASK APPROVAL TAGGING (per project)
-- Only one member can be tagged as approver per project
-- =====================================================

-- Add approval_tagged_member column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS approval_tagged_member_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_approval_tagged_member ON projects(approval_tagged_member_id) WHERE approval_tagged_member_id IS NOT NULL;

-- Add approver_id to approvals table for tracking who should approve
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- 2. PROJECT OWNERSHIP TRANSFER TRACKING
-- =====================================================

-- Track ownership transfer history
CREATE TABLE IF NOT EXISTS project_ownership_transfers (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transferred_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_ownership_transfers_project ON project_ownership_transfers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_ownership_transfers_to_user ON project_ownership_transfers(to_user_id);

-- =====================================================
-- 3. FILE ATTACHMENTS
-- Universal attachments table for tasks, clients, and chat
-- =====================================================

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  -- Polymorphic association
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'client', 'chat_message')),
  entity_id INTEGER NOT NULL,
  
  -- File metadata
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  
  -- Optional metadata
  description TEXT,
  
  -- Audit fields
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_workspace ON attachments(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);

-- Comment for documentation
COMMENT ON TABLE attachments IS 'Universal file attachments for tasks, clients, and chat messages';
COMMENT ON COLUMN attachments.entity_type IS 'Type of entity: task, client, or chat_message';
COMMENT ON COLUMN attachments.entity_id IS 'ID of the related entity (task_id, client_id, or message_id)';
