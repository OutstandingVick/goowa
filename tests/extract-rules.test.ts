import { describe, expect, it } from "vitest";

import { ruleClaims } from "../shared/extract-rules";

describe("ruleClaims", () => {
  const text =
    "## Overview\n\nStablecoins are popular. USDC is issued by Circle and backed by reserves. Over 99% of stablecoins are dollar-denominated.\n\nWhy does this matter? It matters a great deal to many people.";

  it("keeps sentences that state a figure or name something", () => {
    expect(ruleClaims(text)).toEqual([
      "USDC is issued by Circle and backed by reserves.",
      "Over 99% of stablecoins are dollar-denominated.",
    ]);
  });

  it("skips headings, questions, and short or generic sentences", () => {
    const claims = ruleClaims(text);
    expect(claims.some((c) => c.startsWith("##") || c.endsWith("?"))).toBe(
      false,
    );
    expect(claims).not.toContain("Stablecoins are popular.");
  });

  it("caps the number of claims", () => {
    const many = Array.from(
      { length: 50 },
      (_, i) => `Issuer number ${i} holds reserves worth billions.`,
    ).join(" ");
    expect(ruleClaims(many, 10)).toHaveLength(10);
  });
});
