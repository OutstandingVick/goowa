import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { logActivity } from "../server/lib/activity.js";
import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { applyBodyEdit } from "../server/lib/apply-body-edit.js";
import {
  loadClaim,
  loadClaims,
  loadEdit,
  now,
} from "../server/lib/documents.js";
import { propagateChange } from "../server/lib/propagate.js";
import { editState } from "../shared/machines.js";
import { locate, type TextEdit } from "../shared/spans.js";

// HUMAN ONLY. Hidden from the in-app agent; listed for MCP clients so an
// external agent's attempt is refused here and recorded in the activity feed.
export default defineAction({
  description:
    "Accept or reject a proposed edit. Human only: agents and integrations calling it get forbidden and the attempt is logged.",
  errors: goowaErrors,
  agentTool: false,
  mcpTool: true,
  schema: z.object({
    editId: z.string().describe("Edit id"),
    decision: z.enum(["accept", "reject"]).describe('"accept" or "reject"'),
  }),
  run: async ({ editId, decision }, ctx) => {
    if (actorOf(ctx) !== "human") {
      const [attempted] = await getDb()
        .select({ documentId: schema.edits.documentId })
        .from(schema.edits)
        .where(eq(schema.edits.id, editId))
        .limit(1);
      if (attempted) {
        await logActivity(
          attempted.documentId,
          "publish_blocked",
          "agent",
          `Agent attempted to ${decision} an edit · blocked`,
          { editId, decision, caller: ctx?.caller ?? "unknown" },
        );
      }
      // Recorded, so a plain failure: the agent must not retry it.
      return goowaErrors.fail(
        "Only a human can accept or reject edits.",
        "forbidden",
        { statusCode: 403 },
      );
    }
    const { doc, edit } = await loadEdit(editId, "editor");
    requireEditable(doc);
    if (!editState.can(editState.parseState(edit.state), decision)) {
      return goowaErrors.noWrite(
        `This edit is already ${edit.state}.`,
        "conflict",
      );
    }

    let applied: Awaited<ReturnType<typeof applyBodyEdit>> | null = null;
    const changedClaims: { id: string; previousText: string | null }[] = [];
    if (decision === "accept") {
      let range: TextEdit;
      if (edit.targetType === "claim") {
        const { claim } = await loadClaim(edit.targetId, "editor");
        if (claim.text !== edit.before) {
          return goowaErrors.noWrite(
            "The claim changed after this edit was proposed. Reject it and propose again.",
            "conflict",
          );
        }
        range = {
          start: claim.spanStart,
          end: claim.spanEnd,
          text: edit.after,
        };
      } else {
        const start = locate(doc.body, edit.before, edit.spanStart ?? 0);
        if (start === null) {
          return goowaErrors.noWrite(
            "The text this edit replaces is no longer in the body. Reject it and propose again.",
            "conflict",
          );
        }
        range = { start, end: start + edit.before.length, text: edit.after };
      }
      const before = new Map(
        (await loadClaims(doc.id)).map((c) => [c.id, c.text]),
      );
      applied = await applyBodyEdit(doc, range, "human");
      // Claims whose wording changed ripple to their dependents.
      for (const span of applied.spans) {
        if (span.outcome !== "resized" && span.outcome !== "lost") continue;
        changedClaims.push({
          id: span.id,
          previousText: before.get(span.id) ?? null,
        });
      }
    }

    const decided = await getDb()
      .update(schema.edits)
      .set({
        state: editState.transition("proposed", decision),
        decidedBy: "human",
        decidedAt: now(),
      })
      .where(
        and(
          eq(schema.edits.id, editId),
          inArray(schema.edits.state, [...editState.fromStates(decision)]),
        ),
      )
      .returning();
    if (decided.length === 0) {
      return goowaErrors.fail(
        "This edit was decided by someone else.",
        "conflict",
      );
    }
    // The human has now looked at this claim: its review flag is settled.
    if (edit.targetType === "claim") {
      await getDb()
        .update(schema.claims)
        .set({ reviewState: "ok", reviewReason: null })
        .where(eq(schema.claims.id, edit.targetId));
    }
    await logActivity(
      doc.id,
      "edit_decided",
      "human",
      `You ${decision === "accept" ? "accepted" : "rejected"} a proposed edit${edit.proposedBy === "agent" ? " from the agent" : ""}`,
      {
        editId,
        decision,
        changeSetId: edit.changeSetId,
        before: edit.before,
        after: edit.after,
      },
    );
    const propagations = [];
    for (const c of changedClaims) {
      const p = await propagateChange({
        claimId: c.id,
        actor: "human",
        ownerEmail: ctx?.userEmail ?? "",
        previousText: c.previousText,
      });
      if (p) propagations.push(p);
    }
    return {
      propagations,
      edit: decided[0],
      spans: applied?.spans.map(({ id, start, end, outcome }) => ({
        id,
        start,
        end,
        outcome,
      })),
    };
  },
});
