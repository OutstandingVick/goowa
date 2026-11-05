import { describe, expect, it } from "vitest";

import { verifyClaimText } from "../shared/verify/judge";
import { overlapScore, weightedTokens } from "../shared/verify/retrieval";

// From the BIS annual report page: footnote markers sit between sentences.
const BIS =
  "Settlement on a unified ledger has been explored in initiatives like Project Aurora, 40 which aims to enable cross-border collaboration. Project Mandala is one example. 41 In next-generation correspondent banking, tokenised deposits settle on shared ledgers.";

describe("footnote markers are not figures", () => {
  it("a bare 40 does not match $40 trillion", () => {
    const claim = weightedTokens("Stablecoins settled $40 trillion of payments in 2024.");
    expect(overlapScore(claim, "Project Aurora, 40 which aims")).toBe(0);
  });

  it("the same quantity still matches across formats", () => {
    const claim = weightedTokens("Reserves are 40% cash.");
    expect(overlapScore(claim, "a 0.4 share is held in cash")).toBeGreaterThan(0.5);
    expect(weightedTokens("$160 billion").has("#160000000000")).toBe(true);
  });

  it("an invented figure against footnoted text is not weak", async () => {
    const r = await verifyClaimText(
      "Stablecoins settled $40 trillion of payments in 2024.",
      [{ id: "bis", title: "BIS", text: BIS, flags: [] }],
      async () => null,
    );
    expect(r.verdict).not.toBe("weak");
    expect(r.verdict).not.toBe("supported");
  });
});
