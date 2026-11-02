import { beforeEach, describe, expect, it, vi } from "vitest";

const ssrfSafeFetch = vi.fn();
vi.mock("@agent-native/core/extensions/url-safety", () => ({ ssrfSafeFetch }));

const { default: fetchSource } = await import("../actions/fetch-source");

function run(url: string) {
  return fetchSource.run({ url }, undefined) as Promise<any>;
}

beforeEach(() => {
  ssrfSafeFetch.mockReset();
});

describe("fetch-source errors", () => {
  it("rejects a malformed URL without fetching", async () => {
    const result = await run("not a url");
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_url" } });
    expect(ssrfSafeFetch).not.toHaveBeenCalled();
  });

  it("rejects non-http schemes", async () => {
    const result = await run("ftp://example.com/file");
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_url" } });
  });


  it("maps SSRF rejections to blocked_host", async () => {
    ssrfSafeFetch.mockRejectedValue(new Error("SSRF blocked: private address"));
    const result = await run("http://internal.example");
    expect(result).toMatchObject({ ok: false, error: { code: "blocked_host" } });
  });

});
