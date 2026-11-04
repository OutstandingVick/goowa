import { describe, expect, it } from "vitest";

import { timeAgo } from "../app/components/goowa/VerdictPanel";

describe("timeAgo", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  it.each([
    ["2026-11-04T11:59:30Z", "just now"],
    ["2026-11-04T11:58:00Z", "2m ago"],
    ["2026-11-04T09:00:00Z", "3h ago"],
    ["2026-11-02T12:00:00Z", "2d ago"],
  ])("%s → %s", (iso, label) => {
    expect(timeAgo(iso, now)).toBe(label);
  });
});
