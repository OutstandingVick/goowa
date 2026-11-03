import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, real, text } from "drizzle-orm/pg-core";

// "human" | "agent" columns are named *_kind, not created_by/updated_by: the
// framework treats those names as member emails (identity columns).

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("draft"),
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
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});
