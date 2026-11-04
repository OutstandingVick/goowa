import { describe, expect, it, vi } from "vitest";

import { receiptHashOf, sha256Hex } from "../shared/canonical";
import type { Receipt } from "../shared/receipt";

const SOURCE =
  "Over 99% of stablecoins are US dollar-denominated, with a growing cross-border presence.";
let stored: string | null = null;
vi.mock("../server/lib/receipt", () => ({
  loadReceipt: async () => (stored ? { receiptHash: stored } : null),
  snapshotsFor: async () => new Map([["h1", SOURCE]]),
}));
const { default: verifyReceipt } = await import("../actions/verify-receipt");

async function receipt(): Promise<Receipt> {
  const body = SOURCE;
  const r = {
    version: 1 as const,
    document: {
      id: "d",
      title: "T",
      revision: 1,
      publishedAt: "x",
      publishedBy: "human" as const,
      body,
      bodyHash: await sha256Hex(body),
    },
    claims: [
      {
        id: "c",
        index: 1,
        text: SOURCE,
        span: { start: 0, end: SOURCE.length },
        status: "supported",
        verdict: null,
        human: null,
        evidence: [
          {
            sourceId: "s",
            sourceUrl: "u",
            snippet: SOURCE,
            startOffset: 0,
            endOffset: SOURCE.length,
            matchType: "exact",
            sourceContentHash: "h1",
            verifiedAt: null,
            verifiedBy: null,
          },
        ],
        overrides: [],
      },
    ],
    sources: [],
    summary: {
      claims: 1,
      byStatus: { supported: 1 },
      overrides: 0,
      agentPublishAttemptsBlocked: 0,
    },
    history: [],
  };
  return { ...r, receiptHash: await receiptHashOf(r) };
}

describe("verify-receipt action", () => {
  it("accepts a receipt as a JSON string and reports it intact and known", async () => {
    const r = await receipt();
    stored = r.receiptHash;
    const res = await verifyReceipt.run(
      { receiptJson: JSON.stringify(r) },
      undefined,
    );
    expect(res).toMatchObject({
      ok: true,
      known: true,
      documentId: "d",
      revision: 1,
    });
  });

  it("flags a receipt whose hash was never recorded at publish", async () => {
    const r = await receipt();
    stored = "f".repeat(64);
    const res = await verifyReceipt.run({ receiptJson: r as never }, undefined);
    expect(res.ok).toBe(false);
    expect(res.checks[0]).toMatchObject({
      id: "receipt-hash",
      result: "tampered",
    });
  });

  it("rejects input that is not a receipt", async () => {
    await expect(
      verifyReceipt.run({ receiptJson: "{}" }, undefined),
    ).rejects.toThrow(/not a Goowa receipt/);
    await expect(
      verifyReceipt.run({ receiptJson: "{nope" }, undefined),
    ).rejects.toThrow(/not valid JSON/);
  });

  it("is callable signed out, read-only", () => {
    expect(verifyReceipt.requiresAuth).toBe(false);
    expect(verifyReceipt.readOnly).toBe(true);
  });
});
