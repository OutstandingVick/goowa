import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { goowaErrors } from "../server/lib/actor.js";
import { loadDocument, now } from "../server/lib/documents.js";
import { fetchSource } from "../server/lib/fetch-source.js";

export default defineAction({
  description:
    "Fetch each URL server-side and store it as a source on the document. A failed fetch is stored with the fetch_failed flag and its error instead of failing the whole call.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    urls: z
      .array(z.string())
      .min(1)
      .max(10)
      .describe("Absolute http(s) URLs to ingest, 1 to 10"),
  }),
  run: async ({ documentId, urls }) => {
    await loadDocument(documentId, "editor");
    const results = await Promise.all(urls.map((url) => fetchSource(url)));
    const rows = results.map((result, i) =>
      result.ok
        ? {
            id: crypto.randomUUID(),
            documentId,
            url: result.url,
            title: result.title,
            textExcerpt: result.textExcerpt,
            contentHash: result.contentHash,
            fetchedAt: result.fetchedAt,
            flags: [],
            error: null,
          }
        : {
            id: crypto.randomUUID(),
            documentId,
            url: urls[i]!,
            title: "",
            textExcerpt: "",
            contentHash: "",
            fetchedAt: now(),
            flags: ["fetch_failed"],
            error: { code: result.error.code, message: result.error.message },
          },
    );
    await getDb().insert(schema.sources).values(rows);
    return {
      sources: rows.map(({ id, url, title, flags, error }) => ({
        id,
        url,
        title,
        flags,
        error,
      })),
    };
  },
});
