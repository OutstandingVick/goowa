import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, real, text } from "drizzle-orm/pg-core";

export type InjectionFinding = { snippet: string; reason: string };
export type Evidence = {
  sourceId: string;
  snippet: string;
  startOffset: number;
  endOffset: number;
  matchType: "exact" | "paraphrase" | "none";
};

// "human" | "agent" columns are named *_kind, not created_by/updated_by: the
// framework treats those names as member emails (identity columns).

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("draft"),
  revision: integer("revision").notNull().default(1),
  publishedAt: text("published_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
  ...ownableColumns(),
});
export const documentShares = createSharesTable("document_shares");

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  url: text("url").notNull(),
  title: text("title").notNull().default(""),
  textExcerpt: text("text_excerpt").notNull().default(""),
  contentHash: text("content_hash").notNull().default(""),
  fetchedAt: text("fetched_at").notNull(),
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
  error: jsonb("error").$type<{ code: string; message: string } | null>(),
  // Full readable text with suspicious spans stripped (see injection scan).
  fullText: text("full_text").notNull().default(""),
  injectionFindings: jsonb("injection_findings")
    .$type<InjectionFinding[]>()
    .notNull()
    .default([]),
});

export const claims = pgTable("claims", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  text: text("text").notNull(),
  spanStart: integer("span_start").notNull(),
  spanEnd: integer("span_end").notNull(),
  sourceIds: jsonb("source_ids").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("unverified"),
  confidence: real("confidence").notNull().default(0),
  dependsOn: jsonb("depends_on").$type<string[]>().notNull().default([]),
  createdBy: text("creator_kind").notNull(),
  updatedBy: text("updater_kind").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
  // Machine verification, kept apart from the human-controlled `status`.
  verdict: text("verdict"),
  verdictReason: text("verdict_reason"),
  verdictConfidence: real("verdict_confidence"),
  evidence: jsonb("evidence").$type<Evidence[]>().notNull().default([]),
  closestPassage: jsonb("closest_passage").$type<Evidence | null>(),
  verifiedAt: text("verified_at"),
  verifiedBy: text("verifier_kind"),
  verifiedFingerprint: text("verified_fingerprint"),
  humanNote: text("human_note"),
  // Dependency propagation: set when an upstream claim changes.
  reviewState: text("review_state").notNull().default("ok"),
  reviewReason: text("review_reason"),
  lastPropagatedFrom: text("last_propagated_from"),
});

export const edits = pgTable("edits", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  spanStart: integer("span_start"),
  before: text("before").notNull(),
  after: text("after").notNull(),
  reason: text("reason").notNull().default(""),
  proposedBy: text("proposer_kind").notNull(),
  state: text("state").notNull().default("proposed"),
  decidedBy: text("decider_kind"),
  decidedAt: text("decided_at"),
  changeSetId: text("change_set_id"),
  triggeredByClaimId: text("triggered_by_claim_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const changeSets = pgTable("change_sets", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  triggerClaimId: text("trigger_claim_id").notNull(),
  triggeredBy: text("trigger_kind").notNull(),
  // The trigger claim's text before the change, to recompute figures later.
  triggerBeforeText: text("trigger_before_text"),
  summary: text("summary").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const activity = pgTable("activity", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  kind: text("kind").notNull(),
  actor: text("actor_kind").notNull(),
  summary: text("summary").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const publishOverrides = pgTable("publish_overrides", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  revision: integer("revision").notNull(),
  claimId: text("claim_id"),
  sourceId: text("source_id"),
  kind: text("kind").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const documentRevisions = pgTable("document_revisions", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  revision: integer("revision").notNull(),
  body: text("body").notNull(),
  publishedAt: text("published_at").notNull(),
});
