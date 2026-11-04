import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileText,
  IconLoader2,
} from "@tabler/icons-react";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";

import { EvidenceCard } from "@/components/receipt/EvidenceCard";
import { LivePanel } from "@/components/receipt/LivePanel";
import { ReceiptArticle } from "@/components/receipt/ReceiptArticle";
import { VerifyPanel } from "@/components/receipt/VerifyPanel";
import { Button } from "@/components/ui/button";

import type { Receipt } from "../../shared/receipt";
import { receiptToMarkdown } from "../../shared/receipt-markdown";

export function meta() {
  return [
    { title: "Claim Receipt · Goowa" },
    {
      name: "description",
      content: "A published article with proof for every claim.",
    },
  ];
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReceiptRoute() {
  const { documentId = "" } = useParams();
  const [params] = useSearchParams();
  const { data, isLoading, error } = useActionQuery(
    "get-receipt",
    { documentId },
    { enabled: Boolean(documentId) },
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
        <IconLoader2 className="size-4 animate-spin" aria-hidden />
        Loading receipt…
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-2 px-5 text-center">
        <h1 className="text-base font-semibold">No receipt here</h1>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "This document has not been published."}
        </p>
      </main>
    );
  }

  const receipt = data as Receipt;
  const supported = receipt.summary.byStatus.supported ?? 0;
  const claim = receipt.claims.find((c) => c.id === selected) ?? null;
  const slug = receipt.document.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <div className="min-h-dvh bg-[hsl(var(--g-paper))]">
      <header className="border-b bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Claim Receipt · Goowa
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {receipt.document.title}
            </h1>
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            {receipt.summary.claims} claims · {supported} supported ·{" "}
            {receipt.summary.overrides} override
            {receipt.summary.overrides === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(receipt.receiptHash);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs hover:bg-accent"
              title={`receiptHash ${receipt.receiptHash}`}
            >
              {copied ? (
                <IconCheck className="size-3.5" aria-hidden />
              ) : (
                <IconCopy className="size-3.5" aria-hidden />
              )}
              {receipt.receiptHash.slice(0, 12)}…
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  `${slug}-receipt-r${receipt.document.revision}.json`,
                  JSON.stringify(receipt, null, 2),
                  "application/json",
                )
              }
            >
              <IconDownload className="size-4" aria-hidden />
              JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  `${slug}.md`,
                  receiptToMarkdown(receipt),
                  "text/markdown",
                )
              }
            >
              <IconFileText className="size-4" aria-hidden />
              Markdown
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:px-6 md:py-10">
        <main className="min-w-0">
          <p className="mb-6 text-sm text-muted-foreground">
            Revision {receipt.document.revision}, published{" "}
            {new Date(receipt.document.publishedAt).toLocaleString()} by a
            human. Select a highlighted claim to see its evidence.
          </p>
          <ReceiptArticle
            receipt={receipt}
            selected={selected}
            onSelect={setSelected}
          />
        </main>
        <aside className="grid min-w-0 content-start gap-4">
          {claim ? (
            <EvidenceCard
              claim={claim}
              receipt={receipt}
              onClose={() => setSelected(null)}
            />
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Select a highlighted claim to see the source passage that supports
              it, who verified it, and any human decision.
            </p>
          )}
          <VerifyPanel
            receipt={receipt}
            tamper={params.get("tamper") === "1"}
          />
          <LivePanel documentId={documentId} onSelect={setSelected} />
          {params.get("demo") === "1" && <FixtureSwitcher />}
          <SourcesList receipt={receipt} />
        </aside>
      </div>
    </div>
  );
}

function SourcesList({ receipt }: { receipt: Receipt }) {
  return (
    <section aria-label="Sources" className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">Sources</h2>
      <ul className="grid gap-1.5 text-sm">
        {receipt.sources.map((s) => (
          <li key={s.id} className="min-w-0">
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate hover:underline"
            >
              {s.title || s.url}
            </a>
            <p className="font-mono text-[11px] text-muted-foreground">
              {s.excluded ? "Quarantined: excluded from evidence · " : ""}sha256{" "}
              {s.contentHash.slice(0, 12)}…
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Demo tooling (?demo=1, signed in): switch the hosted live-source page. */
function FixtureSwitcher() {
  const set = useActionMutation("set-live-fixture-version");
  return (
    <section className="rounded-xl border border-dashed p-4 text-sm">
      <p className="mb-2 font-medium">Demo: live source page version</p>
      <div className="flex gap-2">
        {(["a", "b", "c"] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={set.variables?.version === v ? "default" : "outline"}
            onClick={() => set.mutate({ version: v })}
          >
            {v.toUpperCase()}
          </Button>
        ))}
      </div>
      {set.error && (
        <p className="mt-2 text-xs text-destructive">{set.error.message}</p>
      )}
    </section>
  );
}
