import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { goowaErrors, requireHuman } from "../server/lib/actor.js";
import { loadDocument, now } from "../server/lib/documents.js";
import { documentStatus } from "../shared/machines.js";

// HUMAN ONLY: publishing is a human decision.
export default defineAction({
  description:
    'Move a document through draft → in_review → published ("submit", "publish", "reopen"). Human only.',
  errors: goowaErrors,
  agentTool: false,
  mcpTool: false,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    event: z
      .enum(["submit", "publish", "reopen"])
      .describe('"submit", "publish", or "reopen"'),
  }),
  run: async ({ documentId, event }, ctx) => {
    requireHuman(ctx, "change a document's status");
    const doc = await loadDocument(documentId, "editor");
    const from = documentStatus.parseState(doc.status);
    if (!documentStatus.can(from, event)) {
      return goowaErrors.noWrite(
        `Cannot ${event} a ${from} document.`,
        "conflict",
      );
    }
    const [updated] = await getDb()
      .update(schema.documents)
      .set({ status: documentStatus.transition(from, event), updatedAt: now() })
      .where(
        and(
          eq(schema.documents.id, documentId),
          inArray(schema.documents.status, [
            ...documentStatus.fromStates(event),
          ]),
        ),
      )
      .returning();
    if (!updated) {
      return goowaErrors.noWrite(
        "The status changed while you were deciding.",
        "conflict",
      );
    }
    return { id: updated.id, status: updated.status };
  },
});
