import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { goowaErrors } from "../server/lib/actor.js";
import { loadClaims, loadDocument, now } from "../server/lib/documents.js";

// The framework keeps LLM calls out of actions: the agent writes the draft
// from get-document-state's sources and saves it here.
export default defineAction({
  description:
    "Save the first draft body of a document. Write it ONLY from the document's ingested sources (call get-document-state first); do not add facts the sources do not contain. Plain text or markdown. Only works while the document is a draft with no claims; after that, change the body with propose-edit.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    body: z
      .string()
      .min(200)
      .max(20_000)
      .describe("Full draft text, 200 to 20,000 characters"),
  }),
  run: async ({ documentId, body }) => {
    const doc = await loadDocument(documentId, "editor");
    if (doc.status !== "draft") {
      return goowaErrors.fail(
        "Only draft documents can be redrafted.",
        "conflict",
      );
    }
    if ((await loadClaims(documentId)).length > 0) {
      return goowaErrors.fail(
        "This document already has claims. Use propose-edit to change the body.",
        "conflict",
      );
    }
    await getDb()
      .update(schema.documents)
      .set({ body, updatedAt: now() })
      .where(eq(schema.documents.id, documentId));
    return { documentId, length: body.length };
  },
});
