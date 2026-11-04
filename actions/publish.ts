import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { logActivity } from "../server/lib/activity.js";
import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { loadDocument, now } from "../server/lib/documents.js";
import { gateFor } from "../server/lib/gate.js";
import { createReceipt } from "../server/lib/receipt.js";
import { applyOverrides } from "../shared/gate.js";

// HUMAN ONLY. Hidden from the in-app agent. Listed for MCP clients on
// purpose, so an external agent's attempt reaches this check, is refused with
// forbidden, and is recorded in the activity feed.
export default defineAction({
  description:
    "Publish a document after the publish gate passes. Remaining blockers may be overridden one by one with a reason, except pending proposals and quarantined or injection-flagged sources. Human only: agents and integrations calling it get forbidden and the attempt is logged.",
  errors: goowaErrors,
  agentTool: false,
  mcpTool: true,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    overrides: z
      .array(
        z.object({
          claimId: z.string().optional(),
          sourceId: z.string().optional(),
          kind: z.string().optional(),
          reason: z.string().max(500),
        }),
      )
      .default([])
      .describe("Human overrides for specific blockers, each with a reason"),
  }),
  run: async ({ documentId, overrides }, ctx) => {
    const doc = await loadDocument(documentId, "editor");
    if (actorOf(ctx) !== "human") {
      await logActivity(
        documentId,
        "publish_blocked",
        "agent",
        "Agent attempted to publish · blocked",
        { caller: ctx?.caller ?? "unknown" },
      );
      // A plain failure (not noWrite): the attempt was recorded, and the
      // framework stops the agent from retrying it in the same turn.
      return goowaErrors.fail("Only a human can publish.", "forbidden", {
        statusCode: 403,
      });
    }
    requireEditable(doc);

    const gate = await gateFor(documentId);
    const { remaining, accepted, problems } = applyOverrides(
      gate,
      overrides as Parameters<typeof applyOverrides>[1],
    );
    if (problems.length > 0 || remaining.length > 0) {
      return goowaErrors.noWrite(
        [
          ...problems,
          ...remaining
            .filter((b) => !problems.some((p) => p.includes(b.message)))
            .map((b) => `Still blocking: ${b.message}`),
        ].join(" "),
        "conflict",
      );
    }

    const db = getDb();
    const publishedAt = now();
    const [updated] = await db
      .update(schema.documents)
      .set({ status: "published", publishedAt, updatedAt: publishedAt })
      .where(
        and(
          eq(schema.documents.id, documentId),
          inArray(schema.documents.status, ["draft", "in_review"]),
        ),
      )
      .returning();
    if (!updated) {
      return goowaErrors.fail(
        "The document changed while publishing.",
        "conflict",
      );
    }
    for (const o of accepted) {
      await db.insert(schema.publishOverrides).values({
        id: crypto.randomUUID(),
        documentId,
        revision: updated.revision,
        claimId: o.claimId ?? null,
        sourceId: o.sourceId ?? null,
        kind: o.kind,
        reason: o.reason.trim(),
        createdAt: publishedAt,
      });
      await logActivity(
        documentId,
        "override",
        "human",
        `You overrode a blocker: ${o.reason.trim()}`,
        {
          kind: o.kind,
          claimId: o.claimId ?? null,
          sourceId: o.sourceId ?? null,
          reason: o.reason.trim(),
        },
      );
    }
    await db.insert(schema.documentRevisions).values({
      id: crypto.randomUUID(),
      documentId,
      revision: updated.revision,
      body: updated.body,
      publishedAt,
    });
    await logActivity(
      documentId,
      "published",
      "human",
      `You published revision ${updated.revision}${accepted.length ? ` with ${accepted.length} override${accepted.length === 1 ? "" : "s"}` : ""}`,
      {
        revision: updated.revision,
        warnings: gate.warnings,
        overrides: accepted,
      },
    );
    // The receipt is built last so its history includes this publish.
    const receipt = await createReceipt(documentId);
    return {
      id: documentId,
      status: updated.status,
      revision: updated.revision,
      publishedAt,
      overrides: accepted.length,
      warnings: gate.warnings,
      receiptHash: receipt.receiptHash,
      receiptUrl: `/r/${documentId}`,
    };
  },
});
