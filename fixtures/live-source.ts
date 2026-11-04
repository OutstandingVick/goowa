// A hosted test source whose content can be switched, for demonstrating the
// receipt's live re-check. Same URL, three versions:
//   a: the original
//   b: an unrelated sentence changed (claims still supported)
//   c: the supply figure changed (the supply claim is no longer supported)

export const LIVE_FIXTURE_PATH = "/fixtures/live-source";
export const LIVE_VERSIONS = ["a", "b", "c"] as const;
export type LiveVersion = (typeof LIVE_VERSIONS)[number];
export const LIVE_SETTING = "goowa-live-fixture-version";

export const LIVE_CLAIM =
  "Stablecoin supply reached $160 billion at the start of 2024.";

export function liveFixtureHtml(version: LiveVersion): string {
  const supply = version === "c" ? "$150 billion" : "$160 billion";
  const outlook =
    version === "a"
      ? "Analysts expect issuance to keep growing as more payment firms adopt dollar tokens."
      : "Analysts disagree on whether issuance will keep growing at the same pace next year.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stablecoin Supply Tracker (Goowa test fixture)</title>
  <style>body{font:18px/1.7 Georgia,serif;max-width:42rem;margin:3rem auto;padding:0 1rem;color:#222}</style>
</head>
<body>
  <article>
    <h1>Stablecoin Supply Tracker</h1>
    <p>This page is a Goowa test fixture used to demonstrate re-checking a published receipt against a live source.</p>
    <p>Stablecoin supply reached ${supply} at the start of 2024. Most of that supply is denominated in US dollars.</p>
    <p>${outlook}</p>
  </article>
</body>
</html>`;
}
