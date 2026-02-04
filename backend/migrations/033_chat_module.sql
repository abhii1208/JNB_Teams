-- =====================================================
-- Chat Module Migration
-- Workspace-scoped chat with DMs and Group threads
-- =====================================================

-- Chat Threads: DM or Group conversations
CREATE TABLE IF NOT EXISTS chat_threads (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('dm', 'group')),
  name VARCHAR(100), -- Only for group chats; NULL for DMs
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_workspace ON chat_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_type ON chat_threads(workspace_id, type);

-- Chat Thread Members: who can see/participate in each thread
CREATE TABLE IF NOT EXISTS chat_thread_members (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMP, -- Tracks when user last read messages (for unread count)
  last_read_message_id INTEGER, -- Last message ID the user has read
  UNIQUE(thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_thread_members_user ON chat_thread_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_thread_members_thread ON chat_thread_members(thread_id);

-- Chat Messages: actual chat content
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  -- Mentions stored as JSONB array: [{ type: 'user'|'project'|'task', id: number, display: string }]
  mentions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(thread_id, created_at DESC);

-- DM Pair Index: Ensures only one DM thread per pair in a workspace
-- We'll enforce this via application logic, but add a helper view
CREATE OR REPLACE VIEW chat_dm_pairs AS
SELECT 
  ct.id AS thread_id,
  ct.workspace_id,
  LEAST(m1.user_id, m2.user_id) AS user1_id,
  GREATEST(m1.user_id, m2.user_id) AS user2_id
FROM chat_threads ct
JOIN chat_thread_members m1 ON m1.thread_id = ct.id
JOIN chat_thread_members m2 ON m2.thread_id = ct.id AND m2.user_id > m1.user_id
WHERE ct.type = 'dm';

-- Function to update thread updated_at when messages are added
CREATE OR REPLACE FUNCTION update_chat_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update thread timestamp on new message
DROP TRIGGER IF EXISTS trg_update_chat_thread_timestamp ON chat_messages;
CREATE TRIGGER trg_update_chat_thread_timestamp
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_chat_thread_timestamp();
