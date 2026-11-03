import { describe, expect, it } from "vitest";

import { fixContext } from "../app/components/goowa/SelectionPopover";

describe("fixContext", () => {
  const claim = {
    id: "c1",
    text: "USDC is backed 100% by cash.",
    status: "unverified",
    sourceIds: ["s1"],
  } as never;

  it("carries the exact span, offsets, overlapping claims, and note", () => {
    const ctx = fixContext(
      "doc-1",
      { start: 40, end: 52, text: "backed 100% " },
      [claim],
      "too strong",
    );
    const json = JSON.parse(ctx.slice(ctx.indexOf("{")));
    expect(json).toEqual({
      documentId: "doc-1",
      selection: { start: 40, end: 52, text: "backed 100% " },
      overlappingClaims: [
        {
          id: "c1",
          text: "USDC is backed 100% by cash.",
          status: "unverified",
          sourceIds: ["s1"],
        },
      ],
      userNote: "too strong",
    });
  });

  it("tells the agent to answer with propose-edit", () => {
    const ctx = fixContext("d", { start: 0, end: 1, text: "x" }, [], "");
    expect(ctx).toMatch(/calling propose-edit/);
    expect(ctx).toMatch(/spanStart = selection\.start/);
  });
});
