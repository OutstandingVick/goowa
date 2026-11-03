import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { goowaErrors, requireHuman } from "../server/lib/actor.js";
import { applyBodyEdit } from "../server/lib/apply-body-edit.js";
import { loadClaim, loadEdit, now } from "../server/lib/documents.js";
import { editState } from "../shared/machines.js";
import { locate, type TextEdit } from "../shared/spans.js";

// HUMAN ONLY. Hidden from the agent and MCP, and checked again inside run so
// any other surface (HTTP, A2A, automations) is refused too.
export default defineAction({
  description:
    "Accept or reject a proposed edit. Human only: agents and integrations get a forbidden error.",
  errors: goowaErrors,
  agentTool: false,
  mcpTool: false,
  schema: z.object({
    editId: z.string().describe("Edit id"),
    decision: z.enum(["accept", "reject"]).describe('"accept" or "reject"'),
  }),
  run: async ({ editId, decision }, ctx) => {
    requireHuman(ctx, "accept or reject edits");
    const { doc, edit } = await loadEdit(editId, "editor");
    if (!editState.can(editState.parseState(edit.state), decision)) {
      return goowaErrors.noWrite(
        `This edit is already ${edit.state}.`,
        "conflict",
      );
    }

    let applied: Awaited<ReturnType<typeof applyBodyEdit>> | null = null;
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
      applied = await applyBodyEdit(doc, range, "human");
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
    return {
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
