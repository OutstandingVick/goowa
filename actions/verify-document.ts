import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { loadDocument } from "../server/lib/documents.js";
import { runVerifyDocument } from "../server/lib/verify-document.js";

export default defineAction({
  description:
    "Verify every claim in a document (3 at a time) and report progress. Skips claims whose text and sources have not changed since their last verification unless force is true. Stores machine verdicts only; never changes human status.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    force: z
      .boolean()
      .default(false)
      .describe("Re-verify unchanged claims too; defaults to false"),
  }),
  run: async ({ documentId, force }, ctx) => {
    requireEditable(await loadDocument(documentId, "editor"));
    const owner =
      ctx?.userEmail ??
      goowaErrors.noWrite("Sign in to verify claims.", "forbidden", {
        statusCode: 401,
      });
    return runVerifyDocument({ documentId, actor: actorOf(ctx), owner, force });
  },
});
