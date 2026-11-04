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

describe("missingNumbers mismatches", () => {
  it("flags a changed percentage", () => {
    const missing = missingNumbers(
      "Adoption reached 45% last year.",
      "Adoption reached 38% last year.",
    );
    expect(missing.map((m) => m.raw)).toEqual(["45%"]);
  });

  it("flags a changed year and a missing amount", () => {
    const missing = missingNumbers(
      "In 2023 reserves were $5 billion.",
      "In 2022 reserves grew.",
    );
    expect(missing.map((m) => m.raw.trim())).toEqual(["2023", "$5 billion"]);
  });

  it("passes claims with no numbers", () => {
    expect(
      missingNumbers("Circle issues USDC.", "Nothing numeric here."),
    ).toEqual([]);
  });
});
