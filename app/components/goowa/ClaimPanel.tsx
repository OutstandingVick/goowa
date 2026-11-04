import { useEffect, useMemo, useRef, useState } from "react";

import {
  STATUS_LABEL,
  STATUS_ORDER,
  countByStatus,
  effectiveStatus,
  type Claim,
  type ClaimStatus,
  type Source,
} from "@/lib/goowa";
import { scrollBehavior } from "@/lib/goowa";
import { cn } from "@/lib/utils";

import { ClaimCard } from "./ClaimCard";
import { StatusIcon } from "./StatusBadge";

type Props = {
  claims: Claim[];
  sources: Source[];
  activeClaimId: string | null;
  hotClaimIds: string[];
  onSelect: (claimId: string) => void;
  onHoverClaims: (claimIds: string[]) => void;
};

export function ClaimPanel({
  claims,
  sources,
  activeClaimId,
  hotClaimIds,
  onSelect,
  onHoverClaims,
}: Props) {
  const [filter, setFilter] = useState<ClaimStatus | "all">("all");
  const cards = useRef(new Map<string, HTMLElement>());
  const statusOf = useMemo(
    () => new Map(claims.map((c) => [c.id, effectiveStatus(c, sources)])),
    [claims, sources],
  );
  const counts = useMemo(
    () => countByStatus([...statusOf.values()]),
    [statusOf],
  );
  const indexOf = useMemo(
    () => new Map(claims.map((c, i) => [c.id, i])),
    [claims],
  );
  const affectsOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of claims) {
      for (const parent of c.dependsOn) {
        map.set(parent, [...(map.get(parent) ?? []), c.id]);
      }
    }
    return map;
  }, [claims]);
  const labelOf = (id: string) => {
    const i = indexOf.get(id);
    return i === undefined ? "removed" : `#${i + 1}`;
  };
  const visible = useMemo(
    () =>
      filter === "all"
        ? claims
        : claims.filter((c) => statusOf.get(c.id) === filter),
    [claims, filter, statusOf],
  );

  // Selecting a claim elsewhere (e.g. its span) scrolls its card into view.
  // Runs when the active claim or filter changes (not every render), so it
  // never steals focus from an open editor.
  useEffect(() => {
    if (!activeClaimId) return;
    if (filter !== "all" && !visible.some((c) => c.id === activeClaimId)) {
      setFilter("all");
      return;
    }
    const el = cards.current.get(activeClaimId);
    el?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
    el?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClaimId, filter]);

  return (
    <section aria-label="Claims" className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 pb-3">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All {claims.length}
        </FilterChip>
        {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <FilterChip
            key={s}
            status={s}
            active={filter === s}
            onClick={() => setFilter(filter === s ? "all" : s)}
          >
            <StatusIcon status={s} className="size-3.5" />
            {STATUS_LABEL[s]} {counts[s]}
          </FilterChip>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {visible.map((claim) => (
          <ClaimCard
            key={claim.id}
            ref={(el) => {
              if (el) cards.current.set(claim.id, el);
              else cards.current.delete(claim.id);
            }}
            claim={claim}
            index={indexOf.get(claim.id) ?? 0}
            sources={sources}
            labelOf={labelOf}
            affects={affectsOf.get(claim.id) ?? []}
            active={claim.id === activeClaimId}
            hot={hotClaimIds.includes(claim.id)}
            onSelect={onSelect}
            onHoverClaims={onHoverClaims}
          />
        ))}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  status,
  onClick,
  children,
}: {
  active: boolean;
  status?: ClaimStatus;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-status={status}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-foreground/30 bg-accent font-medium",
      )}
    >
      {children}
    </button>
  );
}
