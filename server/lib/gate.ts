import { and, eq } from "drizzle-orm";

import { evaluateGate, type GateResult } from "../../shared/gate.js";
import { getDb, schema } from "../db/index.js";
import { loadClaims } from "./documents.js";

/** Evaluate the publish gate from the stored document state. */
export async function gateFor(documentId: string): Promise<GateResult> {
  const db = getDb();
  const [claims, sources, pendingEdits] = await Promise.all([
    loadClaims(documentId),
    db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.documentId, documentId)),
    db
      .select()
      .from(schema.edits)
      .where(
        and(
          eq(schema.edits.documentId, documentId),
          eq(schema.edits.state, "proposed"),
        ),
      ),
  ]);
  return evaluateGate({ claims, sources, pendingEdits });
}
