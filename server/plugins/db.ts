import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "goowa-core-tables",
      sql: `CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published')),
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE TABLE IF NOT EXISTS document_shares (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  notified_at TEXT
);
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  text_excerpt TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  error JSONB
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  span_start INTEGER NOT NULL,
  span_end INTEGER NOT NULL,
  source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'supported', 'weak', 'unsupported', 'quarantined')),
  confidence REAL NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  depends_on JSONB NOT NULL DEFAULT '[]'::jsonb,
  creator_kind TEXT NOT NULL CHECK (creator_kind IN ('human', 'agent')),
  updater_kind TEXT NOT NULL CHECK (updater_kind IN ('human', 'agent')),
  updated_at TEXT NOT NULL DEFAULT (now()),
  CHECK (span_end >= span_start AND span_start >= 0)
);
CREATE TABLE IF NOT EXISTS edits (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('document_body', 'claim')),
  target_id TEXT NOT NULL,
  span_start INTEGER,
  before TEXT NOT NULL,
  after TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  proposer_kind TEXT NOT NULL CHECK (proposer_kind IN ('human', 'agent')),
  state TEXT NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'accepted', 'rejected')),
  decider_kind TEXT CHECK (decider_kind = 'human'),
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS documents_owner_org_idx ON documents (owner_email, org_id);
CREATE INDEX IF NOT EXISTS document_shares_resource_idx ON document_shares (resource_id, principal_type, principal_id);
CREATE INDEX IF NOT EXISTS sources_document_idx ON sources (document_id);
CREATE INDEX IF NOT EXISTS claims_document_idx ON claims (document_id);
CREATE INDEX IF NOT EXISTS edits_document_state_idx ON edits (document_id, state)`,
    },
    {
      version: 2,
      name: "goowa-verification",
      sql: `ALTER TABLE sources ADD COLUMN IF NOT EXISTS full_text TEXT NOT NULL DEFAULT '';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS injection_findings JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS verdict TEXT CHECK (verdict IN ('supported', 'weak', 'unsupported', 'laundered', 'unverifiable'));
ALTER TABLE claims ADD COLUMN IF NOT EXISTS verdict_reason TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS verdict_confidence REAL CHECK (verdict_confidence >= 0 AND verdict_confidence <= 1);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS closest_passage JSONB;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS verified_at TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS verifier_kind TEXT CHECK (verifier_kind IN ('human', 'agent'));
ALTER TABLE claims ADD COLUMN IF NOT EXISTS verified_fingerprint TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS human_note TEXT`,
    },
    {
      version: 3,
      name: "goowa-propagation-and-publish",
      sql: `ALTER TABLE documents ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS published_at TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'ok' CHECK (review_state IN ('ok', 'needs_review'));
ALTER TABLE claims ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS last_propagated_from TEXT;
ALTER TABLE edits ADD COLUMN IF NOT EXISTS change_set_id TEXT;
ALTER TABLE edits ADD COLUMN IF NOT EXISTS triggered_by_claim_id TEXT;
CREATE TABLE IF NOT EXISTS change_sets (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  trigger_claim_id TEXT NOT NULL,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('human', 'agent')),
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  summary TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS publish_overrides (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  claim_id TEXT,
  source_id TEXT,
  kind TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS document_revisions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  body TEXT NOT NULL,
  published_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS change_sets_document_idx ON change_sets (document_id, created_at);
CREATE INDEX IF NOT EXISTS activity_document_idx ON activity (document_id, created_at);
CREATE INDEX IF NOT EXISTS edits_change_set_idx ON edits (change_set_id)`,
    },
  ],
  { table: "goowa_migrations" },
);
