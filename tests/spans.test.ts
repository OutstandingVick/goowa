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

  it("resizes a span when the edit is inside it", () => {
    const b = spanOf("b", "It is backed by cash.");
    const { body, spans } = remapSpans(
      BODY,
      [b],
      editOf("cash", "cash reserves"),
    );
    expect(spans[0]).toMatchObject({
      outcome: "resized",
      text: "It is backed by cash reserves.",
    });
    check(body, spans);
  });

  it("treats replacing a whole span as a resize", () => {
    const b = spanOf("b", "It is backed by cash.");
    const { spans } = remapSpans(
      BODY,
      [b],
      editOf("It is backed by cash.", "It is fully reserved."),
    );
    expect(spans[0]).toMatchObject({
      outcome: "resized",
      text: "It is fully reserved.",
    });
  });

  it("keeps insertions at a span boundary outside the span", () => {
    const b = spanOf("b", "It is backed by cash.");
    const atStart = remapSpans(BODY, [b], {
      start: b.start,
      end: b.start,
      text: "Today, ",
    });
    expect(atStart.spans[0]).toMatchObject({
      outcome: "shifted",
      text: b.text,
    });
    const atEnd = remapSpans(BODY, [b], {
      start: b.end,
      end: b.end,
      text: " Mostly.",
    });
    expect(atEnd.spans[0]).toMatchObject({
      outcome: "unchanged",
      text: b.text,
    });
    check(atEnd.body, atEnd.spans);
  });

  it("re-anchors a partially overlapped span whose text survives", () => {
    const body = "Alpha beta. Gamma delta. Gamma delta.";
    const s = spanOf("s", "beta. Gamma", body);
    // Overlaps the span start, but the span text is reinserted elsewhere.
    const { body: next, spans } = remapSpans(body, [s], {
      start: 0,
      end: 8,
      text: "Zed beta. Gamma ",
    });
    expect(spans[0]!.outcome).toBe("reanchored");
    check(next, spans);
  });

  it("marks a span lost when an overlapping edit destroys its text", () => {
    const b = spanOf("b", "It is backed by cash.");
    const { body, spans } = remapSpans(
      BODY,
      [b],
      editOf("stablecoin. It is", "token, which is"),
    );
    expect(spans[0]!.outcome).toBe("lost");
    expect(spans[0]!.end).toBeGreaterThanOrEqual(spans[0]!.start);
    expect(spans[0]!.end).toBeLessThanOrEqual(body.length);
  });

  it("marks a span lost when the edit deletes it entirely", () => {
    const b = spanOf("b", "It is backed by cash.");
    const { spans } = remapSpans(
      BODY,
      [b],
      editOf("It is backed by cash. ", ""),
    );
    expect(spans[0]!.outcome).toBe("lost");
  });

  it("keeps every span valid across a sequence of edits", () => {
    let body = BODY;
    let spans: Span[] = [
      spanOf("a", "USDC is a stablecoin."),
      spanOf("b", "It is backed by cash."),
      spanOf("c", "Circle issues it."),
    ];
    const steps: [string, string][] = [
      ["USDC", "USD Coin (USDC)"],
      ["cash", "cash and Treasuries"],
      [" Circle", "\n\nCircle"],
      ["issues", "mints and redeems"],
    ];
    for (const [find, replacement] of steps) {
      const result = remapSpans(body, spans, editOf(find, replacement, body));
      body = result.body;
      spans = result.spans;
      check(body, spans);
    }
    expect(spans.map((s) => s.text)).toEqual([
      "USD Coin (USDC) is a stablecoin.",
      "It is backed by cash and Treasuries.",
      "Circle mints and redeems it.",
    ]);
  });

  it("handles non-ASCII text by JS string offsets", () => {
    const body =
      "Le règlement MiCA s’applique depuis 2024. L’euro numérique est distinct.";
    const s = spanOf("s", "L’euro numérique est distinct.", body);
    const { body: next, spans } = remapSpans(body, [s], {
      ...editOf("règlement", "règlement européen", body),
    });
    expect(spans[0]!.outcome).toBe("shifted");
    check(next, spans);
  });
});
