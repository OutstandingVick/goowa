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
