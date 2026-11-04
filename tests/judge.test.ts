import { describe, expect, it, vi } from "vitest";

import {
  verifyClaimText,
  type Judge,
  type SourceInput,
} from "../shared/verify/judge";

const circle: SourceInput = {
  id: "circle",
  title: "USDC overview",
  flags: [],
  text: "USDC is a digital dollar issued by Circle, running on many major blockchains. It's backed 100% by cash and cash-equivalent assets so that it's always redeemable 1:1 for USD. Circle publishes monthly attestation reports for USDC reserve holdings.",
};
const survey: SourceInput = {
  id: "survey",
  title: "Payments survey",
  flags: [],
  text: "In the 2024 survey, 38% of merchants said they accept stablecoin payments. Card payments remained the most common method at checkout.",
};

const never: Judge = vi.fn(async () => {
  throw new Error("judge should not be called");
});
const answering =
  (
    support: "supports" | "partially" | "does_not_support" | "contradicts",
    pick = 1,
    confidence = 0.9,
  ): Judge =>
  async (_claim, candidates) => ({
    support,
    evidenceIds: candidates.slice(0, pick).map((c) => c.id),
    confidence,
  });

describe("verifyClaimText deterministic paths", () => {
  it("supports an exact match without calling the model", async () => {
    const r = await verifyClaimText(
      "Circle says it's backed 100% by cash and cash-equivalent assets.",
      [circle],
      never,
    );
    expect(r).toMatchObject({ verdict: "supported", usedModel: false });
    expect(r.evidence[0]!.matchType).toBe("exact");
    expect(
      circle.text.slice(r.evidence[0]!.startOffset, r.evidence[0]!.endOffset),
    ).toBe(r.evidence[0]!.snippet);
  });

  it("marks an unrelated citation laundered and keeps the closest passage", async () => {
    const r = await verifyClaimText(
      "Stablecoins settled $27.6 trillion in Europe in 2024, overtaking Visa.",
      [circle],
      never,
    );
    expect(r.verdict).toBe("laundered");
    expect(r.reason).toBe(
      "Cited source does not contain or support this claim.",
    );
    expect(r.closestPassage?.sourceId).toBe("circle");
  });
});
