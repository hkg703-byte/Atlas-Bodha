CREATE TABLE memories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id),
 content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
 origin TEXT NOT NULL CHECK (origin IN ('person_request','atlas_suggestion')),
 confidence TEXT NOT NULL CHECK (confidence IN ('stated','inferred')),
 source_message_id UUID REFERENCES messages(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX memories_user_created ON memories(user_id, created_at DESC);
CREATE TABLE consent_records (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id),
 consent_type TEXT NOT NULL,
 granted BOOLEAN NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX consent_user_latest ON consent_records(user_id,consent_type,recorded_at DESC);
CREATE FUNCTION protect_consent_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Consent records are append-only'; END;
$$;
CREATE TRIGGER consent_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON consent_records
FOR EACH STATEMENT EXECUTE FUNCTION protect_consent_ledger();
-- Only a request marker, never proposal content. Prevents repeated provider calls.
CREATE TABLE memory_proposal_attempts (
 source_message_id UUID PRIMARY KEY REFERENCES messages(id),
 attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
