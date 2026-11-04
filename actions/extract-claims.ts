import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { loadClaims, loadDocument, now } from "../server/lib/documents.js";
import { cycleIfDepends } from "../shared/graph.js";
import { locate } from "../shared/spans.js";

const extractedClaim = z.object({
  quote: z
    .string()
    .min(10)
    .describe(
      "The claim copied EXACTLY, character for character, from the document body",
    ),
  sourceIds: z
    .array(z.string())
    .min(1)
    .describe("Ids of the document's sources that back this claim"),
  dependsOn: z
    .array(z.number().int().min(0))
    .default([])
    .describe(
      "Zero-based indexes of other claims in this same list that this claim relies on",
    ),
});

export default defineAction({
  description:
    "Store the factual claims found in a document's body. Each claim is an exact quote from the body plus the source ids that back it and the indexes of claims it depends on. The server finds each quote's character span; nothing is saved if any claim is invalid, and the error lists every problem so you can fix them and retry once. Only works while the document has no claims.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    claims: z
      .array(extractedClaim)
      .min(1)
      .max(60)
      .describe("Claims in the order they appear in the body"),
  }),
  run: async ({ documentId, claims }, ctx) => {
    const doc = await loadDocument(documentId, "editor");
    requireEditable(doc);
    if (!doc.body) {
      return goowaErrors.noWrite(
        "The document has no body yet. Save a draft first.",
        "conflict",
      );
    }
    if ((await loadClaims(documentId)).length > 0) {
      return goowaErrors.noWrite(
        "Claims were already extracted. Use add-claim for more.",
        "conflict",
      );
    }
    const sources = await getDb()
      .select({ id: schema.sources.id, flags: schema.sources.flags })
      .from(schema.sources)
      .where(eq(schema.sources.documentId, documentId));
    const usable = new Set(
      sources.filter((s) => !s.flags.includes("fetch_failed")).map((s) => s.id),
    );

    const problems: string[] = [];
    let cursor = 0;
    const spans = claims.map((claim, i) => {
      // Prefer the next occurrence after the previous claim so repeated
      // phrases map in reading order.
      const start = locate(doc.body, claim.quote, cursor);
      if (start === null) {
        problems.push(
          `claims[${i}].quote is not an exact substring of the body.`,
        );
        return { start: 0, end: 0 };
      }
      cursor = start + claim.quote.length;
      for (const id of claim.sourceIds) {
        if (!usable.has(id)) {
          problems.push(
            `claims[${i}].sourceIds has unknown or failed source ${id}.`,
          );
        }
      }
      for (const dep of claim.dependsOn) {
        if (dep === i || dep >= claims.length) {
          problems.push(`claims[${i}].dependsOn has invalid index ${dep}.`);
        }
      }
      return { start, end: start + claim.quote.length };
    });
    const batch = claims.map((c, i) => ({
      id: String(i),
      dependsOn: c.dependsOn.map(String),
    }));
    for (const node of batch) {
      const cycle = cycleIfDepends(batch, node.id, node.dependsOn);
      if (cycle) {
        problems.push(`dependsOn forms a cycle: ${cycle.join(" → ")}.`);
        break;
      }
    }
    if (problems.length > 0) {
      return goowaErrors.noWrite(
        `No claims saved. Fix these and retry: ${problems.join(" ")} Valid source ids: ${[...usable].join(", ") || "none"}.`,
        "invalid_span",
      );
    }

    const actor = actorOf(ctx);
    const ids = claims.map(() => crypto.randomUUID());
    const rows = claims.map((claim, i) => ({
      id: ids[i]!,
      documentId,
      text: claim.quote,
      spanStart: spans[i]!.start,
      spanEnd: spans[i]!.end,
      sourceIds: claim.sourceIds,
      status: "unverified",
      confidence: 0,
      dependsOn: claim.dependsOn.map((dep) => ids[dep]!),
      createdBy: actor,
      updatedBy: actor,
      updatedAt: now(),
    }));
    await getDb().insert(schema.claims).values(rows);
    return {
      claims: rows.map(({ id, text, spanStart, spanEnd, dependsOn }) => ({
        id,
        text,
        spanStart,
        spanEnd,
        dependsOn,
      })),
    };
  },
});
