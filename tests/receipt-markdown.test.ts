import { describe, expect, it } from "vitest";

import type { Receipt } from "../shared/receipt";
import { receiptToMarkdown } from "../shared/receipt-markdown";

const body = "## Supply\n\nSupply reached $160 billion. Most is in dollars.";
const receipt = {
  version: 1,
  document: {
    id: "d",
    title: "Supply",
    revision: 1,
    publishedAt: "2026-11-04T00:00:00Z",
    publishedBy: "human",
    body,
    bodyHash: "",
  },
  claims: [
    {
      id: "a",
      index: 1,
      text: "Supply reached $160 billion.",
      span: { start: 11, end: 39 },
      status: "supported",
      verdict: null,
      human: null,
      evidence: [
        {
          sourceId: "s",
          sourceUrl: "https://t",
          snippet: "reached $160 billion",
          startOffset: 0,
          endOffset: 20,
          matchType: "exact",
          sourceContentHash: "h",
          verifiedAt: null,
          verifiedBy: null,
        },
      ],
      overrides: [],
    },
    {
      id: "b",
      index: 2,
      text: "Most is in dollars.",
      span: { start: 40, end: 59 },
      status: "laundered",
      verdict: null,
      human: null,
      evidence: [],
      overrides: [
        { kind: "claim_laundered", reason: "Editor checked by hand." },
      ],
    },
  ],
  sources: [
    {
      id: "s",
      url: "https://t",
      title: "Tracker",
      contentHash: "h",
      fetchedAt: "",
      flags: [],
      excluded: false,
    },
  ],
  summary: {
    claims: 2,
    byStatus: {},
    overrides: 1,
    agentPublishAttemptsBlocked: 0,
  },
  history: [],
  receiptHash: "abc",
} as Receipt;

describe("receiptToMarkdown", () => {
  it("adds a footnote after each claim and cites its source", () => {
    const md = receiptToMarkdown(receipt);
    expect(md).toContain(
      "Supply reached $160 billion.[^1] Most is in dollars.[^2]",
    );
    expect(md).toContain(
      "[^1]: supported. [Tracker](https://t): “reached $160 billion”",
    );
    expect(md).toContain(
      "[^2]: laundered. No supporting source. Published with an override: Editor checked by hand.",
    );
    expect(md.startsWith("# Supply")).toBe(true);
  });
});
