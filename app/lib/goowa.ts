// Result types come from the generated action registry.
type ActionResult<K extends keyof AgentNativeActionRegistry> =
  AgentNativeActionRegistry[K]["result"];

export type DocumentState = ActionResult<"get-document-state">;
export type Claim = DocumentState["claims"][number];
export type Source = DocumentState["sources"][number];
export type Edit = DocumentState["pendingEdits"][number];

/** What a claim is shown as: human status, else machine verdict. */
export type ClaimStatus =
  | "supported"
  | "weak"
  | "unsupported"
  | "laundered"
  | "unverified"
  | "quarantined";

export const STATUS_ORDER: ClaimStatus[] = [
  "supported",
  "weak",
  "unsupported",
  "laundered",
  "unverified",
  "quarantined",
];

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  supported: "Supported",
  weak: "Weak",
  unsupported: "Unsupported",
  laundered: "Laundered",
  unverified: "Unverified",
  quarantined: "Quarantined",
};

export type Verdict =
  | "supported"
  | "weak"
  | "unsupported"
  | "laundered"
  | "unverifiable";

export const VERDICT_LABEL: Record<Verdict, string> = {
  supported: "Supported",
  weak: "Weak",
  unsupported: "Unsupported",
  laundered: "Laundered",
  unverifiable: "Unverifiable",
};

/** A human status is any status other than the default. */
export function humanStatus(claim: { status: string }): ClaimStatus | null {
  const s = asStatus(claim.status);
  return s === "unverified" ? null : s;
}

/**
 * The status the UI shows: a quarantine lock first (every cited source is
 * quarantined), then the human's status, then the agent's verdict.
 */
export function effectiveStatus(
  claim: { status: string; verdict?: string | null; sourceIds: string[] },
  sources: readonly { id: string; flags: string[] }[],
): ClaimStatus {
  const cited = sources.filter((s) => claim.sourceIds.includes(s.id));
  if (cited.length > 0 && cited.every((s) => s.flags.includes("quarantined"))) {
    return "quarantined";
  }
  const human = humanStatus(claim);
  if (human) return human;
  switch (claim.verdict) {
    case "supported":
    case "weak":
    case "unsupported":
    case "laundered":
      return claim.verdict;
    default:
      return "unverified";
  }
}

export function asStatus(value: string): ClaimStatus {
  return (STATUS_ORDER as string[]).includes(value)
    ? (value as ClaimStatus)
    : "unverified";
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function countByStatus(statuses: readonly ClaimStatus[]) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    ClaimStatus,
    number
  >;
  for (const s of statuses) counts[s] += 1;
  return counts;
}

/** Smooth scrolling unless the user asked for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
