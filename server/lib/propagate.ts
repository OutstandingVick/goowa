import { and, eq, inArray } from "drizzle-orm";

import { changedFigure, deriveRewrite } from "../../shared/derive.js";
import { downstream } from "../../shared/graph.js";
import { getDb, schema } from "../db/index.js";
import { logActivity } from "./activity.js";
import type { Actor } from "./actor.js";
import { afterResponse, mapLimit } from "./background.js";
import { loadClaims, now } from "./documents.js";
import { verifyAndStore } from "./verify.js";

export type PropagationResult = {
  changeSetId: string;
  summary: string;
  triggerClaimId: string;
  affected: {
    claimId: string;
    label: string;
    depth: number;
    /** Null until the background re-check stores a verdict. */
    verdict: string | null;
  }[];
  proposals: {
    editId: string;
    claimId: string;
    before: string;
    after: string;
    reason: string;
  }[];
  needsAgent: { claimId: string; label: string }[];
  durationMs: number;
};

/**
 * Mark everything downstream of a changed claim for review, re-verify it,
 * and propose deterministic figure rewrites, all in one change set.
 * `previousText` is the claim's text before the change, when it changed.
 */
export async function propagateChange(opts: {
  claimId: string;
  actor: Actor;
  ownerEmail: string;
  previousText?: string | null;
}): Promise<PropagationResult | null> {
  const started = Date.now();
  const db = getDb();
  const [trigger] = await db
    .select()
    .from(schema.claims)
    .where(eq(schema.claims.id, opts.claimId))
    .limit(1);
  if (!trigger) return null;
  const claims = await loadClaims(trigger.documentId);
  const label = (id: string) => `#${claims.findIndex((c) => c.id === id) + 1}`;
  const affected = downstream(claims, trigger.id, 5);
  if (affected.length === 0) return null;

  const figure =
    opts.previousText && opts.previousText !== trigger.text
      ? changedFigure(opts.previousText, trigger.text)
      : null;
  const what = figure
    ? `changed from ${figure.before.raw.trim()} to ${figure.after.raw.trim()}`
    : "changed";

  // Earlier proposals from this trigger that nobody decided are superseded.
  // The dependents they target still reflect the text before that earlier
  // change, so recompute from it.
  const superseded = await db
    .select({ edit: schema.edits, set: schema.changeSets })
    .from(schema.edits)
    .innerJoin(
      schema.changeSets,
      eq(schema.edits.changeSetId, schema.changeSets.id),
    )
    .where(
      and(
        eq(schema.edits.documentId, trigger.documentId),
        eq(schema.edits.triggeredByClaimId, trigger.id),
        eq(schema.edits.state, "proposed"),
      ),
    );
  const baseTextFor = new Map<string, string>();
  for (const row of superseded) {
    if (row.set.triggerBeforeText)
      baseTextFor.set(row.edit.targetId, row.set.triggerBeforeText);
  }
  if (superseded.length > 0) {
    await db.delete(schema.edits).where(
      inArray(
        schema.edits.id,
        superseded.map((r) => r.edit.id),
      ),
    );
  }

  const changeSetId = crypto.randomUUID();
  const result: PropagationResult = {
    changeSetId,
    summary: "",
    triggerClaimId: trigger.id,
    affected: [],
    proposals: [],
    needsAgent: [],
    durationMs: 0,
  };

  for (const a of affected) {
    const claim = claims.find((c) => c.id === a.id)!;
    const via =
      a.via === trigger.id
        ? label(trigger.id)
        : `${label(a.via)} (via ${label(trigger.id)})`;
    const base = baseTextFor.get(claim.id);
    const claimFigure = base ? changedFigure(base, trigger.text) : figure;
    const claimWhat = claimFigure
      ? `changed from ${claimFigure.before.raw.trim()} to ${claimFigure.after.raw.trim()}`
      : what;
    const reason = `Depends on claim ${via}, which ${a.via === trigger.id ? claimWhat : "may change"}`;
    await db
      .update(schema.claims)
      .set({
        reviewState: "needs_review",
        reviewReason: reason,
        lastPropagatedFrom: trigger.id,
        verifiedFingerprint: null,
        updatedAt: now(),
      })
      .where(
        and(
          eq(schema.claims.id, claim.id),
          eq(schema.claims.documentId, trigger.documentId),
        ),
      );

    // The re-check runs after the response (see below); the fingerprint was
    // just cleared, so the claim reads as pending until then.
    result.affected.push({
      claimId: claim.id,
      label: label(claim.id),
      depth: a.depth,
      verdict: null,
    });

    // Only direct dependents can be recomputed from the changed figure.
    const rewrite =
      claimFigure && a.via === trigger.id
        ? deriveRewrite(claim.text, claimFigure)
        : null;
    if (rewrite) {
      const editId = crypto.randomUUID();
      const editReason = `${reason}. Recomputed in code: ${rewrite.changes.map((c) => `${c.from} → ${c.to} (${c.explanation})`).join("; ")}.`;
      await db.insert(schema.edits).values({
        id: editId,
        documentId: trigger.documentId,
        targetType: "claim",
        targetId: claim.id,
        spanStart: claim.spanStart,
        before: claim.text,
        after: rewrite.text,
        reason: editReason,
        // Proposed on the agent's side: the human still decides.
        proposedBy: "agent",
        state: "proposed",
        changeSetId,
        triggeredByClaimId: trigger.id,
        createdAt: now(),
      });
      result.proposals.push({
        editId,
        claimId: claim.id,
        before: claim.text,
        after: rewrite.text,
        reason: editReason,
      });
    } else {
      result.needsAgent.push({ claimId: claim.id, label: label(claim.id) });
    }
  }

  const n = result.affected.length;
  const p = result.proposals.length;
  const who = opts.actor === "human" ? "You" : "The agent";
  const affectedText = `${n} claim${n === 1 ? "" : "s"} affected`;
  result.summary =
    p > 0
      ? `${who} changed claim ${label(trigger.id)} → ${affectedText} → ${p} rewrite${p === 1 ? "" : "s"} proposed`
      : `${who} changed claim ${label(trigger.id)} → ${affectedText}, marked for review`;
  result.durationMs = Date.now() - started;
  // Nothing depends on this claim: no change set, no feed entry.
  if (n === 0) return result;
  await db.insert(schema.changeSets).values({
    id: changeSetId,
    documentId: trigger.documentId,
    triggerClaimId: trigger.id,
    triggeredBy: opts.actor,
    triggerBeforeText: opts.previousText ?? null,
    summary: result.summary,
    createdAt: now(),
  });
  await logActivity(
    trigger.documentId,
    "propagated",
    opts.actor,
    result.summary,
    {
      changeSetId,
      triggerClaimId: trigger.id,
      affected: result.affected,
      proposals: result.proposals.map((x) => x.editId),
      durationMs: result.durationMs,
    },
  );
  // Proposals and the change set are saved above, so a failed re-check
  // cannot lose them. Re-verify the affected claims in the background.
  reverifyInBackground(
    result.affected.map((a) => a.claimId),
    opts.actor,
    opts.ownerEmail,
  );
  return result;
}

/**
 * Re-verify claims after the response, at most three at a time, from the
 * stored source text (nothing is re-fetched). Each claim stores its own
 * verdict, so one failure does not stop the others.
 */
export function reverifyInBackground(
  claimIds: string[],
  actor: Actor,
  ownerEmail: string,
) {
  if (claimIds.length === 0 || !ownerEmail) return;
  return afterResponse("re-verify", async () => {
    const rows = await getDb()
      .select()
      .from(schema.claims)
      .where(inArray(schema.claims.id, claimIds));
    const settled = await mapLimit(rows, 3, (claim) =>
      verifyAndStore(claim, actor, ownerEmail),
    );
    for (const r of settled)
      if (r.status === "rejected")
        console.error("[goowa] re-verify failed:", r.reason);
  });
}
