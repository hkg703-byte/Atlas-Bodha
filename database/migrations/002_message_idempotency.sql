BEGIN;
CREATE TABLE idempotency_keys (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL
REFERENCES users(id)
ON DELETE CASCADE,
key TEXT NOT NULL,
operation TEXT NOT NULL,
resource_id UUID,
created_at TIMESTAMPTZ NOT NULL
DEFAULT NOW(),
CONSTRAINT idempotency_keys_user_operation_key_unique
UNIQUE (user_id, operation, key)
);
CREATE INDEX idempotency_keys_created_at_idx
ON idempotency_keys(created_at);
COMMIT;
