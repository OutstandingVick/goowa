import { eq } from "drizzle-orm";

import { remapSpans, type TextEdit } from "../../shared/spans.js";
import { getDb, schema } from "../db/index.js";
import type { Actor } from "./actor.js";
import { loadClaims, now, type DocumentRow } from "./documents.js";

/**
 * Apply one text replacement to a document body and re-map every claim span.
 * Claims whose text the edit destroyed are reset to "unverified" so a human
 * looks at them again. Only called from human-gated paths.
 */
export async function applyBodyEdit(
  doc: DocumentRow,
  edit: TextEdit,
  actor: Actor,
) {
  const claims = await loadClaims(doc.id);
  const { body, spans } = remapSpans(
    doc.body,
    claims.map((c) => ({
      id: c.id,
      start: c.spanStart,
      end: c.spanEnd,
      text: c.text,
    })),
    edit,
  );
  const db = getDb();
  const at = now();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.documents)
      .set({ body, updatedAt: at })
      .where(eq(schema.documents.id, doc.id));
    for (const span of spans) {
      if (span.outcome === "unchanged") continue;
      await tx
        .update(schema.claims)
        .set({
          spanStart: span.start,
          spanEnd: span.end,
          text: span.text,
          ...(span.outcome === "resized" || span.outcome === "lost"
            ? { status: "unverified", updatedBy: actor, updatedAt: at }
            : {}),
        })
        .where(eq(schema.claims.id, span.id));
    }
  });
  return { body, spans };
}
