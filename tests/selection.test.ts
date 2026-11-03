// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { selectionOffsets } from "../app/lib/selection";

const BODY = "## Title\n\nUSDC is backed by cash. Circle issues it.";

function render() {
  // Mirrors DocumentView: heading marker not rendered, every text element
  // carries absolute body offsets, inserted proposal text is data-ignore.
  const root = document.createElement("div");
  root.innerHTML =
    `<h2><span data-start="3" data-end="8">Title</span></h2>` +
    `<p><span class="g-claim" data-start="10" data-end="33">USDC is backed by cash.</span>` +
    `<span data-start="33" data-end="34"> </span>` +
    `<del><span data-start="34" data-end="40">Circle</span></del>` +
    `<ins data-ignore data-anchor="40">Circle Internet</ins>` +
    `<span data-start="40" data-end="51"> issues it.</span></p>`;
  document.body.replaceChildren(root);
  return root;
}

function select(
  startNode: Node,
  startOffset: number,
  endNode: Node,
  endOffset: number,
) {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

const text = (root: Element, sel: string) =>
  root.querySelector(sel)!.firstChild!;

describe("selectionOffsets", () => {
  it("maps a selection inside one claim to body offsets", () => {
    const root = render();
    const claim = text(root, ".g-claim");
    select(claim, 0, claim, 4);
    expect(selectionOffsets(root, BODY)).toEqual({
      start: 10,
      end: 14,
      text: "USDC",
    });
  });

  it("maps a selection across segments", () => {
    const root = render();
    select(text(root, ".g-claim"), 18, text(root, '[data-start="40"]'), 7);
    const sel = selectionOffsets(root, BODY)!;
    expect(sel.text).toBe("cash. Circle issues");
    expect(BODY.slice(sel.start, sel.end)).toBe(sel.text);
  });

  it("snaps endpoints in proposed text to its anchor", () => {
    const root = render();
    select(text(root, "ins"), 3, text(root, '[data-start="40"]'), 7);
    expect(selectionOffsets(root, BODY)!.start).toBe(40);
  });

  it("ignores collapsed or whitespace-only selections", () => {
    const root = render();
    const claim = text(root, ".g-claim");
    select(claim, 2, claim, 2);
    expect(selectionOffsets(root, BODY)).toBeNull();
    select(
      text(root, '[data-start="33"]'),
      0,
      text(root, '[data-start="33"]'),
      1,
    );
    expect(selectionOffsets(root, BODY)).toBeNull();
  });
});
