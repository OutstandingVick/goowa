import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { goowaErrors } from "../server/lib/actor.js";
import { fetchSource, type FetchedPage } from "../server/lib/fetch-source.js";
import { scanForStorage } from "../server/lib/quarantine.js";
import { loadReceipt } from "../server/lib/receipt.js";
import { decisionJudge } from "../server/lib/verify.js";
import type { Receipt } from "../shared/receipt.js";
import { verifyClaimText, type Judge } from "../shared/verify/judge.js";

type LiveStatus =
  | "unchanged"
  | "changed_still_supported"
  | "changed_no_longer_supported"
  | "source_unreachable";

// Public and read-only with respect to the receipt and the published
// document. Signed-in checks are recorded in live_checks.
export default defineAction({
  description:
    "Re-check a published receipt against the live sources: re-fetch each cited source, compare its content hash with the one in the receipt, and re-verify claims whose source changed. Reports per claim unchanged, changed_still_supported, changed_no_longer_supported, or source_unreachable. Never modifies the receipt.",
  errors: goowaErrors,
  mcpTool: true,
  // Public: signed-out visitors of /r/:id can call it (framework rule:
  // anonymous calls need requiresAuth false, readOnly, and publicAgent).
  requiresAuth: false,
  publicAgent: {
    expose: true,
    readOnly: true,
    requiresAuth: false,
    title: "Re-check a receipt against live sources",
  },
  readOnly: true,
  schema: z.object({
    documentId: z.string().describe("Document id"),
    claimId: z.string().optional().describe("Only re-check this claim"),
  }),
  run: async ({ documentId, claimId }, ctx) => {
    const row = await loadReceipt(documentId);
    if (!row)
      return goowaErrors.noWrite(
        "This document has no published receipt.",
        "not_found",
      );
    const receipt = JSON.parse(row.json) as Receipt;
    const claims = receipt.claims.filter((c) => !claimId || c.id === claimId);

    // Fetch each live source once.
    const live = new Map<
      string,
      {
        ok: boolean;
        hash: string;
        text: string;
        flags: string[];
        error?: string;
      }
    >();
    for (const s of receipt.sources.filter((s) => !s.excluded)) {
      const page: FetchedPage = { html: "", fullText: "" };
      const fetched = await fetchSource(s.url, page);
      if (!fetched.ok) {
        live.set(s.id, {
          ok: false,
          hash: "",
          text: "",
          flags: [],
          error: fetched.error.message,
        });
        continue;
      }
      const scan = scanForStorage(page.html, page.fullText, []);
      live.set(s.id, {
        ok: true,
        hash: fetched.contentHash,
        text: scan.fullText,
        flags: scan.flags,
      });
    }

    // Model-judged paraphrases need a signed-in owner; anonymous checks use
    // the deterministic rules only.
    const judge: Judge = ctx?.userEmail
      ? decisionJudge(ctx.userEmail)
      : async () => null;
    const results: {
      claimId: string;
      index: number;
      status: LiveStatus;
      detail: string;
      verdict?: string;
    }[] = [];
    for (const c of claims) {
      const cited = [...new Set(c.evidence.map((e) => e.sourceId))];
      const sources = receipt.sources.filter((s) => cited.includes(s.id));
      const unreachable = sources.filter((s) => !live.get(s.id)?.ok);
      if (sources.length > 0 && unreachable.length === sources.length) {
        results.push({
          claimId: c.id,
          index: c.index,
          status: "source_unreachable",
          detail:
            live.get(sources[0]!.id)?.error ?? "Could not fetch the source.",
        });
        continue;
      }
      const changed = sources.filter(
        (s) => live.get(s.id)?.ok && live.get(s.id)!.hash !== s.contentHash,
      );
      if (changed.length === 0) {
        results.push({
          claimId: c.id,
          index: c.index,
          status: "unchanged",
          detail: sources.length
            ? "Every cited source is byte-for-byte what was verified at publish."
            : "This claim had no evidence at publish.",
        });
        continue;
      }
      const r = await verifyClaimText(
        c.text,
        sources
          .filter((s) => live.get(s.id)?.ok)
          .map((s) => ({
            id: s.id,
            title: s.title,
            text: live.get(s.id)!.text,
            flags: live.get(s.id)!.flags,
          })),
        judge,
      );
      // Weak means the live source no longer fully states the claim.
      const still = r.verdict === "supported";
      results.push({
        claimId: c.id,
        index: c.index,
        status: still
          ? "changed_still_supported"
          : "changed_no_longer_supported",
        verdict: r.verdict,
        detail: `${changed.map((s) => s.title || s.url).join(", ")} changed since publish. ${r.reason}`,
      });
    }

    const checkedAt = new Date().toISOString();
    // Signed-in checks are recorded; anonymous ones are computed, not stored.
    if (ctx?.userEmail)
      await getDb().insert(schema.liveChecks).values({
        id: crypto.randomUUID(),
        documentId,
        revision: receipt.document.revision,
        results,
        createdAt: checkedAt,
      });
    return {
      documentId,
      revision: receipt.document.revision,
      checkedAt,
      receiptHash: receipt.receiptHash,
      results,
      sources: receipt.sources
        .filter((s) => !s.excluded)
        .map((s) => ({
          id: s.id,
          url: s.url,
          changed: Boolean(
            live.get(s.id)?.ok && live.get(s.id)!.hash !== s.contentHash,
          ),
          reachable: Boolean(live.get(s.id)?.ok),
          liveHash: live.get(s.id)?.hash || null,
        })),
    };
  },
});
