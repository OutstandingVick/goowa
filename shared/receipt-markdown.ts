import type { Receipt } from "./receipt.js";

/**
 * Markdown export of a published article: each claim gets a footnote marker
 * after its sentence, and footnotes cite the source URL, the snippet, and the
 * claim's status. Quarantined sources are never cited.
 */
export function receiptToMarkdown(receipt: Receipt): string {
  const { document: doc } = receipt;
  const sources = new Map(receipt.sources.map((s) => [s.id, s]));
  // Insert markers right to left so earlier offsets stay valid.
  const claims = [...receipt.claims].sort((a, b) => b.span.end - a.span.end);
  let body = doc.body;
  for (const c of claims) {
    if (c.span.end <= c.span.start || c.span.end > body.length) continue;
    body = `${body.slice(0, c.span.end)}[^${c.index}]${body.slice(c.span.end)}`;
  }
  const notes = [...receipt.claims]
    .sort((a, b) => a.index - b.index)
    .map((c) => {
      const ev = c.evidence[0];
      const src = ev ? sources.get(ev.sourceId) : undefined;
      const status = c.human ? `${c.status}, confirmed by a human` : c.status;
      const override = c.overrides.length
        ? ` Published with an override: ${c.overrides.map((o) => o.reason).join("; ")}`
        : "";
      const cite = src
        ? ` [${src.title || src.url}](${src.url}): “${ev!.snippet}”`
        : " No supporting source.";
      return `[^${c.index}]: ${status}.${cite}${override}`;
    });
  return [
    `# ${doc.title}`,
    "",
    `_Published revision ${doc.revision} on ${doc.publishedAt}. Receipt ${receipt.receiptHash}._`,
    "",
    body.trim(),
    "",
    ...notes,
    "",
  ].join("\n");
}
