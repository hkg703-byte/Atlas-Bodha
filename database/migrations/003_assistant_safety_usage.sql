BEGIN;
ALTER TABLE messages ADD COLUMN safety_tier SMALLINT CHECK (safety_tier BETWEEN 0 AND 3);
CREATE TABLE assistant_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  person_message_id UUID NOT NULL REFERENCES messages(id),
  kind TEXT NOT NULL CHECK (kind IN ('reply','preview')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);
CREATE INDEX assistant_generations_user_time_idx ON assistant_generations(user_id, created_at);
CREATE UNIQUE INDEX assistant_generations_pending_conversation_idx ON assistant_generations(conversation_id) WHERE status = 'pending';
CREATE UNIQUE INDEX assistant_generations_reply_once_idx ON assistant_generations(person_message_id) WHERE status = 'completed' AND kind = 'reply';
COMMIT;
