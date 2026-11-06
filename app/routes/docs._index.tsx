import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { IconFileText, IconLoader2, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText } from "@/lib/goowa";

export function meta() {
  return [{ title: "Goowa - Documents" }];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
};

export default function DocumentsRoute() {
  const navigate = useNavigate();
  const { data, isLoading } = useActionQuery("list-documents", {});
  const create = useActionMutation("create-document");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-10 px-5 py-10 md:py-14">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Research drafts where every factual claim is tied to a source and
          checked by a human.
        </p>
      </header>

      <form
        className="grid gap-3 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { title, topic },
            { onSuccess: (doc) => navigate(`/docs/${doc.id}`) },
          );
        }}
      >
        <h2 className="text-sm font-medium">New document</h2>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title, e.g. Stablecoins, explained"
          aria-label="Title"
          required
        />
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What should it explain?"
          aria-label="Topic"
          required
        />
        {create.error && (
          <p className="text-sm text-destructive">{errorText(create.error)}</p>
        )}
        <Button
          type="submit"
          className="justify-self-end"
          disabled={create.isPending || !title.trim() || !topic.trim()}
        >
          {create.isPending ? (
            <IconLoader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <IconPlus className="size-4" aria-hidden />
          )}
          Create
        </Button>
      </form>

      <aside className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed px-4 py-3 text-sm">
        <span className="font-medium">Use Goowa from Claude or Cursor</span>
        <span className="text-muted-foreground">
          Check drafts and receipts over MCP with a personal token you can
          revoke any time. Agents can verify and propose; only you can accept or
          publish.
        </span>
        <a
          href="/mcp/connect"
          className="font-medium underline underline-offset-2"
        >
          Connect
        </a>
      </aside>

      <section aria-label="Your documents">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.documents.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No documents yet. Create one above.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  to={`/docs/${doc.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60 focus:outline-none focus-visible:bg-accent"
                >
                  <IconFileText
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {doc.title}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {STATUS_LABEL[doc.status] ?? doc.status}
                  </span>
                  <time className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
