// Character-offset spans over a plain-text document body. Offsets are
// UTF-16 code units (JS string indices), half-open: [start, end).

export type Span = { id: string; start: number; end: number; text: string };

/** A single replacement of body[start, end) with `text`. */
export type TextEdit = { start: number; end: number; text: string };

export type SpanOutcome =
  | "unchanged" // entirely before the edit
  | "shifted" // entirely after the edit
  | "resized" // the edit sits inside the span
  | "reanchored" // partial overlap; old text found again
  | "lost"; // partial overlap; old text no longer in the body

export type RemappedSpan = Span & { outcome: SpanOutcome };

export function applyEdit(body: string, edit: TextEdit): string {
  assertEdit(body, edit);
  return body.slice(0, edit.start) + edit.text + body.slice(edit.end);
}

export function assertEdit(body: string, edit: TextEdit) {
  if (
    !Number.isInteger(edit.start) ||
    !Number.isInteger(edit.end) ||
    edit.start < 0 ||
    edit.end < edit.start ||
    edit.end > body.length
  ) {
    throw new RangeError(
      `Edit [${edit.start}, ${edit.end}) is outside a body of length ${body.length}.`,
    );
  }
}

/** Find the only occurrence of `needle`, or the one nearest `near`. */
export function locate(
  haystack: string,
  needle: string,
  near = 0,
): number | null {
  if (!needle) return null;
  let best: number | null = null;
  for (
    let i = haystack.indexOf(needle);
    i !== -1;
    i = haystack.indexOf(needle, i + 1)
  ) {
    if (best === null || Math.abs(i - near) < Math.abs(best - near)) best = i;
  }
  return best;
}

/**
 * Re-map spans after `edit` is applied to `oldBody`. Returns spans over the
 * new body; `text` is re-read from the new body for every surviving span.
 */
export function remapSpans(
  oldBody: string,
  spans: readonly Span[],
  edit: TextEdit,
): { body: string; spans: RemappedSpan[] } {
  const body = applyEdit(oldBody, edit);
  const delta = edit.text.length - (edit.end - edit.start);

  const remapped = spans.map((span): RemappedSpan => {
    // An insertion exactly at either boundary stays outside the span.
    if (span.end <= edit.start) {
      return { ...span, outcome: "unchanged" };
    }
    if (span.start >= edit.end) {
      const start = span.start + delta;
      const end = span.end + delta;
      return {
        ...span,
        start,
        end,
        text: body.slice(start, end),
        outcome: "shifted",
      };
    }
    if (span.start <= edit.start && edit.end <= span.end) {
      const end = span.end + delta;
      if (end > span.start) {
        return {
          ...span,
          end,
          text: body.slice(span.start, end),
          outcome: "resized",
        };
      }
    }
    const found = locate(body, span.text, span.start);
    if (found !== null) {
      return {
        ...span,
        start: found,
        end: found + span.text.length,
        outcome: "reanchored",
      };
    }
    const start = Math.min(span.start, body.length);
    const end = Math.min(Math.max(start, span.end + delta), body.length);
    return {
      ...span,
      start,
      end,
      text: body.slice(start, end),
      outcome: "lost",
    };
  });

  return { body, spans: remapped };
}
