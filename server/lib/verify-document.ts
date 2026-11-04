import {
  completeRun,
  startRun,
  updateRunProgress,
} from "@agent-native/core/progress";
import { eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { logActivity } from "./activity.js";
import type { Actor } from "./actor.js";
import { loadClaims } from "./documents.js";
import { claimFingerprint, verifyAndStore } from "./verify.js";

const CONCURRENCY = 3;

/** Progress run title the editor looks for to show its percent bar. */
export function verifyRunTitle(documentId: string) {
  return `Verify document ${documentId}`;
}

/** Verify a document's claims, skipping unchanged ones unless forced. */
export async function runVerifyDocument(opts: {
  documentId: string;
  actor: Actor;
  owner: string;
  force: boolean;
}) {
  const { documentId, actor, owner, force } = opts;
  const claims = await loadClaims(documentId);
  const sources = await getDb()
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.documentId, documentId));

  const todo = claims.filter(
    (c) =>
      force ||
      !c.verdict ||
      c.verifiedFingerprint !== claimFingerprint(c, sources),
  );
  const skipped = claims.length - todo.length;
  const started = Date.now();
  const run = await startRun({
    owner,
    title: verifyRunTitle(documentId),
    step: `Verifying ${todo.length} of ${claims.length} claims`,
  });

  const results: {
    claimId: string;
    verdict?: string;
    durationMs?: number;
    error?: string;
  }[] = [];
  let done = 0;
  let next = 0;
  try {
    const worker = async () => {
      while (next < todo.length) {
        const claim = todo[next++]!;
        try {
          const r = await verifyAndStore(claim, actor, owner);
          results.push({
            claimId: claim.id,
            verdict: r.verdict,
            durationMs: r.durationMs,
          });
        } catch (err) {
          results.push({
            claimId: claim.id,
            error: (err as Error).message ?? "Verification failed",
          });
        }
        done++;
        await updateRunProgress(run.id, owner, {
          percent: Math.round((done / Math.max(1, todo.length)) * 100),
          step: `Verified ${done} of ${todo.length}`,
        });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker),
    );
    await completeRun(run.id, owner, "succeeded");
  } catch (err) {
    await completeRun(run.id, owner, "failed");
    throw err;
  }

  const timed = results.filter((r) => r.durationMs !== undefined);
  if (timed.length > 0) {
    await logActivity(
      documentId,
      "verified",
      actor,
      `${actor === "human" ? "You" : "The agent"} verified ${timed.length} claim${timed.length === 1 ? "" : "s"}${skipped ? ` (${skipped} unchanged)` : ""}`,
      {
        verified: timed.length,
        skipped,
        failed: results.filter((r) => r.error).length,
      },
    );
  }
  return {
    runId: run.id,
    total: claims.length,
    verified: timed.length,
    skipped,
    failed: results.filter((r) => r.error).length,
    averageMsPerClaim: timed.length
      ? Math.round(
          timed.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) / timed.length,
        )
      : 0,
    wallMs: Date.now() - started,
    results,
  };
}
