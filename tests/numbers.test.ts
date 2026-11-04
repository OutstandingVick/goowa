import { describe, expect, it } from "vitest";

import { extractNumbers, missingNumbers } from "../shared/verify/numbers";

describe("extractNumbers", () => {
  it("reads percents, scaled amounts, ratios, and years", () => {
    const n = extractNumbers(
      "40% of $1.2B in 2024, redeemable 1:1, and 3 million users",
    );
    expect(n.map((x) => [x.kind, x.value])).toEqual([
      ["percent", 40],
      ["plain", 1.2e9],
      ["plain", 2024],
      ["ratio", 1],
      ["plain", 3e6],
    ]);
  });

  it("ignores digits inside identifiers", () => {
    expect(extractNumbers("COVID-19 and H2 results")).toEqual([]);
  });
});

describe("missingNumbers variants", () => {
  it.each([
    ["40%", "40 percent"],
    ["40%", "a share of 0.4"],
    ["0.4", "40%"],
    ["$1.2B", "1.2 billion dollars"],
    ["1.2 billion", "$1,200 million"],
    ["1,000", "1000"],
  ])('accepts %s matched by "%s"', (claim, snippet) => {
    expect(missingNumbers(`It was ${claim}.`, snippet)).toEqual([]);
  });
});
