// The demo document: one wrong figure that ripples to two derived claims, a
// laundered citation, a quarantined source, and claims that check out.
// `pnpm demo:reset` (or the hidden /demo route) restores it.

export const DEMO_TITLE = "Stablecoin supply, checked";
export const DEMO_TOPIC =
  "How large stablecoin supply is, what it is pegged to, and how much it is used.";

/** Wrong on purpose: the source says $160 billion. The demo fixes it. */
export const SUPPLY_WRONG =
  "Stablecoin supply reached $200 billion at the start of 2024.";
export const SUPPLY_FIXED =
  "Stablecoin supply reached $160 billion at the start of 2024.";
/** Derived from the supply figure; the fix should recompute both. */
export const GROWTH_WRONG =
  "That was a 56% increase from $128 billion a year earlier.";
export const GROWTH_FIXED =
  "That was a 25% increase from $128 billion a year earlier.";
export const RATIO_WRONG =
  "Total supply is about 3.1 times the $64 billion held in tokenised money market funds.";
export const RATIO_FIXED =
  "Total supply is about 2.5 times the $64 billion held in tokenised money market funds.";
export const DOLLAR =
  "Over 99% of stablecoins are US dollar-denominated, with a growing cross-border presence.";
/** Cites a regulation page that never says this: a laundered citation. */
export const VOLUME =
  "Stablecoins processed $27.6 trillion in transfers in 2024, more than Visa and Mastercard combined.";
/** The selection the demo corrects, and the agent's replacement claim. */
export const VOLUME_SELECTION = "more than Visa and Mastercard combined";
export const VOLUME_FIXED =
  "Stablecoins processed large transfer volumes in 2024, according to industry estimates.";
/** Only backed by a page carrying a prompt injection. */
export const RESERVES =
  "Every major stablecoin is fully backed by audited cash reserves.";

export type DemoSourceKey = "live" | "bis" | "esma" | "injected";

export function demoSources(origin: string): Record<DemoSourceKey, string> {
  return {
    live: `${origin.replace(/\/+$/, "")}/fixtures/live-source`,
    bis: "https://www.bis.org/publ/arpdf/ar2025e3.htm",
    esma: "https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica",
    injected: "https://goowa.vercel.app/fixtures/injected-source.html",
  };
}

export const DEMO_BODY = [
  "## Supply",
  "",
  `${SUPPLY_WRONG} ${GROWTH_WRONG} ${RATIO_WRONG}`,
  "",
  "## The dollar's reach",
  "",
  DOLLAR,
  "",
  "## Usage and reserves",
  "",
  `${VOLUME} ${RESERVES}`,
].join("\n");

/** Claims in body order; dependsOn are indexes into this list. */
export const DEMO_CLAIMS: {
  quote: string;
  sources: DemoSourceKey[];
  dependsOn: number[];
}[] = [
  { quote: SUPPLY_WRONG, sources: ["live"], dependsOn: [] },
  { quote: GROWTH_WRONG, sources: ["live"], dependsOn: [0] },
  { quote: RATIO_WRONG, sources: ["live"], dependsOn: [0] },
  { quote: DOLLAR, sources: ["bis"], dependsOn: [] },
  { quote: VOLUME, sources: ["esma"], dependsOn: [] },
  { quote: RESERVES, sources: ["injected"], dependsOn: [] },
];
