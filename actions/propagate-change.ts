import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { loadClaim } from "../server/lib/documents.js";
import { propagateChange } from "../server/lib/propagate.js";

export default defineAction({
  description:
    "Re-run dependency propagation for a claim: mark every downstream claim needs_review, re-verify them, and propose code-computed rewrites of derived figures as one change set. Runs automatically when a claim changes; use this to re-run it. previousText enables figure recomputation.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    claimId: z.string().describe("The claim that changed"),
    previousText: z
      .string()
      .optional()
      .describe(
        "The claim's text before the change, to recompute derived figures",
      ),
  }),
  run: async ({ claimId, previousText }, ctx) => {
    const { doc } = await loadClaim(claimId, "editor");
    requireEditable(doc);
    const result = await propagateChange({
      claimId,
      actor: actorOf(ctx),
      ownerEmail: ctx?.userEmail ?? "",
      previousText: previousText ?? null,
    });
    return (
      result ?? { changeSetId: null, summary: "No claims depend on this one." }
    );
  },
});
