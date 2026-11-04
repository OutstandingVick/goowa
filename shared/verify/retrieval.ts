// Deterministic retrieval: split a source into passages and rank them by
// lexical overlap with a claim. No model is involved here.

export type Sentence = { start: number; end: number; text: string };
export type Passage = {
  start: number;
  end: number;
  text: string;
  sentences: Sentence[];
  score: number;
};

const STOP = new Set(
  "a an and are as at be been by for from has have in into is it its of on or that the their this to was were which with will can could may than then there these those also not no but if so such we our they".split(
    " ",
  ),
);

const ABBREVIATION =
  /(?:\b[A-Z]|\b(?:e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|St|No|Fig|Inc|Ltd|Co|Corp|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec))$/;

/** Sentences with absolute offsets; abbreviations like "U.S." stay intact. */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const push = (from: number, to: number) => {
    while (from < to && /\s/.test(text[from]!)) from++;
    while (to > from && /\s/.test(text[to - 1]!)) to--;
    if (to <= from) return;
    const prev = out[out.length - 1];
    // Join very short fragments onto the previous sentence.
    if (prev && to - from < 25) {
      prev.end = to;
      prev.text = text.slice(prev.start, to);
      return;
    }
    out.push({ start: from, end: to, text: text.slice(from, to) });
  };
  let start = 0;
  const boundary = /[.!?]+["”’)]*(?=\s+["“(]?[A-Z0-9])/g;
  for (let m = boundary.exec(text); m; m = boundary.exec(text)) {
    if (m[0].startsWith(".") && ABBREVIATION.test(text.slice(start, m.index))) {
      continue;
    }
    push(start, m.index + m[0].length);
    start = m.index + m[0].length;
  }
  push(start, text.length);
  return out;
}

/** Overlapping windows of one and two sentences. */
export function passages(text: string): Omit<Passage, "score">[] {
  const sentences = splitSentences(text);
  const out: Omit<Passage, "score">[] = [];
  sentences.forEach((s, i) => {
    out.push({ start: s.start, end: s.end, text: s.text, sentences: [s] });
    const next = sentences[i + 1];
    if (next) {
      out.push({
        start: s.start,
        end: next.end,
        text: text.slice(s.start, next.end),
        sentences: [s, next],
      });
    }
  });
  return out;
}

export function normalizeWord(word: string): string {
  let w = word.toLowerCase().replace(/[’']s$/, "");
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss"))
    w = w.slice(0, -1);
  return w;
}

/** Content tokens with weights: numbers, dates, %, and Names count 3x. */
export function weightedTokens(text: string): Map<string, number> {
  const tokens = new Map<string, number>();
  const re = /\$?\d[\d,.]*%?|[A-Za-z][A-Za-z’'-]*/g;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    const isNumber = /\d/.test(raw);
    const token = isNumber
      ? raw.replace(/[,$]/g, "").replace(/\.$/, "")
      : normalizeWord(raw);
    if (!isNumber && (token.length < 2 || STOP.has(token))) continue;
    const isName = !isNumber && /^[A-Z]/.test(raw) && m.index !== 0;
    const weight = isNumber ? 3 : isName || /^[A-Z]{2,}$/.test(raw) ? 3 : 1;
    tokens.set(token, Math.max(tokens.get(token) ?? 0, weight));
  }
  return tokens;
}

/** Share of the claim's weighted tokens that appear in the passage (0–1). */
export function overlapScore(
  claim: Map<string, number>,
  passageText: string,
): number {
  const have = weightedTokens(passageText);
  let total = 0;
  let hit = 0;
  for (const [token, weight] of claim) {
    total += weight;
    if (have.has(token)) hit += weight;
  }
  return total === 0 ? 0 : hit / total;
}

/** Top-k passages for a claim, best first; ties keep source order. */
export function rankPassages(
  claimText: string,
  sourceText: string,
  k = 3,
): Passage[] {
  const claim = weightedTokens(claimText);
  const scored = passages(sourceText).map((p) => ({
    ...p,
    score: overlapScore(claim, p.text),
  }));
  scored.sort((a, b) => b.score - a.score || a.start - b.start);
  // Drop passages that overlap a better one so the top k are distinct.
  const picked: Passage[] = [];
  for (const p of scored) {
    if (picked.some((q) => p.start < q.end && q.start < p.end)) continue;
    picked.push(p);
    if (picked.length === k) break;
  }
  return picked;
}
