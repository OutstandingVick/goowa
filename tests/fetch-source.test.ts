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


  it("maps an aborted request to timeout", async () => {
    const err = new Error("timed out");
    err.name = "TimeoutError";
    ssrfSafeFetch.mockRejectedValue(err);
    const result = await run("https://slow.example");
    expect(result).toMatchObject({ ok: false, error: { code: "timeout" } });
  });


  it("returns http_status with the status code for 4xx/5xx", async () => {
    ssrfSafeFetch.mockResolvedValue(new Response("gone", { status: 404, statusText: "Not Found" }));
    const result = await run("https://example.com/missing");
    expect(result).toMatchObject({ ok: false, error: { code: "http_status", status: 404 } });
  });


  it("rejects non-HTML responses", async () => {
    ssrfSafeFetch.mockResolvedValue(
      new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    const result = await run("https://example.com/data.json");
    expect(result).toMatchObject({ ok: false, error: { code: "not_html" } });
  });

});
