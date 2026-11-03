import { describe, expect, it } from "vitest";

import { proposalRanges } from "../shared/proposals";

const BODY = "USDC is backed by cash. USDC is backed by cash.";

describe("proposalRanges", () => {
  it("places body edits at the occurrence nearest spanStart", () => {
    const second = BODY.lastIndexOf("USDC");
    const [r] = proposalRanges(
      BODY,
      [
        {
          id: "e",
          targetType: "document_body",
          targetId: "d",
          spanStart: second,
          before: "USDC",
        },
      ],
      [],
    );
    expect(r).toEqual({ id: "e", start: second, end: second + 4 });
  });

  it("places claim edits on the claim span", () => {
    const claim = {
      id: "c",
      spanStart: 0,
      spanEnd: 23,
      text: "USDC is backed by cash.",
    };
    const [r] = proposalRanges(
      BODY,
      [
        {
          id: "e",
          targetType: "claim",
          targetId: "c",
          spanStart: 0,
          before: claim.text,
        },
      ],
      [claim],
    );
    expect(r).toMatchObject({ start: 0, end: 23 });
  });

  it("skips stale edits whose text is gone", () => {
    expect(
      proposalRanges(
        BODY,
        [
          {
            id: "e",
            targetType: "document_body",
            targetId: "d",
            spanStart: 0,
            before: "gold",
          },
        ],
        [],
      ),
    ).toEqual([]);
  });
});

describe("proposalRanges with changed claims", () => {
  it("skips a claim edit once the claim's text no longer matches", () => {
    const claim = {
      id: "c",
      spanStart: 0,
      spanEnd: 23,
      text: "USDC is backed by gold.",
    };
    expect(
      proposalRanges(
        BODY,
        [
          {
            id: "e",
            targetType: "claim",
            targetId: "c",
            spanStart: 0,
            before: "USDC is backed by cash.",
          },
        ],
        [claim],
      ),
    ).toEqual([]);
  });
});
