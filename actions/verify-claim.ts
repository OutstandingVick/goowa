import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { loadClaim } from "../server/lib/documents.js";
import { verifyAndStore } from "../server/lib/verify.js";

export default defineAction({
  description:
    "Verify one claim against its cited sources and store the machine verdict (supported, weak, unsupported, laundered, or unverifiable) with evidence snippets quoted from the stored source text. This never changes the claim's human status.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    claimId: z.string().describe("Claim id"),
  }),
  run: async ({ claimId }, ctx) => {
    const { doc, claim } = await loadClaim(claimId, "editor");
    requireEditable(doc);
    const ownerEmail =
      ctx?.userEmail ??
      goowaErrors.noWrite("Sign in to verify claims.", "forbidden", {
        statusCode: 401,
      });
    const result = await verifyAndStore(claim, actorOf(ctx), ownerEmail);
    return {
      claimId,
      verdict: result.verdict,
      reason: result.reason,
      confidence: result.confidence,
      evidence: result.evidence,
      durationMs: result.durationMs,
    };
  },
});
