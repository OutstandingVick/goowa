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
  ],
  { table: "goowa_migrations" },
);
