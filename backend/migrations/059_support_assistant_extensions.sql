CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT support_tickets_status_check CHECK (status IN ('Open', 'In Progress', 'Resolved'))
);

CREATE TABLE IF NOT EXISTS support_ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS support_ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE;

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS support_ticket_created BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS support_ticket_response BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS support_ticket_status_changed BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_status
  ON support_tickets(workspace_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_creator
  ON support_tickets(created_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_ticket_created_at
  ON support_ticket_comments(ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_notifications_support_ticket
  ON notifications(support_ticket_id);
