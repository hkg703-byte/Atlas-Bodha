BEGIN;

CREATE TABLE external_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_salt BYTEA,
  password_hash BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_identities_provider_subject_unique UNIQUE (provider, subject),
  CONSTRAINT external_identities_password_credentials_check CHECK (
    provider <> 'password'
    OR (password_salt IS NOT NULL AND password_hash IS NOT NULL)
  )
);

CREATE INDEX external_identities_user_id_idx
  ON external_identities(user_id);

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT auth_sessions_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_active_token_idx
  ON auth_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
