// Rule-based claim extraction for check-draft when the calling agent does
// not supply claims: a sentence is a factual claim when it states a figure
// or date, or names something (a capitalised word after the first).

import { splitSentences } from "./verify/retrieval.js";

const FIGURE = /\d/;
const NAME = /\s[A-Z][a-zA-Z]{1,}/;
const HEADING = /^#{1,6}\s/;

export function ruleClaims(body: string, max = 40): string[] {
  const out: string[] = [];
  for (const block of body.split(/\n{2,}/)) {
    if (HEADING.test(block.trim())) continue;
    for (const s of splitSentences(block)) {
      const text = s.text.trim();
      if (text.length < 25 || text.endsWith("?")) continue;
      if (FIGURE.test(text) || NAME.test(text)) out.push(text);
      if (out.length >= max) return out;
    }
  }
  return [...new Set(out)];
}
