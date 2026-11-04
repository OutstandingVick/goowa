import { describe, expect, it } from "vitest";

import { claimCore, findExact, snippetInSource } from "../shared/verify/match";

const SOURCE =
  "USDC is a digital dollar issued by Circle.  It’s backed 100% by cash and cash-equivalent assets so that it’s always redeemable 1:1 for USD.";

describe("claimCore", () => {
  it.each([
    ["Circle says it's backed 100% by cash.", "it's backed 100% by cash"],
    ["According to the Fed, stablecoins can de-peg.", "stablecoins can de-peg"],
    [
      "The Federal Reserve notes that stablecoins can de-peg.",
      "stablecoins can de-peg",
    ],
    ["USDC is a digital dollar.", "USDC is a digital dollar"],
  ])("strips the lead-in from %s", (claim, core) => {
    expect(claimCore(claim)).toBe(core);
  });
});

describe("findExact", () => {
  it("matches across curly quotes, case, and spacing and maps offsets back", () => {
    const hit = findExact(
      "Circle says it's backed 100% by cash and cash-equivalent assets.",
      SOURCE,
    )!;
    expect(SOURCE.slice(hit.start, hit.end)).toBe(
      "It’s backed 100% by cash and cash-equivalent assets",
    );
  });

  it("returns null when the wording differs", () => {
    expect(
      findExact("USDC is fully reserved by gold bars held in vaults.", SOURCE),
    ).toBeNull();
  });
});

describe("snippetInSource", () => {
  it("accepts the snippet at its offsets and rejects invented text", () => {
    const s = "issued by Circle";
    const at = SOURCE.indexOf(s);
    expect(snippetInSource(s, SOURCE, at, at + s.length)).toBe(true);
    expect(
      snippetInSource("issued by the Federal Reserve", SOURCE, at, at + 10),
    ).toBe(false);
    expect(snippetInSource("", SOURCE, 0, 0)).toBe(false);
  });
});
