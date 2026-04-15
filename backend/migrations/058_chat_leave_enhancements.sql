ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS intro_text TEXT,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'workspace';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'chat_threads'
      AND constraint_name = 'chat_threads_type_check'
  ) THEN
    ALTER TABLE chat_threads DROP CONSTRAINT chat_threads_type_check;
  END IF;
END $$;

ALTER TABLE chat_threads
  ADD CONSTRAINT chat_threads_type_check
  CHECK (type IN ('dm', 'group', 'channel'));

ALTER TABLE chat_threads
  ADD CONSTRAINT chat_threads_visibility_check
  CHECK (visibility IN ('workspace', 'management'));

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS parent_message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pinned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_parent ON chat_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned ON chat_messages(thread_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS special_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS current_stage_order INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS policy_rule VARCHAR(50);

ALTER TABLE leave_approval_stages
  ADD COLUMN IF NOT EXISTS acted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS comments TEXT;

CREATE INDEX IF NOT EXISTS idx_leave_approval_stages_leave_stage
  ON leave_approval_stages(leave_request_id, stage_order);
