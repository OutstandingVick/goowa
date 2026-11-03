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

describe("parseBlocks edge cases", () => {
  it("joins consecutive lines into one paragraph", () => {
    const body = "line one\nline two\n\nnext";
    const blocks = parseBlocks(body);
    expect(blocks).toHaveLength(2);
    expect(body.slice(blocks[0]!.start, blocks[0]!.end)).toBe(
      "line one\nline two",
    );
  });

  it("handles an empty body and trailing blank lines", () => {
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("text\n\n\n")).toHaveLength(1);
  });
});

describe("segmentRange", () => {
  it("covers the range with no gaps and keeps body text", () => {
    const para = parseBlocks(BODY)[1]!;
    const segs = segmentRange(BODY, para.start, para.end, [
      mark("a", "USDC is one."),
    ]);
    expect(segs.map((s) => s.text).join("")).toBe(
      BODY.slice(para.start, para.end),
    );
    for (const s of segs) expect(BODY.slice(s.start, s.end)).toBe(s.text);
    expect(segs.find((s) => s.claimIds.includes("a"))!.text).toBe(
      "USDC is one.",
    );
  });
});
