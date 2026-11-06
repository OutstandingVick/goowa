import { useAgentChatGenerating } from "@agent-native/core/client/agent-chat";
import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconFileText,
  IconLink,
  IconListCheck,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { domainOf, type Source, errorText } from "@/lib/goowa";

function Shell({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function NoSources({ documentId }: { documentId: string }) {
  const [urls, setUrls] = useState("");
  const ingest = useActionMutation("ingest-sources");
  const list = urls
    .split(/\s+/)
    .map((u) => u.trim())
    .filter(Boolean);
  return (
    <Shell icon={<IconLink className="size-5" />} title="Add sources first">
      <p className="text-sm text-muted-foreground">
        The agent drafts only from sources you ingest. Paste up to 10 URLs, one
        per line.
      </p>
      <form
        className="grid w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (list.length)
            ingest.mutate({ documentId, urls: list.slice(0, 10) });
        }}
      >
        <textarea
          rows={4}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="https://…"
          aria-label="Source URLs"
          className="w-full rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {ingest.error && (
          <p className="text-sm text-destructive">{errorText(ingest.error)}</p>
        )}
        <Button type="submit" disabled={!list.length || ingest.isPending}>
          {ingest.isPending ? (
            <IconLoader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {ingest.isPending
            ? "Fetching sources…"
            : `Ingest ${list.length || ""} sources`}
        </Button>
      </form>
    </Shell>
  );
}

export function NeedsDraft({
  documentId,
  sources,
}: {
  documentId: string;
  sources: Source[];
}) {
  const [generating, send] = useAgentChatGenerating();
  const usable = sources.filter((s) => !s.flags.includes("fetch_failed"));
  const failed = sources.filter((s) => s.flags.includes("fetch_failed"));
  return (
    <Shell
      icon={
        generating ? (
          <IconLoader2 className="size-5 animate-spin" />
        ) : (
          <IconFileText className="size-5" />
        )
      }
      title={generating ? "The agent is drafting…" : "Ready to draft"}
    >
      <p className="text-sm text-muted-foreground">
        {usable.length} {usable.length === 1 ? "source" : "sources"} ingested.
        The agent writes the draft using only these, then turns every factual
        sentence into a claim.
      </p>
      <ul className="w-full text-left text-sm">
        {sources.map((s) => (
          <li key={s.id} className="truncate py-0.5">
            <span className={s.flags.length ? "text-destructive" : ""}>
              {s.flags.length ? "✕ " : "✓ "}
            </span>
            {s.title || s.url}{" "}
            <span className="text-muted-foreground">· {domainOf(s.url)}</span>
          </li>
        ))}
      </ul>
      {failed.length > 0 && (
        <p className="text-xs text-destructive">
          {failed.length} {failed.length === 1 ? "source" : "sources"} could not
          be fetched and will be skipped.
        </p>
      )}
      <Button
        disabled={generating || usable.length === 0}
        onClick={() =>
          send({
            message: "Draft this document and extract its claims.",
            context: `Goowa document ${documentId}: call get-document-state, then draft-document from its sources only, then extract-claims.`,
            submit: true,
          })
        }
      >
        <IconSparkles className="size-4" aria-hidden />
        Ask agent to draft
      </Button>
    </Shell>
  );
}

export function NeedsClaims({ documentId }: { documentId: string }) {
  const [generating, send] = useAgentChatGenerating();
  return (
    <Shell
      icon={
        generating ? (
          <IconLoader2 className="size-5 animate-spin" />
        ) : (
          <IconListCheck className="size-5" />
        )
      }
      title={generating ? "Extracting claims…" : "No claims yet"}
    >
      <p className="text-sm text-muted-foreground">
        {generating
          ? "The agent is turning factual sentences into claims tied to sources."
          : "The draft is saved, but its claims have not been extracted, or the last attempt failed."}
      </p>
      <Button
        variant="outline"
        disabled={generating}
        onClick={() =>
          send({
            message: "Extract the claims in this document.",
            context: `Goowa document ${documentId}: call get-document-state, then extract-claims for its body.`,
            submit: true,
          })
        }
      >
        <IconSparkles className="size-4" aria-hidden />
        {generating ? "Working…" : "Ask agent to extract claims"}
      </Button>
    </Shell>
  );
}
