BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE conversations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL
REFERENCES users(id)
ON DELETE CASCADE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE messages (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
conversation_id UUID NOT NULL
REFERENCES conversations(id)
ON DELETE CASCADE,
sequence_number BIGINT NOT NULL,
role TEXT NOT NULL
CHECK (role IN ('person', 'assistant')),
content TEXT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT messages_conversation_sequence_unique
UNIQUE (conversation_id, sequence_number)
);
CREATE INDEX conversations_user_id_idx
ON conversations(user_id);
CREATE INDEX conversations_user_created_idx
ON conversations(user_id, created_at DESC);
CREATE INDEX messages_conversation_id_idx
ON messages(conversation_id);
CREATE INDEX messages_conversation_sequence_idx
ON messages(conversation_id, sequence_number);
COMMIT;
