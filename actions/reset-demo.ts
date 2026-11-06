import { defineAction } from "@agent-native/core/action";
import { putSetting } from "@agent-native/core/settings";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  DEMO_BODY,
  DEMO_CLAIMS,
  DEMO_TITLE,
  DEMO_TOPIC,
  demoSources,
  type DemoSourceKey,
} from "../fixtures/demo-flow.js";
import { LIVE_SETTING } from "../fixtures/live-source.js";
import { getDb, schema } from "../server/db/index.js";
import { goowaErrors, requireHuman } from "../server/lib/actor.js";
import createDocument from "./create-document.js";
import draftDocument from "./draft-document.js";
import extractClaims from "./extract-claims.js";
import ingestSources from "./ingest-sources.js";

/** Deploy-level public origin, else the dev server. */
function defaultOrigin() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (
    process.env.APP_URL ??
    (vercel ? `https://${vercel}` : "http://localhost:8080")
  );
}

// HUMAN ONLY, demo tooling: delete the caller's previous demo documents and
// seed a fresh one. Verification is left to the demo ("Verify all").
export default defineAction({
  description:
    "Demo tooling, human only: delete your previous demo documents and seed a fresh copy of the demo document (draft, sources, claims; not yet verified). Also resets the live-source test page to version a.",
  errors: goowaErrors,
  agentTool: false,
  mcpTool: false,
  schema: z.object({
    origin: z
      .string()
      .optional()
      .describe(
        "Base URL hosting /fixtures/live-source; defaults to this deploy",
      ),
  }),
  run: async ({ origin }, ctx) => {
    requireHuman(ctx, "reset the demo");
    const owner = ctx?.userEmail ?? "";
    const started = Date.now();
    const db = getDb();

    // 1. Remove this user's earlier demo documents and everything under them.
    const old = await db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.title, DEMO_TITLE),
          eq(schema.documents.ownerEmail, owner),
        ),
      );
    const ids = old.map((d) => d.id);
    if (ids.length > 0) {
      for (const table of [
        schema.liveChecks,
        schema.sourceSnapshots,
        schema.receipts,
        schema.documentRevisions,
        schema.publishOverrides,
        schema.activity,
        schema.changeSets,
        schema.edits,
        schema.claims,
        schema.sources,
      ]) {
        await db.delete(table).where(inArray(table.documentId, ids));
      }
      await db
        .delete(schema.documentShares)
        .where(inArray(schema.documentShares.resourceId, ids));
      await db
        .delete(schema.documents)
        .where(inArray(schema.documents.id, ids));
    }
    await putSetting(LIVE_SETTING, { version: "a" });

    // 2. Seed a fresh copy through the same actions the app uses.
    const doc = await createDocument.run(
      { title: DEMO_TITLE, topic: DEMO_TOPIC },
      ctx,
    );
    const urls = demoSources(origin ?? defaultOrigin());
    const keys = Object.keys(urls) as DemoSourceKey[];
    const ingested = await ingestSources.run(
      { documentId: doc.id, urls: keys.map((k) => urls[k]) },
      ctx,
    );
    const sourceId = Object.fromEntries(
      keys.map((k, i) => [k, ingested.sources[i]!.id]),
    ) as Record<DemoSourceKey, string>;
    await draftDocument.run({ documentId: doc.id, body: DEMO_BODY }, ctx);
    await extractClaims.run(
      {
        documentId: doc.id,
        claims: DEMO_CLAIMS.map((c) => ({
          quote: c.quote,
          sourceIds: c.sources.map((k) => sourceId[k]),
          dependsOn: c.dependsOn,
        })),
      },
      ctx,
    );
    return {
      documentId: doc.id,
      removed: ids.length,
      failedSources: ingested.sources
        .filter((s) => s.flags.includes("fetch_failed"))
        .map((s) => s.url),
      ms: Date.now() - started,
    };
  },
});
