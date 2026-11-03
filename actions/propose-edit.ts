import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorOf, goowaErrors } from "../server/lib/actor.js";
import { loadClaim, loadDocument, now } from "../server/lib/documents.js";
import { locate } from "../shared/spans.js";

export default defineAction({
  description:
    'Propose a change for a human to accept or reject; nothing changes until they do. targetType "claim": targetId is a claim id and `after` replaces that claim\'s text in the body. targetType "document_body": targetId is the document id, `before` is the exact body text to replace, and `after` is its replacement (empty string deletes).',
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    targetType: z
      .enum(["document_body", "claim"])
      .describe('"document_body" or "claim"'),
    targetId: z
      .string()
      .describe("Document id for document_body, claim id for claim"),
    before: z
      .string()
      .optional()
      .describe(
        "document_body only: exact text from the body to replace (required there)",
      ),
    spanStart: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "document_body only: approximate offset of `before`, used when it occurs more than once",
      ),
    after: z.string().describe("Replacement text"),
    reason: z.string().min(1).describe("Why this change is needed"),
  }),
  run: async (args, ctx) => {
    let documentId: string;
    let before: string;
    let spanStart: number;

    if (args.targetType === "claim") {
      const { claim } = await loadClaim(args.targetId, "viewer");
      documentId = claim.documentId;
      before = claim.text;
      spanStart = claim.spanStart;
    } else {
      const doc = await loadDocument(args.targetId, "viewer");
      if (!args.before) {
        return goowaErrors.noWrite(
          "document_body edits need `before`: the exact text to replace.",
          "invalid_span",
        );
      }
      const found = locate(doc.body, args.before, args.spanStart ?? 0);
      if (found === null) {
        return goowaErrors.noWrite(
          "`before` is not an exact substring of the current body.",
          "invalid_span",
        );
      }
      documentId = doc.id;
      before = args.before;
      spanStart = found;
    }
    if (before === args.after) {
      return goowaErrors.noWrite(
        "`after` is identical to `before`.",
        "conflict",
      );
    }

    const edit = {
      id: crypto.randomUUID(),
      documentId,
      targetType: args.targetType,
      targetId: args.targetId,
      spanStart,
      before,
      after: args.after,
      reason: args.reason,
      proposedBy: actorOf(ctx),
      state: "proposed",
      createdAt: now(),
    };
    await getDb().insert(schema.edits).values(edit);
    return edit;
  },
});
