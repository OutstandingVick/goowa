import { ActorBadge } from "@/components/goowa/ActorBadge";

import type { Receipt } from "../../../shared/receipt";

/** The condensed activity feed recorded in the receipt. */
export function ReceiptHistory({ receipt }: { receipt: Receipt }) {
  if (receipt.history.length === 0) return null;
  return (
    <section aria-label="History" className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">History</h2>
      <ol className="grid gap-1.5">
        {[...receipt.history].reverse().map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="min-w-0 flex-1">{h.summary}</span>
            <ActorBadge actor={h.actor} verb="" className="shrink-0" />
            <time
              className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
              dateTime={h.at}
            >
              {new Date(h.at).toLocaleDateString()}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
