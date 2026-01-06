-- Migration: allow 'ProjectAdmin' as a workspace role
-- Drop the previous role check (if named workspace_members_role_check) and recreate
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('Owner', 'Admin', 'ProjectAdmin', 'Member'));

