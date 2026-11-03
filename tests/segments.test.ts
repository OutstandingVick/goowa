import { describe, expect, it } from "vitest";

import {
  overlapping,
  parseBlocks,
  segmentRange,
  type Mark,
} from "../shared/segments";

const BODY =
  "## What a stablecoin is\n\nStablecoins track the dollar. USDC is one.\n\n## Rules\nMiCA applies.";

function mark(id: string, text: string, body = BODY): Mark {
  const start = body.indexOf(text);
  return { id, start, end: start + text.length };
}

describe("parseBlocks", () => {
  it("splits headings and paragraphs with absolute offsets", () => {
    const blocks = parseBlocks(BODY);
    expect(blocks.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "paragraph",
    ]);
    for (const b of blocks) {
      expect(BODY.slice(b.contentStart, b.end)).not.toMatch(/^#|\n/);
    }
    expect(BODY.slice(blocks[0]!.contentStart, blocks[0]!.end)).toBe(
      "What a stablecoin is",
    );
    expect(BODY.slice(blocks[3]!.start, blocks[3]!.end)).toBe("MiCA applies.");
  });
});
