import { locate } from "./spans.js";

type EditLike = {
  id: string;
  targetType: string;
  targetId: string;
  spanStart: number | null;
  before: string;
};
type ClaimLike = {
  id: string;
  spanStart: number;
  spanEnd: number;
  text: string;
};

/**
 * Where each pending edit sits in the current body, for drawing it as a
 * tracked change. Mirrors how decide-edit resolves the range; an edit whose
 * text is gone (stale) gets no range and is shown only in the drawer.
 */
export function proposalRanges(
  body: string,
  edits: readonly EditLike[],
  claims: readonly ClaimLike[],
): { id: string; start: number; end: number }[] {
  const ranges: { id: string; start: number; end: number }[] = [];
  for (const edit of edits) {
    if (edit.targetType === "claim") {
      const claim = claims.find((c) => c.id === edit.targetId);
      if (claim && claim.text === edit.before) {
        ranges.push({
          id: edit.id,
          start: claim.spanStart,
          end: claim.spanEnd,
        });
      }
      continue;
    }
    const start = locate(body, edit.before, edit.spanStart ?? 0);
    if (start !== null) {
      ranges.push({ id: edit.id, start, end: start + edit.before.length });
    }
  }
  return ranges;
}
