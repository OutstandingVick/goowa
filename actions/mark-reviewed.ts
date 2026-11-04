import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { logActivity } from "../server/lib/activity.js";
import {
  goowaErrors,
  requireEditable,
  requireHuman,
} from "../server/lib/actor.js";
import { loadClaim } from "../server/lib/documents.js";

// HUMAN ONLY: clearing a review flag is a human judgement.
export default defineAction({
  description:
    "Mark a claim that needs review as reviewed (no change needed). Human only.",
  errors: goowaErrors,
  agentTool: false,
  mcpTool: false,
  schema: z.object({ claimId: z.string().describe("Claim id") }),
  run: async ({ claimId }, ctx) => {
    requireHuman(ctx, "mark a claim reviewed");
    const { doc, claim } = await loadClaim(claimId, "editor");
    requireEditable(doc);
    await getDb()
      .update(schema.claims)
      .set({ reviewState: "ok", reviewReason: null })
      .where(eq(schema.claims.id, claimId));
    await logActivity(
      doc.id,
      "review_cleared",
      "human",
      "You marked a claim reviewed",
      {
        claimId,
        reason: claim.reviewReason,
      },
    );
    return { claimId, reviewState: "ok" };
  },
});
