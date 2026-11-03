import { assertAccess } from "@agent-native/core/sharing";
import { and, asc, eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { goowaErrors } from "./actor.js";

export type DocumentRow = typeof schema.documents.$inferSelect;
export type SourceRow = typeof schema.sources.$inferSelect;
export type ClaimRow = typeof schema.claims.$inferSelect;
export type EditRow = typeof schema.edits.$inferSelect;

type Role = "viewer" | "editor";

/** Access-checked load. Every child-table query goes through a document id
 * that passed this check. */
export async function loadDocument(
  documentId: string,
  role: Role = "viewer",
): Promise<DocumentRow> {
  await assertAccess("document", documentId, role);
  const [doc] = await getDb()
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  if (!doc) return goowaErrors.fail("Document not found.", "not_found");
  return doc;
}

export async function loadClaims(documentId: string): Promise<ClaimRow[]> {
  return getDb()
    .select()
    .from(schema.claims)
    .where(eq(schema.claims.documentId, documentId))
    .orderBy(asc(schema.claims.spanStart));
}

export async function loadClaim(
  claimId: string,
  role: Role,
): Promise<{ doc: DocumentRow; claim: ClaimRow }> {
  const [claim] = await getDb()
    .select()
    .from(schema.claims)
    .where(eq(schema.claims.id, claimId))
    .limit(1);
  if (!claim) return goowaErrors.fail("Claim not found.", "not_found");
  const doc = await loadDocument(claim.documentId, role);
  return { doc, claim };
}

export async function loadEdit(
  editId: string,
  role: Role,
): Promise<{ doc: DocumentRow; edit: EditRow }> {
  const [edit] = await getDb()
    .select()
    .from(schema.edits)
    .where(eq(schema.edits.id, editId))
    .limit(1);
  if (!edit) return goowaErrors.fail("Edit not found.", "not_found");
  const doc = await loadDocument(edit.documentId, role);
  return { doc, edit };
}

export async function getDocumentState(documentId: string) {
  const document = await loadDocument(documentId, "viewer");
  const db = getDb();
  const [sources, claims, pendingEdits] = await Promise.all([
    db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.documentId, documentId))
      .orderBy(asc(schema.sources.fetchedAt)),
    loadClaims(documentId),
    db
      .select()
      .from(schema.edits)
      .where(
        and(
          eq(schema.edits.documentId, documentId),
          eq(schema.edits.state, "proposed"),
        ),
      )
      .orderBy(asc(schema.edits.createdAt)),
  ]);
  return { document, sources, claims, pendingEdits };
}

export function now(): string {
  return new Date().toISOString();
}
