import { describe, expect, it } from "vitest";

import {
  rankPassages,
  splitSentences,
  weightedTokens,
} from "../shared/verify/retrieval";

const SOURCE =
  "USDC is a digital dollar issued by Circle. It's backed 100% by cash and cash-equivalent assets so that it's always redeemable 1:1 for USD. Circle publishes monthly attestation reports. Developers can integrate USDC into their applications.";

describe("splitSentences", () => {
  it("returns sentences with offsets that slice back to their text", () => {
    const s = splitSentences(SOURCE);
    expect(s).toHaveLength(4);
    for (const x of s) expect(SOURCE.slice(x.start, x.end)).toBe(x.text);
  });

  it("keeps abbreviations like U.S. inside one sentence", () => {
    const text =
      "The U.S. dollar is the reference. The next sentence is long enough to stand alone.";
    expect(splitSentences(text)[0]!.text).toBe(
      "The U.S. dollar is the reference.",
    );
  });
});

describe("weightedTokens", () => {
  it("weights numbers and names 3x and drops stop words", () => {
    const t = weightedTokens("Circle says USDC is backed 100% by cash");
    expect(t.get("#1")).toBe(3); // 100% as a quantity
    expect(t.get("usdc")).toBe(3);
    expect(t.get("cash")).toBe(1);
    expect(t.has("is")).toBe(false);
  });
});

describe("rankPassages", () => {
  it("puts the passage that states the claim first", () => {
    const [best] = rankPassages("USDC is redeemable 1:1 for USD", SOURCE);
    expect(best!.text).toContain("redeemable 1:1 for USD");
    expect(SOURCE.slice(best!.start, best!.end)).toBe(best!.text);
  });

  it("returns distinct, non-overlapping passages", () => {
    const top = rankPassages("Circle USDC attestation reports", SOURCE, 3);
    for (let i = 0; i < top.length; i++)
      for (let j = i + 1; j < top.length; j++)
        expect(
          top[i]!.end <= top[j]!.start || top[j]!.end <= top[i]!.start,
        ).toBe(true);
  });

  it("scores unrelated claims low", () => {
    const [best] = rankPassages(
      "The euro area inflation rate fell to 2.4 percent in May",
      SOURCE,
    );
    expect(best!.score).toBeLessThan(0.2);
  });
});
