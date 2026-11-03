import { useActionMutation } from "@agent-native/core/client/hooks";
import { IconExternalLink, IconLink, IconPencil } from "@tabler/icons-react";
import { forwardRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  STATUS_LABEL,
  asStatus,
  domainOf,
  type Claim,
  type ClaimStatus,
  type Source,
} from "@/lib/goowa";
import { cn } from "@/lib/utils";

import { ActorBadge } from "./ActorBadge";
import { StatusBadge, StatusIcon } from "./StatusBadge";

const HUMAN_STATUSES: ClaimStatus[] = ["supported", "weak", "unsupported"];

type Props = {
  claim: Claim;
  index: number;
  sources: Source[];
  labelOf: (claimId: string) => string;
  active: boolean;
  hot: boolean;
  onSelect: (claimId: string) => void;
  onHoverClaims: (claimIds: string[]) => void;
};

export const ClaimCard = forwardRef<HTMLElement, Props>(function ClaimCard(
  { claim, index, sources, labelOf, active, hot, onSelect, onHoverClaims },
  ref,
) {
  const status = asStatus(claim.status);
  const update = useActionMutation("update-claim");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(claim.text);
  const [draftSources, setDraftSources] = useState<string[]>(claim.sourceIds);
  const cited = sources.filter((s) => claim.sourceIds.includes(s.id));

  function startEditing() {
    setDraft(claim.text);
    setDraftSources(claim.sourceIds);
    setEditing(true);
  }

  function save() {
    update.mutate(
      {
        claimId: claim.id,
        ...(draft.trim() && draft !== claim.text ? { text: draft } : {}),
        sourceIds: draftSources,
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <article
      ref={ref}
      data-status={status}
      data-claim-card={claim.id}
      tabIndex={0}
      onClick={() => onSelect(claim.id)}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onSelect(claim.id);
        }
      }}
      aria-label={`Claim ${index + 1}, ${STATUS_LABEL[status]}`}
      className={cn(
        "group relative cursor-pointer rounded-lg border bg-card p-4 outline-none transition-[border-color,box-shadow] duration-150",
        "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full before:bg-[hsl(var(--tone))]",
        active &&
          "border-[hsl(var(--tone))] shadow-[0_0_0_3px_hsl(var(--tone)/0.15)]",
        hot && !active && "border-[hsl(var(--tone)/0.6)]",
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          #{index + 1}
        </span>
        <StatusBadge status={status} />
        {claim.spanEnd <= claim.spanStart && (
          <span
            className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            title="An accepted edit removed this claim's text from the document."
          >
            Not in text
          </span>
        )}
        <ConfidenceBar value={claim.confidence} />
      </header>

      {editing ? (
        <div className="grid gap-3" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            aria-label="Claim text"
            className="w-full resize-y rounded-md border bg-background p-2 font-serif text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">
              Sources
            </legend>
            {sources.map((s) => (
              <label key={s.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draftSources.includes(s.id)}
                  onChange={(e) =>
                    setDraftSources((prev) =>
                      e.target.checked
                        ? [...prev, s.id]
                        : prev.filter((id) => id !== s.id),
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="line-clamp-1">{s.title || s.url}</span>
                  <span className="text-xs text-muted-foreground">
                    {domainOf(s.url)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {update.error && (
            <p className="text-sm text-destructive">{update.error.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-serif text-[15px] leading-relaxed">{claim.text}</p>

          {cited.length > 0 ? (
            <ul className="mt-3 grid gap-1">
              {cited.map((s) => (
                <li
                  key={s.id}
                  className="flex min-w-0 items-center gap-1.5 text-xs"
                >
                  <IconLink
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 truncate hover:underline"
                  >
                    {s.title || s.url}
                  </a>
                  <span className="shrink-0 text-muted-foreground">
                    · {domainOf(s.url)}
                  </span>
                  <IconExternalLink
                    aria-hidden
                    className="size-3 shrink-0 text-muted-foreground"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No sources cited.
            </p>
          )}

          {claim.dependsOn.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Depends on</span>
              {claim.dependsOn.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="rounded-full border px-2 py-0.5 text-xs tabular-nums hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(id);
                  }}
                  onMouseEnter={() => onHoverClaims([id])}
                  onMouseLeave={() => onHoverClaims([])}
                  onFocus={() => onHoverClaims([id])}
                  onBlur={() => onHoverClaims([])}
                >
                  {labelOf(id)}
                </button>
              ))}
            </div>
          )}

          <footer className="mt-3 flex flex-wrap items-center gap-1.5">
            <ActorBadge actor={claim.createdBy} verb="Created" />
            {claim.updatedBy !== claim.createdBy && (
              <ActorBadge actor={claim.updatedBy} verb="Updated" />
            )}
          </footer>

          <div
            className={cn(
              "mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3",
              !active && "hidden group-hover:flex group-focus-within:flex",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mr-1 text-xs text-muted-foreground">Mark</span>
            {HUMAN_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                data-status={s}
                aria-pressed={status === s}
                disabled={update.isPending}
                onClick={() => update.mutate({ claimId: claim.id, status: s })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-[hsl(var(--tone-bg))] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  status === s &&
                    "border-[hsl(var(--tone))] bg-[hsl(var(--tone-bg))]",
                )}
              >
                <StatusIcon status={s} className="size-3.5" />
                {STATUS_LABEL[s]}
              </button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 px-2 text-xs"
              onClick={startEditing}
            >
              <IconPencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          </div>
          {update.error && !editing && (
            <p className="mt-2 text-xs text-destructive">
              {update.error.message}
            </p>
          )}
        </>
      )}
    </article>
  );
});

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  // 0 means no verification has scored the claim yet (Phase 3 fills it in).
  if (pct === 0) {
    return (
      <span className="ml-auto text-[11px] text-muted-foreground">
        Not scored
      </span>
    );
  }
  return (
    <span
      className="ml-auto flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground"
      title={`Confidence ${pct}%`}
    >
      <span
        className="relative h-1.5 w-14 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--tone))] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      {pct}%
    </span>
  );
}
