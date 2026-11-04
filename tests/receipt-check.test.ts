import { describe, expect, it } from "vitest";

import { receiptHashOf, sha256Hex } from "../shared/canonical";
import { checkReceipt, type Receipt } from "../shared/receipt";

const SOURCE =
  "USDC is a digital dollar issued by Circle, running on many major blockchains.";
const snapshots = new Map([["h1", SOURCE]]);
const lookup = (h: string) => snapshots.get(h) ?? null;

async function genuine(): Promise<Receipt> {
  const body =
    "## Supply\n\nUSDC is a digital dollar issued by Circle, running on many major blockchains.";
  const r: Omit<Receipt, "receiptHash"> = {
    version: 1,
    document: {
      id: "d1",
      title: "T",
      revision: 1,
      publishedAt: "2026-11-04T00:00:00Z",
      publishedBy: "human",
      body,
      bodyHash: await sha256Hex(body),
    },
    claims: [
      {
        id: "c1",
        index: 1,
        text: SOURCE,
        span: { start: 11, end: 11 + SOURCE.length },
        status: "supported",
        verdict: { value: "supported", reason: "Exact match", confidence: 1 },
        human: null,
        evidence: [
          {
            sourceId: "s1",
            sourceUrl: "https://c",
            snippet: SOURCE,
            startOffset: 0,
            endOffset: SOURCE.length,
            matchType: "exact",
            sourceContentHash: "h1",
            verifiedAt: "2026-11-03T00:00:00Z",
            verifiedBy: "agent",
          },
        ],
        overrides: [],
      },
    ],
    sources: [
      {
        id: "s1",
        url: "https://c",
        title: "Circle",
        contentHash: "h1",
        fetchedAt: "2026-11-02T00:00:00Z",
        flags: [],
        excluded: false,
      },
    ],
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

const failed = (res: Awaited<ReturnType<typeof checkReceipt>>) =>
  res.checks.filter((c) => c.result === "tampered").map((c) => c.id);

describe("checkReceipt", () => {
  it("passes every check for a genuine receipt", async () => {
    const r = await genuine();
    const res = await checkReceipt(r, r.receiptHash, lookup);
    expect(res.ok).toBe(true);
    expect(res.checks.map((c) => c.id)).toEqual([
      "receipt-hash",
      "body-hash",
      "evidence-c1-0",
    ]);
  });

  it("flags a body edit on the body and the receipt hash only", async () => {
    const r = await genuine();
    const stored = r.receiptHash;
    r.document.body = r.document.body.replace("Circle", "Tether");
    expect(failed(await checkReceipt(r, stored, lookup))).toEqual([
      "receipt-hash",
      "body-hash",
    ]);
  });

  it("flags a snippet edit on that evidence and the receipt hash", async () => {
    const r = await genuine();
    const stored = r.receiptHash;
    r.claims[0]!.evidence[0]!.snippet =
      "USDC is a digital dollar issued by the Federal Reserve.";
    expect(failed(await checkReceipt(r, stored, lookup))).toEqual([
      "receipt-hash",
      "evidence-c1-0",
    ]);
  });

  it("flags a swapped hash even when the receipt is re-hashed consistently", async () => {
    const r = await genuine();
    const stored = r.receiptHash;
    r.claims[0]!.status = "weak";
    r.receiptHash = await receiptHashOf(r as never);
    const res = await checkReceipt(r, stored, lookup);
    expect(failed(res)).toEqual(["receipt-hash"]);
    expect(res.checks[0]!.detail).toMatch(/not the one recorded/);
  });
});
