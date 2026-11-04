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

describe("verifyClaimText numeric guard", () => {
  it("never marks a changed percentage supported, even if the model says so", async () => {
    const r = await verifyClaimText(
      "In the 2024 survey, 45% of merchants said they accept stablecoin payments.",
      [survey],
      answering("supports"),
    );
    expect(r.verdict).toBe("weak");
    expect(r.reason).toContain("45%");
    expect(r.reason).toContain("38%");
  });

  it("supports a paraphrase whose figures match", async () => {
    const r = await verifyClaimText(
      "38% of merchants in the 2024 survey accept stablecoins.",
      [survey],
      answering("supports"),
    );
    expect(r.verdict).toBe("supported");
    expect(r.evidence[0]!.matchType).toBe("paraphrase");
  });
});

describe("verifyClaimText snippet check", () => {
  it("downgrades to unverifiable when the model picks no real sentence", async () => {
    const bogus: Judge = async () => ({
      support: "supports",
      evidenceIds: ["S99"],
      confidence: 0.9,
    });
    const r = await verifyClaimText(
      "38% of merchants in the 2024 survey accept stablecoins.",
      [survey],
      bogus,
    );
    expect(r.verdict).toBe("unverifiable");
    expect(r.reason).toBe("Model cited text not in source.");
  });

  it("maps the model saying no support to laundered", async () => {
    const r = await verifyClaimText(
      "Card payments at checkout fell sharply in the 2024 survey.",
      [survey],
      answering("does_not_support"),
    );
    expect(r.verdict).toBe("laundered");
  });

  it("maps contradiction to unsupported and partial to weak", async () => {
    const claim =
      "Card payments remained the most common method at checkout in 2024.";
    expect(
      (await verifyClaimText(claim, [survey], answering("contradicts")))
        .verdict,
    ).toBe("unsupported");
    expect(
      (await verifyClaimText(claim, [survey], answering("partially"))).verdict,
    ).toBe("weak");
  });
});

describe("verifyClaimText source gates", () => {
  it("does not check claims whose only source is quarantined", async () => {
    const r = await verifyClaimText(
      "anything",
      [{ ...survey, flags: ["injection_suspected", "quarantined"] }],
      never,
    );
    expect(r).toMatchObject({ verdict: "unverifiable" });
    expect(r.reason).toMatch(/quarantined/);
  });

  it("treats claims with no sources as unsupported", async () => {
    expect((await verifyClaimText("anything", [], never)).verdict).toBe(
      "unsupported",
    );
  });

  it("reports an unavailable model as unverifiable, not supported", async () => {
    const r = await verifyClaimText(
      "38% of merchants in the 2024 survey accept stablecoins.",
      [survey],
      async () => null,
    );
    expect(r.verdict).toBe("unverifiable");
  });
});

describe("verifyClaimText deterministic numeric mismatch", () => {
  const fed: SourceInput = {
    id: "fed",
    title: "Fed note",
    flags: [],
    text: "Additionally, USDT differs significantly in that only 45 percent of its supply was issued on Ethereum as of March 1, 2023, with the most of the non-Ethereum-issued USDT having been issued on Tron.",
  };
  it("caps a changed figure at weak without calling the model", async () => {
    const r = await verifyClaimText(
      "Only 38 percent of USDT's supply was issued on Ethereum as of March 1, 2023.",
      [fed],
      never,
    );
    expect(r.verdict).toBe("weak");
    expect(r.usedModel).toBe(false);
    expect(r.reason).toBe("Claim says 38 percent; the source says 45 percent.");
    expect(
      fed.text.slice(r.evidence[0]!.startOffset, r.evidence[0]!.endOffset),
    ).toBe(r.evidence[0]!.snippet);
  });
});

describe("numeric mismatch evidence sentence", () => {
  it("quotes the sentence with the conflicting figure, not its neighbour", async () => {
    const fed: SourceInput = {
      id: "fed",
      title: "Fed note",
      flags: [],
      text: "BUSD's market cap decreased by over $2 billion. Additionally, USDT differs significantly in that only 45 percent of its supply was issued on Ethereum as of March 1, 2023, with most of the rest issued on Tron.",
    };
    const r = await verifyClaimText(
      "Only 38 percent of USDT's supply was issued on Ethereum as of March 1, 2023.",
      [fed],
      never,
    );
    expect(r.evidence[0]!.snippet).toMatch(/^Additionally, USDT/);
    expect(r.reason).toBe("Claim says 38 percent; the source says 45 percent.");
  });
});
