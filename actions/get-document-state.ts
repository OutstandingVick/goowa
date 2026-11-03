import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { goowaErrors } from "../server/lib/actor.js";
import { getDocumentState } from "../server/lib/documents.js";

export default defineAction({
  description:
    "Read a Goowa document with its body, sources (title, excerpt, flags), claims (text, span, status, sourceIds, dependsOn, createdBy/updatedBy), and pending edits. Call this before drafting, extracting claims, or proposing edits.",
  errors: goowaErrors,
  mcpTool: true,
  readOnly: true,
  http: { method: "GET" },
  schema: z.object({
    documentId: z.string().describe("Document id"),
  }),
  run: async ({ documentId }) => getDocumentState(documentId),
});
