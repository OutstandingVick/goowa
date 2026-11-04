import { getDb, schema } from "../db/index.js";
import type { Actor } from "./actor.js";
import { now } from "./documents.js";

export type ActivityKind =
  | "edit_proposed"
  | "edit_decided"
  | "claim_updated"
  | "verified"
  | "propagated"
  | "publish_requested"
  | "publish_blocked"
  | "published"
  | "override"
  | "reopened"
  | "review_cleared";

/** Append one event to a document's activity feed. */
export async function logActivity(
  documentId: string,
  kind: ActivityKind,
  actor: Actor,
  summary: string,
  data: Record<string, unknown> = {},
) {
  await getDb().insert(schema.activity).values({
    id: crypto.randomUUID(),
    documentId,
    kind,
    actor,
    summary,
    data,
    createdAt: now(),
  });
}
