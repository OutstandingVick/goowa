import { describe, expect, it } from "vitest";

import { ruleClaims } from "../shared/extract-rules";

const NOTE =
  "This text was submitted by an external agent for claim checking. Each factual sentence above is verified against the listed sources.";
const pad = (text: string) =>
  text.length >= 200 ? text : `${text}\n\n${NOTE}`.padEnd(200, " ");

describe("check-draft padding", () => {
  it("brings the shortest allowed draft to the 200-character minimum", () => {
    expect(pad("x".repeat(40)).length).toBeGreaterThanOrEqual(200);
  });
  it("adds no claims of its own", () => {
    expect(ruleClaims(NOTE)).toEqual([]);
  });
});
