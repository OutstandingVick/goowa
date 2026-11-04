import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { forbiddenClaimFields } from "../server/lib/claim-policy.js";
import { loadDocument, now } from "../server/lib/documents.js";
import { CLAIM_STATUSES } from "../shared/machines.js";
import { locate } from "../shared/spans.js";

export default defineAction({
  description:
    "Add one claim to a document. `quote` must be an exact substring of the body; the server computes its span. Agents may not set status or confidence (new claims start unverified).",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    quote: z.string().min(1).describe("Exact text of the claim from the body"),
    spanStart: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Approximate offset of the quote, used when it occurs more than once",
      ),
    sourceIds: z.array(z.string()).default([]).describe("Backing source ids"),
    dependsOn: z
      .array(z.string())
      .default([])
      .describe("Claim ids this claim relies on"),
    status: z.enum(CLAIM_STATUSES).optional().describe("Human only"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Human only, 0 to 1"),
  }),
  run: async (args, ctx) => {
    const actor = actorOf(ctx);
    const blocked = forbiddenClaimFields(actor, {
      status: args.status,
      confidence: args.confidence,
    });
    if (blocked.length > 0) {
      return goowaErrors.noWrite(
        `Agents cannot set ${blocked.join(", ")} on a claim.`,
        "forbidden",
        { statusCode: 403 },
      );
    }
    const doc = await loadDocument(args.documentId, "editor");
    requireEditable(doc);
    const start = locate(doc.body, args.quote, args.spanStart ?? 0);
    if (start === null) {
      return goowaErrors.noWrite(
        "`quote` is not an exact substring of the body.",
        "invalid_span",
      );
    }
    const claim = {
      id: crypto.randomUUID(),
      documentId: doc.id,
      text: args.quote,
      spanStart: start,
      spanEnd: start + args.quote.length,
      sourceIds: args.sourceIds,
      status: args.status ?? "unverified",
      confidence: args.confidence ?? 0,
      dependsOn: args.dependsOn,
      createdBy: actor,
      updatedBy: actor,
      updatedAt: now(),
    };
    await getDb().insert(schema.claims).values(claim);
    return claim;
  },
});
