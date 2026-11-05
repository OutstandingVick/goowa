import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconExternalLink,
  IconRefresh,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  STATUS_LABEL,
  VERDICT_LABEL,
  domainOf,
  type Claim,
  type ClaimStatus,
  type Source,
  type Verdict,
} from "@/lib/goowa";
import { cn } from "@/lib/utils";

type Evidence = Claim["evidence"][number];

const STOP = new Set(
  "the a an and of to in for on by with is are was were it its that this as at be or from".split(
    " ",
  ),
);

/** Wrap words that also occur in the claim, so the match is visible. */
export function highlightMatches(snippet: string, claim: string): ReactNode[] {
  const words = new Set(
    claim
      .toLowerCase()
      .match(/[a-z0-9$%.]+/g)
      ?.map((w) => w.replace(/[.]+$/, ""))
      .filter((w) => w.length > 1 && !STOP.has(w)) ?? [],
  );
  return snippet.split(/(\s+)/).map((part, i) => {
    const key = part.toLowerCase().replace(/^[^a-z0-9$]+|[^a-z0-9%]+$/g, "");
    return key && words.has(key) ? (
      <mark
        key={i}
        className="rounded-sm bg-[hsl(var(--tone-bg))] px-0.5 text-foreground"
      >
        {part}
      </mark>
    ) : (
      part
    );
  });
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function sourceLabel(sources: Source[], id: string) {
  const s = sources.find((x) => x.id === id);
  return s
    ? { title: s.title || s.url, url: s.url, domain: domainOf(s.url) }
    : null;
}

export function VerdictPanel({
  claim,
  sources,
  human,
}: {
  claim: Claim;
  sources: Source[];
  human: ClaimStatus | null;
}) {
  const verify = useActionMutation("verify-claim");
  const [open, setOpen] = useState(false);
  const verdict = (claim.verdict ?? null) as Verdict | null;

  if (!verdict) {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Not verified yet.
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={verify.isPending}
          onClick={(e) => {
            e.stopPropagation();
            verify.mutate({ claimId: claim.id });
          }}
        >
          <IconRefresh
            className={cn("size-3.5", verify.isPending && "animate-spin")}
            aria-hidden
          />
          {verify.isPending ? "Verifying…" : "Verify"}
        </Button>
      </div>
    );
  }

  const laundered = verdict === "laundered";
  const closest = claim.closestPassage;
  const closestSource = closest ? sourceLabel(sources, closest.sourceId) : null;
  const pct = Math.round((claim.verdictConfidence ?? 0) * 100);
  const VerifierIcon = claim.verifiedBy === "agent" ? IconSparkles : IconUser;

  return (
    <div className="mt-3 grid gap-2" onClick={(e) => e.stopPropagation()}>
      {laundered && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-[hsl(var(--g-laundered-bg))] px-3 py-2 text-sm font-medium text-[hsl(var(--g-laundered))]"
        >
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Citation doesn't support this
        </div>
      )}

      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">
            {human ? (
              <>
                Agent said {VERDICT_LABEL[verdict]} · You confirmed{" "}
                {STATUS_LABEL[human]}
              </>
            ) : (
              <>Agent verdict: {VERDICT_LABEL[verdict]}</>
            )}
          </span>
          {pct > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {pct}% confidence
            </span>
          )}
        </p>
        <p className="mt-1 text-muted-foreground">{claim.verdictReason}</p>
        {claim.humanNote && (
          <p className="mt-1 text-foreground">
            <span className="text-muted-foreground">Your note:</span>{" "}
            {claim.humanNote}
          </p>
        )}
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <VerifierIcon className="size-3" aria-hidden />
          Verified by {claim.verifiedBy === "agent" ? "agent" : "you"}
          {claim.verifiedAt ? ` · ${timeAgo(claim.verifiedAt)}` : ""}
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent disabled:opacity-60"
            disabled={verify.isPending}
            onClick={() => verify.mutate({ claimId: claim.id })}
          >
            <IconRefresh
              className={cn("size-3", verify.isPending && "animate-spin")}
              aria-hidden
            />
            {verify.isPending ? "Verifying…" : "Re-verify"}
          </button>
        </p>
        {verify.error && (
          <p className="mt-1 text-xs text-destructive">
            {verify.error.message}
          </p>
        )}
      </div>

      {laundered && closest && (
        <div
          className="grid gap-2 sm:grid-cols-2"
          aria-label="Claim compared with the closest passage"
        >
          <figure className="rounded-md border p-2">
            <figcaption className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              The claim
            </figcaption>
            <p className="font-serif text-base leading-relaxed">{claim.text}</p>
          </figure>
          <figure className="rounded-md border border-dashed p-2">
            <figcaption className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Closest passage in {closestSource?.domain ?? "the source"}
            </figcaption>
            <p className="line-clamp-6 font-serif text-base leading-relaxed text-muted-foreground">
              {closest.snippet}
            </p>
          </figure>
        </div>
      )}

      {claim.evidence.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-medium hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconChevronDown
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
            Evidence ({claim.evidence.length})
          </button>
          {open && (
            <ul className="mt-1 grid gap-2">
              {claim.evidence.map((ev: Evidence, i: number) => {
                const src = sourceLabel(sources, ev.sourceId);
                return (
                  <li key={i} className="rounded-md border p-2">
                    <blockquote className="font-serif text-base leading-relaxed">
                      {highlightMatches(ev.snippet, claim.text)}
                    </blockquote>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {ev.matchType === "exact"
                          ? "Exact match"
                          : ev.matchType === "paraphrase"
                            ? "Paraphrase"
                            : "No match"}
                      </span>
                      <span className="tabular-nums">
                        chars {ev.startOffset}–{ev.endOffset}
                      </span>
                      {src && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {src.domain}
                          <IconExternalLink className="size-3" aria-hidden />
                        </a>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
