import { describe, expect, it } from "vitest";

import {
  applyEdit,
  remapSpans,
  type Span,
  type TextEdit,
} from "../shared/spans";

const BODY = "USDC is a stablecoin. It is backed by cash. Circle issues it.";

function spanOf(id: string, text: string, body = BODY): Span {
  const start = body.indexOf(text);
  if (start < 0) throw new Error(`"${text}" not in body`);
  return { id, start, end: start + text.length, text };
}

function editOf(find: string, replacement: string, body = BODY): TextEdit {
  const start = body.indexOf(find);
  return { start, end: start + find.length, text: replacement };
}

function check(
  body: string,
  spans: { start: number; end: number; text: string }[],
) {
  for (const s of spans) expect(body.slice(s.start, s.end)).toBe(s.text);
}

describe("applyEdit", () => {
  it("replaces the given range", () => {
    expect(applyEdit("abcdef", { start: 2, end: 4, text: "XYZ" })).toBe(
      "abXYZef",
    );
  });

  it("rejects ranges outside the body", () => {
    expect(() => applyEdit("abc", { start: 2, end: 9, text: "" })).toThrow(
      RangeError,
    );
    expect(() => applyEdit("abc", { start: 2, end: 1, text: "" })).toThrow(
      RangeError,
    );
  });
});

describe("remapSpans", () => {
  it("leaves spans before the edit unchanged", () => {
    const a = spanOf("a", "USDC is a stablecoin.");
    const { body, spans } = remapSpans(
      BODY,
      [a],
      editOf("Circle", "Circle Internet Financial"),
    );
    expect(spans[0]).toMatchObject({
      start: a.start,
      end: a.end,
      outcome: "unchanged",
    });
    check(body, spans);
  });

  it("shifts spans after the edit by the length change", () => {
    const c = spanOf("c", "Circle issues it.");
    const { body, spans } = remapSpans(
      BODY,
      [c],
      editOf("cash", "cash and short-term Treasuries"),
    );
    expect(spans[0]!.outcome).toBe("shifted");
    expect(spans[0]!.start).toBe(c.start + "and short-term Treasuries ".length);
    check(body, spans);
  });

  it("shifts spans left when text before them is deleted", () => {
    const c = spanOf("c", "Circle issues it.");
    const { body, spans } = remapSpans(
      BODY,
      [c],
      editOf(" It is backed by cash.", ""),
    );
    expect(spans[0]).toMatchObject({
      outcome: "shifted",
      text: "Circle issues it.",
    });
    check(body, spans);
  });
});
