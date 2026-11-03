// Map a DOM selection inside the document view back to body offsets, using
// the data-start/data-end attributes DocumentView puts on every text element.

function offsetAt(
  root: Element,
  node: Node,
  offset: number,
  edge: "start" | "end",
): number | null {
  const el =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  if (!el || !root.contains(el)) return null;

  // Inside proposed (inserted) text: snap to where that text is anchored.
  const ignored = el.closest("[data-ignore]");
  if (ignored) return Number(ignored.getAttribute("data-anchor"));

  const holder = el.closest("[data-start]");
  if (holder && node.nodeType === Node.TEXT_NODE) {
    return Number(holder.getAttribute("data-start")) + offset;
  }

  // Element boundary (e.g. the start of a paragraph): use the nearest child.
  const children = Array.from(el.childNodes);
  const child = children[Math.min(offset, children.length - 1)];
  const before = offset >= children.length;
  const target =
    child instanceof Element ? child : (child?.parentElement ?? el);
  const marks = target.matches("[data-start]")
    ? [target]
    : Array.from(target.querySelectorAll("[data-start]"));
  const pick = before || edge === "end" ? marks[marks.length - 1] : marks[0];
  if (!pick) return null;
  return Number(pick.getAttribute(before ? "data-end" : "data-start"));
}

export type BodySelection = { start: number; end: number; text: string };

export function selectionOffsets(
  root: Element,
  body: string,
): BodySelection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const a = offsetAt(root, range.startContainer, range.startOffset, "start");
  const b = offsetAt(root, range.endContainer, range.endOffset, "end");
  if (a === null || b === null) return null;
  const start = Math.max(0, Math.min(a, b));
  const end = Math.min(body.length, Math.max(a, b));
  if (end <= start) return null;
  const text = body.slice(start, end);
  if (!text.trim()) return null;
  return { start, end, text };
}
