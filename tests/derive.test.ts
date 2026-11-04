import { describe, expect, it } from "vitest";

import { changedFigure, deriveRewrite } from "../shared/derive";

const UP_OLD = "Stablecoin supply reached $160 billion at the start of 2024.";
const UP_NEW = "Stablecoin supply reached $200 billion at the start of 2024.";
const up = changedFigure(UP_OLD, UP_NEW)!;

describe("changedFigure", () => {
  it("finds the upstream figure that changed", () => {
    expect([up.before.raw.trim(), up.after.raw.trim()]).toEqual([
      "$160 billion",
      "$200 billion",
    ]);
  });
  it("returns null when no figure changed", () => {
    expect(changedFigure(UP_OLD, UP_OLD.replace("reached", "hit"))).toBeNull();
  });
});

describe("deriveRewrite", () => {
  it("recomputes a growth percentage from the stated base", () => {
    const r = deriveRewrite(
      "That was a 25% increase from $128 billion a year earlier.",
      up,
    )!;
    expect(r.text).toBe(
      "That was a 56% increase from $128 billion a year earlier.",
    );
    expect(r.changes[0]).toMatchObject({
      from: "25%",
      to: "56%",
      rule: "growth",
    });
  });

  it("recomputes a ratio from the compared quantity", () => {
    const r = deriveRewrite(
      "Supply is about 2.5 times the $64 billion held in money market tokens.",
      up,
    )!;
    expect(r.text).toBe(
      "Supply is about 3.1 times the $64 billion held in money market tokens.",
    );
    expect(r.changes[0]!.rule).toBe("ratio");
  });
});

describe("deriveRewrite other rules", () => {
  it("replaces a restated upstream figure in its own format", () => {
    const r = deriveRewrite("At $160 billion, supply set a record.", up)!;
    expect(r.text).toBe("At $200 billion, supply set a record.");
  });

  it("recomputes a share of a stated total", () => {
    const r = deriveRewrite("That is 80% of the $200 million... no", up);
    expect(r).toBeNull();
    const share = deriveRewrite(
      "Stablecoins are 5% of the $3,200 billion crypto market.",
      up,
    )!;
    expect(share.text).toBe(
      "Stablecoins are 6% of the $3,200 billion crypto market.",
    );
    expect(share.changes[0]!.rule).toBe("share");
  });
});
