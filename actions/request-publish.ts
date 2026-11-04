import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { logActivity } from "../server/lib/activity.js";
import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { loadDocument } from "../server/lib/documents.js";
import { gateFor } from "../server/lib/gate.js";
import { runVerifyDocument } from "../server/lib/verify-document.js";

export default defineAction({
  description:
    "Check whether a document can be published: verifies changed claims, then evaluates the publish gate and returns { canPublish, blockers, warnings }. Any caller may ask, but only a human can publish. When you (the agent) are asked to publish, call this once and summarise the blockers for the human; never retry and never claim the document was published.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({ documentId: z.string().describe("Document id") }),
  run: async ({ documentId }, ctx) => {
    const doc = await loadDocument(documentId, "editor");
    requireEditable(doc);
    const actor = actorOf(ctx);
    const verification = await runVerifyDocument({
      documentId,
      actor,
      owner: ctx?.userEmail ?? "",
      force: false,
    });
    const gate = await gateFor(documentId);
    if (actor === "agent") {
      // Publishing is never the agent's decision, whatever the gate says.
      await logActivity(
        documentId,
        "publish_blocked",
        "agent",
        "Agent requested publish → blocked: human approval required",
        { gate, verified: verification.verified },
      );
    } else {
      await logActivity(
        documentId,
        "publish_requested",
        "human",
        gate.canPublish
          ? "You checked the publish gate: ready to publish"
          : `You checked the publish gate: ${gate.blockers.length} blocker${gate.blockers.length === 1 ? "" : "s"}`,
        { gate },
      );
    }
    return {
      ...gate,
      humanApprovalRequired: true,
      canAgentPublish: false,
      verified: verification.verified,
    };
  },
});
