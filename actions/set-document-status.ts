import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { logActivity } from "../server/lib/activity.js";
import { goowaErrors, requireHuman } from "../server/lib/actor.js";
import { loadDocument, now } from "../server/lib/documents.js";
import { documentStatus } from "../shared/machines.js";

// HUMAN ONLY: publishing is a human decision.
export default defineAction({
  description:
    'Submit a draft for review, or reopen a published document as a new draft revision ("submit", "reopen"). Publishing goes through publish, which enforces the gate. Human only.',
  errors: goowaErrors,
  agentTool: false,
  mcpTool: false,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    event: z.enum(["submit", "reopen"]).describe('"submit" or "reopen"'),
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
      .set({
        status: documentStatus.transition(from, event),
        updatedAt: now(),
        // Reopening a published document starts the next revision.
        ...(event === "reopen" && from === "published"
          ? { revision: doc.revision + 1, publishedAt: null }
          : {}),
      })
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
    if (event === "reopen") {
      await logActivity(
        documentId,
        "reopened",
        "human",
        `You reopened the document as revision ${updated.revision}`,
        { revision: updated.revision },
      );
    }
    return {
      id: updated.id,
      status: updated.status,
      revision: updated.revision,
    };
  },
});
