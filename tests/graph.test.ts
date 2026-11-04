import { describe, expect, it } from "vitest";

import { cycleIfDepends, downstream } from "../shared/graph";

const nodes = [
  { id: "up", dependsOn: [] },
  { id: "a", dependsOn: ["up"] },
  { id: "b", dependsOn: ["up"] },
  { id: "c", dependsOn: ["a"] },
  { id: "other", dependsOn: [] },
];

describe("downstream", () => {
  it("walks breadth-first with depth and the claim it came through", () => {
    expect(downstream(nodes, "up")).toEqual([
      { id: "a", depth: 1, via: "up" },
      { id: "b", depth: 1, via: "up" },
      { id: "c", depth: 2, via: "a" },
    ]);
  });

  it("respects the depth limit and never includes unrelated claims", () => {
    expect(downstream(nodes, "up", 1).map((d) => d.id)).toEqual(["a", "b"]);
    expect(downstream(nodes, "other")).toEqual([]);
  });
});
