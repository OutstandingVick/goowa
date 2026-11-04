import { and, asc, desc, eq } from "drizzle-orm";

import { receiptHashOf, sha256Hex } from "../../shared/canonical.js";
import type { Receipt } from "../../shared/receipt.js";
import { effectiveStatus } from "../../shared/status.js";
import { getDb, schema } from "../db/index.js";
import { goowaErrors } from "./actor.js";
import { loadClaims } from "./documents.js";

const HISTORY_KINDS = new Set([
  "edit_proposed",
  "edit_decided",
  "claim_updated",
  "propagated",
  "verified",
  "override",
  "publish_blocked",
  "published",
  "review_cleared",
]);

/**
 * Build, freeze, and store the receipt for a document's just-published
 * revision. Source text is snapshotted so evidence offsets stay checkable
 * after the live source changes.
 */
export async function createReceipt(documentId: string): Promise<Receipt> {
  const db = getDb();
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  if (!doc || doc.status !== "published" || !doc.publishedAt) {
    return goowaErrors.fail(
      "Only published documents get a receipt.",
      "conflict",
    );
  }
  const [claims, sources, overrides, activity] = await Promise.all([
    loadClaims(documentId),
    db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.documentId, documentId)),
    db
      .select()
      .from(schema.publishOverrides)
      .where(
        and(
          eq(schema.publishOverrides.documentId, documentId),
          eq(schema.publishOverrides.revision, doc.revision),
        ),
      ),
    db
      .select()
      .from(schema.activity)
      .where(eq(schema.activity.documentId, documentId))
      .orderBy(asc(schema.activity.createdAt)),
  ]);

  const excluded = (s: { flags: string[] }) =>
    s.flags.includes("quarantined") || s.flags.includes("injection_suspected");
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const receiptClaims: Receipt["claims"] = claims.map((c, i) => {
    const status = effectiveStatus(c, sources);
    const human =
      status !== "quarantined" && c.status !== "unverified"
        ? { status: c.status, note: c.humanNote }
        : null;
    return {
      id: c.id,
      index: i + 1,
      text: c.text,
      span: { start: c.spanStart, end: c.spanEnd },
      status,
      verdict: c.verdict
        ? {
            value: c.verdict,
            reason: c.verdictReason,
            confidence: c.verdictConfidence,
          }
        : null,
      human,
      // Evidence from quarantined sources is never part of a receipt.
      evidence: c.evidence
        .filter((e) => {
          const s = sourceById.get(e.sourceId);
          return s && !excluded(s);
        })
        .map((e) => {
          const s = sourceById.get(e.sourceId)!;
          return {
            sourceId: e.sourceId,
            sourceUrl: s.url,
            snippet: e.snippet,
            startOffset: e.startOffset,
            endOffset: e.endOffset,
            matchType: e.matchType,
            sourceContentHash: s.contentHash,
            verifiedAt: c.verifiedAt,
            verifiedBy: c.verifiedBy,
          };
        }),
      overrides: overrides
        .filter((o) => o.claimId === c.id)
        .map((o) => ({ kind: o.kind, reason: o.reason })),
    };
  });

  const byStatus: Record<string, number> = {};
  for (const c of receiptClaims)
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

  const body: Omit<Receipt, "receiptHash"> = {
    version: 1,
    document: {
      id: doc.id,
      title: doc.title,
      revision: doc.revision,
      publishedAt: doc.publishedAt,
      publishedBy: "human",
      body: doc.body,
      bodyHash: await sha256Hex(doc.body),
    },
    claims: receiptClaims,
    // Every source on the document, so quarantined ones are visible too.
    sources: sources.map((s) => ({
      id: s.id,
      url: s.url,
      title: s.title,
      contentHash: s.contentHash,
      fetchedAt: s.fetchedAt,
      flags: [...s.flags].sort(),
      excluded: excluded(s),
    })),
    summary: {
      claims: receiptClaims.length,
      byStatus,
      overrides: overrides.length,
      agentPublishAttemptsBlocked: activity.filter(
        (a) => a.kind === "publish_blocked" && a.actor === "agent",
      ).length,
    },
    history: activity
      .filter((a) => HISTORY_KINDS.has(a.kind))
      .map((a) => ({
        at: a.createdAt,
        actor: a.actor,
        kind: a.kind,
        summary: a.summary,
      })),
  };
  const receipt: Receipt = { ...body, receiptHash: await receiptHashOf(body) };

  // Freeze the text of every source the evidence points into.
  for (const s of sources.filter(
    (s) =>
      !excluded(s) &&
      receiptClaims.some((c) => c.evidence.some((e) => e.sourceId === s.id)),
  )) {
    await db
      .insert(schema.sourceSnapshots)
      .values({
        id: crypto.randomUUID(),
        documentId,
        sourceId: s.id,
        contentHash: s.contentHash,
        fullText: s.fullText,
      })
      .onConflictDoNothing();
  }
  await db.insert(schema.receipts).values({
    id: crypto.randomUUID(),
    documentId,
    revision: doc.revision,
    json: JSON.stringify(receipt),
    receiptHash: receipt.receiptHash,
  });
  return receipt;
}

/** The stored receipt for a revision (latest when omitted). */
export async function loadReceipt(documentId: string, revision?: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.receipts)
    .where(
      revision === undefined
        ? eq(schema.receipts.documentId, documentId)
        : and(
            eq(schema.receipts.documentId, documentId),
            eq(schema.receipts.revision, revision),
          ),
    )
    .orderBy(desc(schema.receipts.revision))
    .limit(1);
  return rows[0] ?? null;
}

/** Frozen source texts by content hash, for checking a receipt's evidence. */
export async function snapshotsFor(
  documentId: string,
): Promise<Map<string, string>> {
  const rows = await getDb()
    .select()
    .from(schema.sourceSnapshots)
    .where(eq(schema.sourceSnapshots.documentId, documentId));
  return new Map(rows.map((r) => [r.contentHash, r.fullText]));
}
