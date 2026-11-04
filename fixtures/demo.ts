// Demo fixture: a stablecoin explainer built only from official or
// reputable sources. All four URLs were checked to fetch cleanly with
// fetch-source on 2026-11-03.
export const demo = {
  title: "Stablecoins, explained",
  topic:
    "What stablecoins are, how fiat-backed stablecoins like USDC hold their value, how they move between primary and secondary markets, and how regulators in the EU and central banks view them.",
  sources: [
    "https://developers.circle.com/stablecoins/what-is-usdc",
    "https://www.federalreserve.gov/econres/notes/feds-notes/primary-and-secondary-markets-for-stablecoins-20240223.html",
    "https://www.bis.org/publ/arpdf/ar2025e3.htm",
    "https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica",
  ],
} as const;

/**
 * The verification fixture (one claim per verdict, including an injected
 * source this app hosts) lives in ./verify-fixture.ts with expected verdicts
 * in ./expected.json. Run it with `pnpm verify:fixture`.
 */
export {
  CLAIMS as verifyClaims,
  SOURCES as verifySources,
} from "./verify-fixture.js";
