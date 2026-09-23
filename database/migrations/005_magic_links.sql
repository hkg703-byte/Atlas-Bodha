BEGIN;
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN adult_attested_at TIMESTAMPTZ;
CREATE TABLE magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (email = lower(email)),
  token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  consumed_at TIMESTAMPTZ,
  request_ip TEXT NOT NULL,
  first_name TEXT,
  adult_attested_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX magic_link_email_window ON magic_link_tokens(email, created_at);
CREATE INDEX magic_link_ip_window ON magic_link_tokens(request_ip, created_at);
CREATE INDEX users_signup_window ON users(created_at);
COMMIT;
