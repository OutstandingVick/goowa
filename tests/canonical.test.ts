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

describe("hashes", () => {
  it("sha256Hex matches Node's crypto over UTF-8", async () => {
    const text = "Total stablecoin supply passed $200 billion — règlement";
    expect(await sha256Hex(text)).toBe(
      createHash("sha256").update(text, "utf8").digest("hex"),
    );
  });

  it("receiptHashOf ignores the receiptHash field and key order", async () => {
    const a = await receiptHashOf({
      document: { id: "d", revision: 1 },
      claims: [],
    });
    const b = await receiptHashOf({
      claims: [],
      receiptHash: "anything",
      document: { revision: 1, id: "d" },
    });
    expect(a).toBe(b);
    expect(
      await receiptHashOf({ document: { id: "d", revision: 2 }, claims: [] }),
    ).not.toBe(a);
  });
});

describe("canonicalize arrays", () => {
  it("serialises undefined array elements as null, like JSON", () => {
    expect(canonicalize([1, undefined, { b: 2, a: 1 }])).toBe(
      '[1,null,{"a":1,"b":2}]',
    );
    expect(canonicalize([1, undefined])).toBe(JSON.stringify([1, undefined]));
  });
});
