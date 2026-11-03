// Splits a plain-text/markdown body into renderable blocks and segments.
// Every segment keeps its absolute [start, end) offsets into the body, so a
// highlight always covers exactly the characters its claim's span names and a
// DOM selection maps straight back to body offsets.

export type Mark = { id: string; start: number; end: number };

export type Block = {
  kind: "heading" | "paragraph";
  level: number; // heading level, 0 for paragraphs
  start: number; // offset of the block's first character (incl. "## ")
  contentStart: number; // offset after any heading marker
  end: number; // exclusive; excludes the trailing newline
};

export type Segment = {
  start: number;
  end: number;
  text: string;
  claimIds: string[]; // claims covering this whole segment
  proposalIds: string[]; // proposals whose replaced range covers it
};

const HEADING = /^(#{1,6})\s+/;

/** Blocks are runs of non-blank lines; a line starting with #'s is a heading. */
export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  const lineRe = /[^\n]*/g;
  let para: { start: number; end: number } | null = null;
  const flush = () => {
    if (para) {
      blocks.push({
        kind: "paragraph",
        level: 0,
        start: para.start,
        contentStart: para.start,
        end: para.end,
      });
    }
    para = null;
  };
  for (let m = lineRe.exec(body); m; m = lineRe.exec(body)) {
    const start = m.index;
    const line = m[0];
    const end = start + line.length;
    if (line.trim() === "") {
      flush();
    } else {
      const heading = HEADING.exec(line);
      if (heading) {
        flush();
        blocks.push({
          kind: "heading",
          level: heading[1]!.length,
          start,
          contentStart: start + heading[0].length,
          end,
        });
      } else if (para) {
        para.end = end;
      } else {
        para = { start, end };
      }
    }
    if (end >= body.length) break;
    lineRe.lastIndex = end + 1;
  }
  flush();
  return blocks;
}

/** Cut [from, to) at every mark boundary that falls inside it. */
export function segmentRange(
  body: string,
  from: number,
  to: number,
  claims: readonly Mark[],
  proposals: readonly Mark[] = [],
): Segment[] {
  const cuts = new Set<number>([from, to]);
  for (const m of [...claims, ...proposals]) {
    if (m.start > from && m.start < to) cuts.add(m.start);
    if (m.end > from && m.end < to) cuts.add(m.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!;
    const end = points[i + 1]!;
    if (end <= start) continue;
    const covers = (m: Mark) => m.start <= start && end <= m.end;
    segments.push({
      start,
      end,
      text: body.slice(start, end),
      claimIds: claims.filter(covers).map((m) => m.id),
      proposalIds: proposals.filter(covers).map((m) => m.id),
    });
  }
  return segments;
}

/** Ids of marks that overlap [start, end) by at least one character. */
export function overlapping(
  marks: readonly Mark[],
  start: number,
  end: number,
): string[] {
  return marks
    .filter((m) =>
      start === end
        ? m.start <= start && start < m.end
        : m.start < end && start < m.end,
    )
    .map((m) => m.id);
}
