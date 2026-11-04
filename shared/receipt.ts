// The Claim Receipt: the immutable proof attached to a published revision,
// and the pure checks that verify it.

import { receiptHashOf, sha256Hex } from "./canonical.js";

export type ReceiptEvidence = {
  sourceId: string;
  sourceUrl: string;
  snippet: string;
  startOffset: number;
  endOffset: number;
  matchType: string;
  sourceContentHash: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
};

export type ReceiptClaim = {
  id: string;
  index: number;
  text: string;
  span: { start: number; end: number };
  status: string; // effective status at publish
  verdict: {
    value: string;
    reason: string | null;
    confidence: number | null;
  } | null;
  human: { status: string; note: string | null } | null;
  evidence: ReceiptEvidence[];
  overrides: { kind: string; reason: string }[];
};

export type ReceiptSource = {
  id: string;
  url: string;
  title: string;
  contentHash: string;
  fetchedAt: string;
  flags: string[];
  excluded: boolean; // quarantined sources are listed but never used as evidence
};

export type Receipt = {
  version: 1;
  document: {
    id: string;
    title: string;
    revision: number;
    publishedAt: string;
    publishedBy: "human";
    body: string;
    bodyHash: string;
  };
  claims: ReceiptClaim[];
  sources: ReceiptSource[];
  summary: {
    claims: number;
    byStatus: Record<string, number>;
    overrides: number;
    agentPublishAttemptsBlocked: number;
  };
  history: { at: string; actor: string; kind: string; summary: string }[];
  receiptHash: string;
};

export type CheckResult = "intact" | "tampered";
export type ReceiptCheck = {
  id: string;
  label: string;
  result: CheckResult;
  detail: string;
  claimId?: string;
};

/**
 * Verify a receipt. `storedHash` is the hash recorded when it was published
 * (null when the revision is unknown); `snapshotText` returns frozen source
 * text by content hash.
 */
export async function checkReceipt(
  receipt: Receipt,
  storedHash: string | null,
  snapshotText: (contentHash: string) => string | null,
): Promise<{ ok: boolean; checks: ReceiptCheck[] }> {
  const checks: ReceiptCheck[] = [];
  const recomputed = await receiptHashOf(
    receipt as unknown as Record<string, unknown>,
  );
  const selfConsistent = recomputed === receipt.receiptHash;
  const matchesStored =
    storedHash === null || storedHash === receipt.receiptHash;
  checks.push({
    id: "receipt-hash",
    label: "Receipt hash",
    result: selfConsistent && matchesStored ? "intact" : "tampered",
    detail: !selfConsistent
      ? "The content does not match its receiptHash: something in the receipt was changed."
      : !matchesStored
        ? "This receiptHash is not the one recorded when the revision was published."
        : `sha256 of the canonical receipt matches ${receipt.receiptHash.slice(0, 12)}…`,
  });

  const bodyHash = await sha256Hex(receipt.document.body);
  checks.push({
    id: "body-hash",
    label: "Article body",
    result: bodyHash === receipt.document.bodyHash ? "intact" : "tampered",
    detail:
      bodyHash === receipt.document.bodyHash
        ? "The article text matches its bodyHash."
        : "The article text was changed after publishing.",
  });

  for (const claim of receipt.claims) {
    claim.evidence.forEach((ev, i) => {
      const text = snapshotText(ev.sourceContentHash);
      const found =
        text !== null &&
        text.slice(ev.startOffset, ev.endOffset) === ev.snippet;
      checks.push({
        id: `evidence-${claim.id}-${i}`,
        claimId: claim.id,
        label: `Claim #${claim.index} evidence`,
        result: found ? "intact" : "tampered",
        detail:
          text === null
            ? "No frozen copy of this source version exists."
            : found
              ? `Snippet found at characters ${ev.startOffset}–${ev.endOffset} of the source as published.`
              : "The snippet is not at the recorded position in the source as published.",
      });
    });
  }
  return { ok: checks.every((c) => c.result === "intact"), checks };
}
