// Propagation fixture: one upstream figure, two claims that derive from it
// (a growth rate and a comparison), and one unrelated claim that must be left
// alone. Changing the upstream $160B to $200B must yield exactly two
// proposals with numbers computed in code: 25% → 56%, 2.5 → 3.1 times.

export const TITLE = "Stablecoin supply (propagation fixture)";
export const TOPIC =
  "Checks that one fix ripples to the claims derived from it.";

export const UPSTREAM =
  "Stablecoin supply reached $160 billion at the start of 2024.";
export const UPSTREAM_FIXED =
  "Stablecoin supply reached $200 billion at the start of 2024.";
export const GROWTH =
  "That was a 25% increase from $128 billion a year earlier.";
export const RATIO =
  "Total supply is about 2.5 times the $64 billion held in tokenised money market funds.";
export const UNRELATED = "Most stablecoins are pegged to the US dollar.";

export const EXPECTED = {
  growth: "That was a 56% increase from $128 billion a year earlier.",
  ratio:
    "Total supply is about 3.1 times the $64 billion held in tokenised money market funds.",
};

export const BODY = [
  "## Supply",
  "",
  `${UPSTREAM} ${GROWTH} ${RATIO}`,
  "",
  "## Pegs",
  "",
  `${UNRELATED} This explainer is a test fixture for Goowa.`,
].join("\n");

/** Claims in body order; dependsOn are indexes into this list. */
export const CLAIMS = [
  { quote: UPSTREAM, dependsOn: [] as number[] },
  { quote: GROWTH, dependsOn: [0] },
  { quote: RATIO, dependsOn: [0] },
  { quote: UNRELATED, dependsOn: [] as number[] },
];
