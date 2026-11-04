import { and, eq, inArray } from "drizzle-orm";

import { changedFigure, deriveRewrite } from "../../shared/derive.js";
import { downstream } from "../../shared/graph.js";
import { getDb, schema } from "../db/index.js";
import { logActivity } from "./activity.js";
import type { Actor } from "./actor.js";
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
    verdict: string;
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

    // Forced re-check: the fingerprint was just cleared.
    const verdict = await verifyAndStore(claim, opts.actor, opts.ownerEmail);
    result.affected.push({
      claimId: claim.id,
      label: label(claim.id),
      depth: a.depth,
      verdict: verdict.verdict,
    });

    // Only direct dependents can be recomputed from the changed figure.
    const rewrite =
      figure && a.via === trigger.id ? deriveRewrite(claim.text, figure) : null;
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
  result.summary = `${opts.actor === "human" ? "You" : "The agent"} changed claim ${label(trigger.id)} → ${n} claim${n === 1 ? "" : "s"} affected → ${p} rewrite${p === 1 ? "" : "s"} proposed`;
  await db.insert(schema.changeSets).values({
    id: changeSetId,
    documentId: trigger.documentId,
    triggerClaimId: trigger.id,
    triggeredBy: opts.actor,
    triggerBeforeText: opts.previousText ?? null,
    summary: result.summary,
    createdAt: now(),
  });
  result.durationMs = Date.now() - started;
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
  return result;
}
