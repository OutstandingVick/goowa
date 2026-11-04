// Deterministic recomputation of figures that derive from an upstream claim.
// The model never does this arithmetic: code finds how each downstream figure
// relates to the old upstream figure and recomputes it from the new one.

import {
  extractNumbers,
  sameQuantity,
  type NumberMention,
} from "./verify/numbers.js";

export type FigureChange = {
  from: string;
  to: string;
  rule: "restated" | "growth" | "ratio" | "share";
  explanation: string;
};

/** Figures read aloud starting with a vowel sound: 8…, 11, 18, 80–89, 800… */
function startsWithVowelSound(figure: string) {
  const digits = figure.replace(/^[^\d]*/, "").replace(/,/g, "");
  const whole = digits.match(/^\d+/)?.[0] ?? "";
  if (whole.startsWith("8")) return true;
  // 11 and 18 (and 11,000 / 18 million, read "eleven…", "eighteen…").
  return /^(11|18)$/.test(whole) || /^(11|18)(\d{3})+$/.test(whole);
}

export type Rewrite = { text: string; changes: FigureChange[] };

/** The upstream figure that changed: same position, different value. */
export function changedFigure(
  oldText: string,
  newText: string,
): { before: NumberMention; after: NumberMention } | null {
  const a = extractNumbers(oldText);
  const b = extractNumbers(newText);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i]!.kind === b[i]!.kind && !sameQuantity(a[i]!, b[i]!)) {
      return { before: a[i]!, after: b[i]! };
    }
  }
  return null;
}

const SCALES: [RegExp, number][] = [
  [/\btrillion\b|\btn\b|\bt\b/i, 1e12],
  [/\bbillion\b|\bbn\b|\bb\b/i, 1e9],
  [/\bmillion\b|\bmn\b|\bm\b/i, 1e6],
  [/\bthousand\b|\bk\b/i, 1e3],
];

function scaleOf(raw: string): number {
  for (const [re, f] of SCALES)
    if (re.test(raw.replace(/^[^a-z]*\d[\d,.]*\s*/i, ""))) return f;
  return 1;
}

function decimalsOf(raw: string): number {
  const digits = raw.match(/\d[\d,]*(?:\.(\d+))?/);
  return digits?.[1]?.length ?? 0;
}

/** Format `value` the way `like` is written (currency, scale word, decimals). */
export function formatLike(value: number, like: NumberMention): string {
  const scale = like.kind === "percent" ? 1 : scaleOf(like.raw);
  const shown = value / scale;
  const decimals = decimalsOf(like.raw);
  const numeric = like.raw.match(/\d[\d,]*(?:\.\d+)?/)![0];
  const grouped = numeric.includes(",");
  const text = shown.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  });
  return like.raw.replace(numeric, text);
}

/** Close enough given the precision the figure was written with. */
function near(actual: number, expected: number, like: NumberMention) {
  const step = 10 ** -decimalsOf(like.raw);
  const tolerance =
    like.kind === "percent" ? step : Math.max(step, Math.abs(expected) * 0.02);
  return (
    Math.abs(actual - expected) <= tolerance * 0.51 + 1e-9 ||
    Math.abs(actual - expected) / Math.max(1e-9, Math.abs(expected)) < 0.01
  );
}

/**
 * Rewrite only the figures in `sentence` that derive from the upstream
 * figure. Returns null when nothing in the sentence derives from it.
 */
export function deriveRewrite(
  sentence: string,
  upstream: { before: NumberMention; after: NumberMention },
): Rewrite | null {
  const u = upstream.before.value;
  const u2 = upstream.after.value;
  const nums = extractNumbers(sentence);
  const changes: (FigureChange & { index: number })[] = [];

  for (const d of nums) {
    const others = nums.filter((n) => n !== d && n.kind !== "percent");
    const after = sentence.slice(d.index + d.raw.length);

    // Restated: the downstream sentence repeats the upstream figure.
    if (d.kind === upstream.before.kind && sameQuantity(d, upstream.before)) {
      changes.push({
        index: d.index,
        from: d.raw,
        to: formatLike(u2, d),
        rule: "restated",
        explanation: `restates the upstream figure (${upstream.before.raw.trim()} → ${upstream.after.raw.trim()})`,
      });
      continue;
    }

    if (d.kind === "percent") {
      // Growth: u = base × (1 + d%)
      const base = others.find((b) =>
        near(d.value, (u / b.value - 1) * 100, d),
      );
      if (base) {
        const next = (u2 / base.value - 1) * 100;
        changes.push({
          index: d.index,
          from: d.raw,
          to: formatLike(next, d),
          rule: "growth",
          explanation: `(${upstream.after.raw.trim()} ÷ ${base.raw.trim()} − 1) = ${next.toFixed(2)}%`,
        });
        continue;
      }
      // Share: d% = u ÷ total
      const total = others.find((t) => near(d.value, (u / t.value) * 100, d));
      if (total) {
        const next = (u2 / total.value) * 100;
        changes.push({
          index: d.index,
          from: d.raw,
          to: formatLike(next, d),
          rule: "share",
          explanation: `${upstream.after.raw.trim()} ÷ ${total.raw.trim()} = ${next.toFixed(2)}%`,
        });
        continue;
      }
    }

    // Ratio: "d times the c" where u = d × c
    if (d.kind === "plain" && /^\s*(?:times|x)\b/i.test(after)) {
      const other = others.find((c) => near(d.value, u / c.value, d));
      if (other) {
        const next = u2 / other.value;
        changes.push({
          index: d.index,
          from: d.raw,
          to: formatLike(next, d),
          rule: "ratio",
          explanation: `${upstream.after.raw.trim()} ÷ ${other.raw.trim()} = ${next.toFixed(3)}`,
        });
      }
    }
  }

  const real = changes.filter((c) => c.from !== c.to);
  if (real.length === 0) return null;
  // Replace right to left so earlier offsets stay valid.
  let text = sentence;
  for (const c of [...real].sort((a, b) => b.index - a.index)) {
    let head = text.slice(0, c.index);
    // Keep the article right before the figure grammatical ("an 88%").
    const article = /\b(a|an|A|An) $/.exec(head);
    if (article) {
      const wantAn = startsWithVowelSound(c.to);
      const word = article[1]!;
      const fixed = wantAn
        ? word[0] === "A"
          ? "An"
          : "an"
        : word[0] === "A"
          ? "A"
          : "a";
      head = head.slice(0, article.index) + fixed + " ";
    }
    text = head + c.to + text.slice(c.index + c.from.length);
  }
  return { text, changes: real.map(({ index: _i, ...c }) => c) };
}
