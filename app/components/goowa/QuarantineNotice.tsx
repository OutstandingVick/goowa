import { IconChevronDown, IconShieldLock } from "@tabler/icons-react";
import { useState } from "react";

import type { Source } from "@/lib/goowa";
import { cn } from "@/lib/utils";

/**
 * Purple banner for a quarantined source. Findings are untrusted page text:
 * they render as plain React text nodes, never as HTML.
 */
export function QuarantineNotice({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  const findings = source.injectionFindings ?? [];
  return (
    <div
      data-status="quarantined"
      className="mt-1 rounded-md border border-[hsl(var(--tone)/0.4)] bg-[hsl(var(--tone-bg))] text-xs text-[hsl(var(--tone))]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconShieldLock className="size-3.5 shrink-0" aria-hidden />
        Quarantined: suspected prompt injection
        <span className="ml-auto inline-flex items-center gap-0.5 font-normal underline-offset-2 hover:underline">
          Why quarantined?
          <IconChevronDown
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>
      {open && (
        <ul className="grid gap-1.5 border-t border-[hsl(var(--tone)/0.25)] px-2 py-2 text-foreground">
          {findings.map((f, i) => (
            <li key={i}>
              <p className="font-medium text-[hsl(var(--tone))]">{f.reason}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words rounded bg-background/70 px-1.5 py-1 font-mono text-[11px] leading-snug">
                {f.snippet}
              </p>
            </li>
          ))}
          <li className="text-muted-foreground">
            This text is stripped from what the agent sees, and any remaining
            text reaches it fenced as untrusted data.
          </li>
        </ul>
      )}
    </div>
  );
}
