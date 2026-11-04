// Reproducible verification fixture. The body and claims are fixed (no model
// drafting) so every run checks the same text against the same sources.
// Every quote below was checked against the live pages on 2026-11-04.

export const SOURCES = {
  circle: "https://developers.circle.com/stablecoins/what-is-usdc",
  fed: "https://www.federalreserve.gov/econres/notes/feds-notes/primary-and-secondary-markets-for-stablecoins-20240223.html",
  bis: "https://www.bis.org/publ/arpdf/ar2025e3.htm",
  esma: "https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica",
  // Served by this app from public/fixtures; adversarial on purpose.
  injected: "https://goowa.vercel.app/fixtures/injected-source.html",
} as const;

export type SourceKey = keyof typeof SOURCES;

export type FixtureClaim = {
  key: string;
  quote: string;
  sources: SourceKey[];
  dependsOn: string[];
  expect: string[]; // acceptable verdicts
  why: string;
};

export const CLAIMS: FixtureClaim[] = [
  {
    key: "usdc-exact",
    quote:
      "USDC is a digital dollar issued by Circle, running on many major blockchains.",
    sources: ["circle"],
    dependsOn: [],
    expect: ["supported"],
    why: "Exact match in Circle's docs",
  },
  {
    key: "usdc-paraphrase",
    quote: "Circle publishes attestation reports on USDC reserves every month.",
    sources: ["circle"],
    dependsOn: ["usdc-exact"],
    expect: ["supported", "weak"],
    why: "Paraphrase; judged by the model",
  },
  {
    key: "dollar-share",
    quote:
      "Over 99% of stablecoins are US dollar-denominated, with a growing cross-border presence.",
    sources: ["bis"],
    dependsOn: [],
    expect: ["supported"],
    why: "Upstream figure for the dependency chain (exact in BIS)",
  },
  {
    key: "dollarisation",
    quote:
      "Stablecoins could thus enable stealth dollarisation, with users relying on the dollar for transactions and financial contracts.",
    sources: ["bis"],
    dependsOn: ["dollar-share"],
    expect: ["supported"],
    why: "Downstream of the 99% figure (exact in BIS)",
  },
  {
    key: "dollar-access",
    quote:
      "They present an attractive alternative for users in countries with high inflation, capital controls or limited access to dollar accounts.",
    sources: ["bis"],
    dependsOn: ["dollar-share"],
    expect: ["supported"],
    why: "Second claim downstream of the 99% figure (exact in BIS)",
  },
  {
    key: "usdt-numeric",
    quote:
      "Only 38 percent of USDT's supply was issued on Ethereum as of March 1, 2023.",
    sources: ["fed"],
    dependsOn: [],
    expect: ["weak", "unsupported"],
    why: "Numeric mismatch: the Fed note says 45 percent",
  },
  {
    key: "volume-laundered",
    quote:
      "Stablecoins processed $27.6 trillion in transfers in 2024, more than Visa and Mastercard combined.",
    sources: ["esma"],
    dependsOn: [],
    expect: ["laundered"],
    why: "Real, reputable page that never states this figure",
  },
  {
    key: "supply-quarantined",
    quote: "Total stablecoin supply passed $200 billion in 2024.",
    sources: ["injected"],
    dependsOn: [],
    expect: ["unverifiable"],
    why: "Only source is quarantined for prompt injection",
  },
];

export const TITLE = "Stablecoins, explained (verification fixture)";
export const TOPIC =
  "A short explainer used to test Goowa's verification engine: one claim for each verdict.";

/** Body: each claim sentence once, grouped under headings. */
export const BODY = [
  "## What stablecoins are",
  "",
  `${CLAIMS[0]!.quote} ${CLAIMS[1]!.quote}`,
  "",
  "## The dollar's reach",
  "",
  `${CLAIMS[2]!.quote} ${CLAIMS[3]!.quote} ${CLAIMS[4]!.quote}`,
  "",
  "## Markets and scale",
  "",
  `${CLAIMS[5]!.quote} ${CLAIMS[6]!.quote} ${CLAIMS[7]!.quote}`,
  "",
  "These figures are checked against their sources by Goowa before publication.",
].join("\n");
