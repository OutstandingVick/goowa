import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { goowaErrors } from "../server/lib/actor.js";
import { loadReceipt } from "../server/lib/receipt.js";
import type { Receipt } from "../shared/receipt.js";

// Public: a published receipt is proof meant for anyone holding the link.
export default defineAction({
  description:
    "Get the Claim Receipt for a published document (latest revision unless revision is given): the published body, every claim with its verdict, evidence snippets and offsets, human decisions and overrides, sources with content hashes, a summary, the history, and receiptHash.",
  errors: goowaErrors,
  mcpTool: true,
  // Public: signed-out visitors of /r/:id can call it (framework rule:
  // anonymous calls need requiresAuth false, readOnly, and publicAgent).
  requiresAuth: false,
  publicAgent: {
    expose: true,
    readOnly: true,
    requiresAuth: false,
    title: "Get a Claim Receipt",
  },
  readOnly: true,
  http: { method: "GET" },
  schema: z.object({
    documentId: z.string().describe("Document id"),
    revision: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Published revision; latest if omitted"),
  }),
  run: async ({ documentId, revision }) => {
    const row = await loadReceipt(documentId, revision);
    if (!row) {
      return goowaErrors.noWrite(
        "This document has no published receipt.",
        "not_found",
      );
    }
    // Returned exactly as stored, so its hash never changes between calls.
    return JSON.parse(row.json) as Receipt;
  },
});
