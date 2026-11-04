import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { canonicalize, receiptHashOf, sha256Hex } from "../shared/canonical";

describe("canonicalize", () => {
  it("sorts keys at every depth and keeps array order", () => {
    expect(canonicalize({ b: 1, a: { d: [3, 1], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[3,1]},"b":1}',
    );
  });

  it("is identical for objects built in different key orders", () => {
    expect(canonicalize({ x: 1, y: { p: true, q: null } })).toBe(
      canonicalize({ y: { q: null, p: true }, x: 1 }),
    );
  });

  it("drops undefined members and rejects non-finite numbers", () => {
    expect(canonicalize({ a: undefined, b: 2 })).toBe('{"b":2}');
    expect(() => canonicalize({ n: Number.NaN })).toThrow(TypeError);
  });

  it("escapes strings exactly as JSON does, including non-ASCII", () => {
    expect(canonicalize({ s: 'Le règlement "MiCA"\n' })).toBe(
      '{"s":"Le règlement \\"MiCA\\"\\n"}',
    );
  });
});
