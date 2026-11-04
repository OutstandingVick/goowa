import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconShieldCheck,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

import type { Receipt } from "../../../shared/receipt";

/** Demo only: change one evidence snippet before verifying (?tamper=1). */
function tamperedCopy(receipt: Receipt): Receipt {
  const copy = JSON.parse(JSON.stringify(receipt)) as Receipt;
  const ev = copy.claims.flatMap((c) => c.evidence)[0];
  if (ev)
    ev.snippet = ev.snippet.replace(/\d/, (d) => String((Number(d) + 1) % 10));
  else copy.document.body = `${copy.document.body} `;
  return copy;
}

export function VerifyPanel({
  receipt,
  tamper,
}: {
  receipt: Receipt;
  tamper: boolean;
}) {
  const verify = useActionMutation("verify-receipt");
  const result = verify.data;
  return (
    <section
      aria-label="Verify this receipt"
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Verify this receipt</h2>
        {tamper && (
          <span className="rounded bg-[hsl(var(--g-unsupported-bg))] px-1.5 py-0.5 text-[11px] font-medium text-[hsl(var(--g-unsupported))]">
            Demo: one snippet altered before verifying
          </span>
        )}
        <Button
          size="sm"
          className="ml-auto"
          disabled={verify.isPending}
          onClick={() =>
            verify.mutate({
              receiptJson: tamper ? tamperedCopy(receipt) : receipt,
            })
          }
        >
          {verify.isPending ? (
            <IconLoader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <IconShieldCheck className="size-4" aria-hidden />
          )}
          Verify
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Recomputes the receipt and body hashes and finds every evidence snippet
        in the source text frozen at publish.
      </p>
      {verify.error && (
        <p className="mt-2 text-sm text-destructive">{verify.error.message}</p>
      )}
      {result && (
        <>
          <p
            data-status={result.ok ? "supported" : "unsupported"}
            className="mt-3 flex items-center gap-2 rounded-md bg-[hsl(var(--tone-bg))] px-3 py-2 text-sm font-medium text-[hsl(var(--tone))]"
            role="status"
          >
            {result.ok ? (
              <IconCircleCheck className="size-4" aria-hidden />
            ) : (
              <IconCircleX className="size-4" aria-hidden />
            )}
            {result.ok
              ? `All ${result.checks.length} checks intact`
              : `${result.checks.filter((c) => c.result === "tampered").length} of ${result.checks.length} checks tampered`}
          </p>
          <ul className="mt-2 grid gap-1">
            {result.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                {c.result === "intact" ? (
                  <IconCircleCheck
                    data-status="supported"
                    className="mt-0.5 size-4 shrink-0 text-[hsl(var(--tone))]"
                    aria-label="Intact"
                  />
                ) : (
                  <IconCircleX
                    data-status="unsupported"
                    className="mt-0.5 size-4 shrink-0 text-[hsl(var(--tone))]"
                    aria-label="Tampered"
                  />
                )}
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground"> · {c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
