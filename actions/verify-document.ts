import { defineAction } from "@agent-native/core/action";
import {
  completeRun,
  startRun,
  updateRunProgress,
} from "@agent-native/core/progress";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorOf, goowaErrors, requireEditable } from "../server/lib/actor.js";
import { loadClaims, loadDocument } from "../server/lib/documents.js";
import { claimFingerprint, verifyAndStore } from "../server/lib/verify.js";

const CONCURRENCY = 3;

/** Progress run title the editor looks for to show its percent bar. */
export function verifyRunTitle(documentId: string) {
  return `Verify document ${documentId}`;
}

export default defineAction({
  description:
    "Verify every claim in a document (3 at a time) and report progress. Skips claims whose text and sources have not changed since their last verification unless force is true. Stores machine verdicts only; never changes human status.",
  errors: goowaErrors,
  mcpTool: true,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    force: z
      .boolean()
      .default(false)
      .describe("Re-verify unchanged claims too; defaults to false"),
  }),
  run: async ({ documentId, force }, ctx) => {
    requireEditable(await loadDocument(documentId, "editor"));
    const owner =
      ctx?.userEmail ??
      goowaErrors.noWrite("Sign in to verify claims.", "forbidden", {
        statusCode: 401,
      });
    const actor = actorOf(ctx);
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
    return {
      runId: run.id,
      total: claims.length,
      verified: timed.length,
      skipped,
      failed: results.filter((r) => r.error).length,
      averageMsPerClaim: timed.length
        ? Math.round(
            timed.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) /
              timed.length,
          )
        : 0,
      wallMs: Date.now() - started,
      results,
    };
  },
});
