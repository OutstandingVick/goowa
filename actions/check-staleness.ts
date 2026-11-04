import { defineAction } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { goowaErrors } from "../server/lib/actor.js";
import { loadDocument, now } from "../server/lib/documents.js";
import { fetchSource, type FetchedPage } from "../server/lib/fetch-source.js";
import { scanForStorage } from "../server/lib/quarantine.js";

export default defineAction({
  description:
    "Re-fetch a source and compare its content hash. If the page changed, set the stale flag, store the new text (re-scanned for injection), and re-queue claims citing it for verification.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({ sourceId: z.string().describe("Source id") }),
  run: async ({ sourceId }) => {
    const db = getDb();
    const [source] = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.id, sourceId))
      .limit(1);
    if (!source) return goowaErrors.noWrite("Source not found.", "not_found");
    await loadDocument(source.documentId, "editor");

    const page: FetchedPage = { html: "", fullText: "" };
    const fetched = await fetchSource(source.url, page);
    if (!fetched.ok) {
      return {
        sourceId,
        stale: source.flags.includes("stale"),
        changed: false,
        error: fetched.error,
      };
    }
    const changed = fetched.contentHash !== source.contentHash;
    if (!changed) {
      return {
        sourceId,
        stale: source.flags.includes("stale"),
        changed: false,
      };
    }

    const scan = scanForStorage(page.html, page.fullText, [
      ...source.flags.filter((f) => f !== "fetch_failed"),
      "stale",
    ]);
    await db
      .update(schema.sources)
      .set({
        flags: [...new Set(scan.flags)],
        contentHash: fetched.contentHash,
        fetchedAt: now(),
        fullText: scan.fullText,
        textExcerpt: scan.textExcerpt,
        injectionFindings: scan.findings,
      })
      .where(eq(schema.sources.id, sourceId));

    const claims = await db
      .select({ id: schema.claims.id, sourceIds: schema.claims.sourceIds })
      .from(schema.claims)
      .where(eq(schema.claims.documentId, source.documentId));
    const requeued = claims.filter((c) => c.sourceIds.includes(sourceId));
    for (const c of requeued) {
      await db
        .update(schema.claims)
        .set({ verifiedFingerprint: null })
        .where(
          and(
            eq(schema.claims.id, c.id),
            eq(schema.claims.documentId, source.documentId),
          ),
        );
    }
    return {
      sourceId,
      stale: true,
      changed: true,
      previousHash: source.contentHash,
      contentHash: fetched.contentHash,
      requeuedClaimIds: requeued.map((c) => c.id),
    };
  },
});
