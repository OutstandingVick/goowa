// Result types come from the generated action registry.
type ActionResult<K extends keyof AgentNativeActionRegistry> =
  AgentNativeActionRegistry[K]["result"];

export type DocumentState = ActionResult<"get-document-state">;
export type Claim = DocumentState["claims"][number];
export type Source = DocumentState["sources"][number];
export type Edit = DocumentState["pendingEdits"][number];

export type ClaimStatus =
  | "supported"
  | "weak"
  | "unsupported"
  | "unverified"
  | "quarantined";

export const STATUS_ORDER: ClaimStatus[] = [
  "supported",
  "weak",
  "unsupported",
  "unverified",
  "quarantined",
];

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  supported: "Supported",
  weak: "Weak",
  unsupported: "Unsupported",
  unverified: "Unverified",
  quarantined: "Quarantined",
};

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

export function countByStatus(claims: readonly { status: string }[]) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    ClaimStatus,
    number
  >;
  for (const c of claims) counts[asStatus(c.status)] += 1;
  return counts;
}

/** Smooth scrolling unless the user asked for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
