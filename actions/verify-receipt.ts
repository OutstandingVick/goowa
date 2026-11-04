import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { goowaErrors } from "../server/lib/actor.js";
import { loadReceipt, snapshotsFor } from "../server/lib/receipt.js";
import { checkReceipt, type Receipt } from "../shared/receipt.js";

// Public: anyone holding a receipt can check it.
export default defineAction({
  description:
    "Verify a Claim Receipt: recompute receiptHash and bodyHash, compare with the hash recorded at publish, and check every evidence snippet against the source text frozen at publish. Each check is intact or tampered.",
  errors: goowaErrors,
  mcpTool: true,
  // Public: signed-out visitors of /r/:id can call it (framework rule:
  // anonymous calls need requiresAuth false, readOnly, and publicAgent).
  requiresAuth: false,
  publicAgent: {
    expose: true,
    readOnly: true,
    requiresAuth: false,
    title: "Verify a Claim Receipt",
  },
  readOnly: true,
  schema: z.object({
    receiptJson: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .describe("The receipt, as a JSON string or object"),
  }),
  run: async ({ receiptJson }) => {
    let receipt: Receipt;
    try {
      receipt = (
        typeof receiptJson === "string" ? JSON.parse(receiptJson) : receiptJson
      ) as Receipt;
    } catch {
      return goowaErrors.noWrite(
        "receiptJson is not valid JSON.",
        "invalid_span",
      );
    }
    if (!receipt?.document?.id || !Array.isArray(receipt.claims)) {
      return goowaErrors.noWrite(
        "That is not a Goowa receipt.",
        "invalid_span",
      );
    }
    const stored = await loadReceipt(
      receipt.document.id,
      receipt.document.revision,
    );
    const snapshots = await snapshotsFor(receipt.document.id);
    const result = await checkReceipt(
      receipt,
      stored?.receiptHash ?? null,
      (h) => snapshots.get(h) ?? null,
    );
    return {
      ...result,
      documentId: receipt.document.id,
      revision: receipt.document.revision,
      known: Boolean(stored),
    };
  },
});
