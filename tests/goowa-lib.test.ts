import { describe, expect, it } from "vitest";

import { asStatus, countByStatus, domainOf } from "../app/lib/goowa";

describe("domainOf", () => {
  it("strips www and keeps the host", () => {
    expect(domainOf("https://www.federalreserve.gov/econres/x.html")).toBe(
      "federalreserve.gov",
    );
    expect(domainOf("https://developers.circle.com/a")).toBe(
      "developers.circle.com",
    );
  });
  it("falls back to the input for invalid URLs", () => {
    expect(domainOf("not a url")).toBe("not a url");
  });
});

describe("claim status helpers", () => {
  it("treats unknown status values as unverified", () => {
    expect(asStatus("supported")).toBe("supported");
    expect(asStatus("bogus")).toBe("unverified");
  });
  it("counts every status, including zeros", () => {
    expect(countByStatus(["supported", "weak", "supported"])).toEqual({
      supported: 2,
      weak: 1,
      unsupported: 0,
      laundered: 0,
      unverified: 0,
      quarantined: 0,
    });
  });
});
