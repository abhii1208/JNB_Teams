-- Migration: 037_notification_enhancements.sql
-- Enhance notifications table with action URLs and metadata

-- Add new columns to notifications table for dynamic URLs and metadata
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS action_url TEXT,
ADD COLUMN IF NOT EXISTS action_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS chat_thread_id INTEGER REFERENCES chat_threads(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS chat_message_id INTEGER,
ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Create index for workspace-based queries
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Task notifications
  task_assigned BOOLEAN DEFAULT TRUE,
  task_unassigned BOOLEAN DEFAULT TRUE,
  task_due_date_changed BOOLEAN DEFAULT TRUE,
  task_mentioned BOOLEAN DEFAULT TRUE,
  task_attachment BOOLEAN DEFAULT TRUE,
  task_comment BOOLEAN DEFAULT TRUE,
  task_completed BOOLEAN DEFAULT TRUE,
  task_liked BOOLEAN DEFAULT TRUE,
  task_dependency_changed BOOLEAN DEFAULT TRUE,
  -- Comment/attachment likes
  comment_liked BOOLEAN DEFAULT TRUE,
  attachment_liked BOOLEAN DEFAULT TRUE,
  -- Chat notifications
  chat_direct_message BOOLEAN DEFAULT TRUE,
  chat_group_message BOOLEAN DEFAULT TRUE,
  chat_mentioned BOOLEAN DEFAULT TRUE,
  -- Project notifications
  project_settings_changed BOOLEAN DEFAULT TRUE,
  project_member_added BOOLEAN DEFAULT TRUE,
  project_member_removed BOOLEAN DEFAULT TRUE,
  project_role_changed BOOLEAN DEFAULT TRUE,
  -- Client notifications
  client_added BOOLEAN DEFAULT TRUE,
  client_changed BOOLEAN DEFAULT TRUE,
  -- Approval notifications
  approval_requested BOOLEAN DEFAULT TRUE,
  approval_approved BOOLEAN DEFAULT TRUE,
  approval_rejected BOOLEAN DEFAULT TRUE,
  -- Delivery settings
  email_enabled BOOLEAN DEFAULT TRUE,
  email_digest VARCHAR(20) DEFAULT 'realtime', -- realtime, hourly, daily, weekly, never
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, workspace_id)
);

-- Create notification type enum reference
COMMENT ON COLUMN notifications.type IS 'Notification types: task_assigned, task_unassigned, task_due_changed, task_mentioned, task_attachment, task_comment, task_completed, task_liked, comment_liked, attachment_liked, completion_liked, dependency_changed, chat_message, chat_group_message, chat_mentioned, project_settings, project_member, client_added, client_changed, approval_requested, approval_approved, approval_rejected, ownership_transferred';

-- Create index for notification preferences lookup
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_workspace ON notification_preferences(workspace_id);
