import {
  IconExternalLink,
  IconSparkles,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import { StatusBadge } from "@/components/goowa/StatusBadge";
import { highlightMatches } from "@/components/goowa/VerdictPanel";
import {
  STATUS_LABEL,
  VERDICT_LABEL,
  asStatus,
  domainOf,
  type Verdict,
} from "@/lib/goowa";

import type { Receipt } from "../../../shared/receipt";

type Claim = Receipt["claims"][number];

export function EvidenceCard({
  claim,
  receipt,
  onClose,
}: {
  claim: Claim;
  receipt: Receipt;
  onClose: () => void;
}) {
  const status = asStatus(claim.status);
  const sources = new Map(receipt.sources.map((s) => [s.id, s]));
  const verdict = claim.verdict?.value as Verdict | undefined;
  return (
    <article
      data-status={status}
      className="rounded-xl border bg-card p-4 shadow-sm"
      aria-label={`Evidence for claim ${claim.index}`}
    >
      <header className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          #{claim.index}
        </span>
        <StatusBadge status={status} />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <IconX className="size-4" />
        </button>
      </header>
      <p className="font-serif text-base leading-relaxed">{claim.text}</p>

      {verdict && (
        <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <p className="font-medium">
            {claim.human
              ? `Agent said ${VERDICT_LABEL[verdict]} · Human confirmed ${STATUS_LABEL[asStatus(claim.human.status)]}`
              : `Verdict: ${VERDICT_LABEL[verdict]}`}
          </p>
          {claim.verdict?.reason && (
            <p className="mt-1 text-muted-foreground">{claim.verdict.reason}</p>
          )}
          {claim.human?.note && (
            <p className="mt-1">
              <span className="text-muted-foreground">Human note:</span>{" "}
              {claim.human.note}
            </p>
          )}
        </div>
      )}

      {claim.overrides.length > 0 && (
        <div
          data-status="weak"
          className="mt-3 rounded-md bg-[hsl(var(--tone-bg))] px-3 py-2 text-sm"
        >
          <p className="font-medium text-[hsl(var(--tone))]">
            Published with a human override
          </p>
          {claim.overrides.map((o, i) => (
            <p key={i} className="mt-1 text-foreground/80">
              {o.reason}
            </p>
          ))}
        </div>
      )}

      <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Evidence
      </h3>
      {claim.evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No source passage supports this claim.
        </p>
      ) : (
        <ul className="grid gap-2">
          {claim.evidence.map((ev, i) => {
            const src = sources.get(ev.sourceId);
            const Who = ev.verifiedBy === "agent" ? IconSparkles : IconUser;
            return (
              <li key={i} className="rounded-md border p-2">
                <blockquote className="font-serif text-base leading-relaxed">
                  {highlightMatches(ev.snippet, claim.text)}
                </blockquote>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 hover:underline"
                  >
                    <span className="truncate">
                      {src?.title || domainOf(ev.sourceUrl)}
                    </span>
                    <IconExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                  <span className="tabular-nums">
                    chars {ev.startOffset}–{ev.endOffset}
                  </span>
                  {ev.verifiedAt && (
                    <span className="inline-flex items-center gap-1">
                      <Who className="size-3" aria-hidden />
                      verified by{" "}
                      {ev.verifiedBy === "agent" ? "agent" : "human"} ·{" "}
                      {new Date(ev.verifiedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
