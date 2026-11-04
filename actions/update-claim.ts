import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { logActivity } from "../server/lib/activity.js";
import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { applyBodyEdit } from "../server/lib/apply-body-edit.js";
import { forbiddenClaimFields } from "../server/lib/claim-policy.js";
import { loadClaim, loadClaims, now } from "../server/lib/documents.js";
import { propagateChange } from "../server/lib/propagate.js";
import { verifyAndStore } from "../server/lib/verify.js";
import { cycleIfDepends } from "../shared/graph.js";
import { CLAIM_STATUSES } from "../shared/machines.js";

export default defineAction({
  description:
    "Update a claim. Agents may change sourceIds directly; an agent's `text` change becomes a proposed edit for a human to accept. Only humans may set status (including supported), confidence, dependsOn, or a note. Verification verdicts are separate and come from verify-claim.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    claimId: z.string().describe("Claim id"),
    text: z.string().min(1).optional().describe("New claim text"),
    reason: z
      .string()
      .optional()
      .describe("Why the text changes; used for the proposed edit"),
    sourceIds: z.array(z.string()).optional().describe("Backing source ids"),
    status: z.enum(CLAIM_STATUSES).optional().describe("Human only"),
    confidence: z.number().min(0).max(1).optional().describe("Human only"),
    dependsOn: z.array(z.string()).optional().describe("Human only"),
    note: z
      .string()
      .max(500)
      .optional()
      .describe("Human only: why the human set this status"),
  }),
  run: async ({ claimId, reason, ...patch }, ctx) => {
    const actor = actorOf(ctx);
    const blocked = forbiddenClaimFields(actor, patch);
    if (blocked.length > 0) {
      return goowaErrors.noWrite(
        `Agents cannot set ${blocked.join(", ")} on a claim.`,
        "forbidden",
        { statusCode: 403 },
      );
    }
    const { doc, claim } = await loadClaim(claimId, "editor");
    requireEditable(doc);
    const db = getDb();

    if (patch.dependsOn) {
      const all = await loadClaims(doc.id);
      const ids = new Set(all.map((c) => c.id));
      const bad = patch.dependsOn.filter(
        (id) => id === claimId || !ids.has(id),
      );
      if (bad.length > 0) {
        return goowaErrors.noWrite(
          `dependsOn has invalid claim ids: ${bad.join(", ")}`,
          "invalid_span",
        );
      }
      const cycle = cycleIfDepends(all, claimId, patch.dependsOn);
      if (cycle) {
        const label = (id: string) =>
          `#${all.findIndex((c) => c.id === id) + 1}`;
        return goowaErrors.noWrite(
          `That dependency would create a cycle: ${cycle.map(label).join(" → ")}.`,
          "cycle",
        );
      }
    }

    const fields: Partial<typeof schema.claims.$inferInsert> = {};
    if (patch.sourceIds) fields.sourceIds = patch.sourceIds;
    if (patch.status) fields.status = patch.status;
    if (patch.confidence !== undefined) fields.confidence = patch.confidence;
    if (patch.dependsOn) fields.dependsOn = patch.dependsOn;
    if (patch.note !== undefined) fields.humanNote = patch.note || null;
    if (Object.keys(fields).length > 0) {
      await db
        .update(schema.claims)
        .set({ ...fields, updatedBy: actor, updatedAt: now() })
        .where(eq(schema.claims.id, claimId));
    }

    let proposedEditId: string | undefined;
    if (patch.text !== undefined && patch.text !== claim.text) {
      if (actor === "human") {
        await applyBodyEdit(
          doc,
          { start: claim.spanStart, end: claim.spanEnd, text: patch.text },
          actor,
        );
      } else {
        proposedEditId = crypto.randomUUID();
        await db.insert(schema.edits).values({
          id: proposedEditId,
          documentId: doc.id,
          targetType: "claim",
          targetId: claimId,
          spanStart: claim.spanStart,
          before: claim.text,
          after: patch.text,
          reason: reason ?? "Claim text change",
          proposedBy: actor,
          state: "proposed",
          createdAt: now(),
        });
        await logActivity(
          doc.id,
          "edit_proposed",
          actor,
          "The agent proposed new wording for a claim",
          {
            editId: proposedEditId,
            claimId,
            after: patch.text,
          },
        );
      }
    }

    // A human decision on this claim settles its own review flag.
    const textChanged =
      actor === "human" &&
      patch.text !== undefined &&
      patch.text !== claim.text;
    if (actor === "human" && (patch.status || textChanged)) {
      await db
        .update(schema.claims)
        .set({ reviewState: "ok", reviewReason: null })
        .where(eq(schema.claims.id, claimId));
    }

    // Changes that alter what this claim says ripple to its dependents.
    const sourcesChanged =
      patch.sourceIds !== undefined &&
      patch.sourceIds.join(",") !== claim.sourceIds.join(",");
    const statusChanged =
      patch.status !== undefined && patch.status !== claim.status;
    // The edited claim itself is re-checked too, so its verdict is current.
    if ((textChanged || sourcesChanged) && ctx?.userEmail) {
      const [fresh] = await db
        .select()
        .from(schema.claims)
        .where(eq(schema.claims.id, claimId));
      if (fresh) await verifyAndStore(fresh, actor, ctx.userEmail);
    }

    let propagation = null;
    if (textChanged || sourcesChanged || statusChanged) {
      propagation = await propagateChange({
        claimId,
        actor,
        ownerEmail: ctx?.userEmail ?? "",
        previousText: textChanged ? claim.text : null,
      });
      await logActivity(
        doc.id,
        "claim_updated",
        actor,
        `${actor === "human" ? "You" : "The agent"} updated a claim (${[
          textChanged && "text",
          sourcesChanged && "sources",
          statusChanged && `status → ${patch.status}`,
        ]
          .filter(Boolean)
          .join(", ")})`,
        { claimId, note: patch.note ?? null },
      );
    }

    const [updated] = await db
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, claimId));
    return { claim: updated, proposedEditId, propagation };
  },
});
