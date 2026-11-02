import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function meta() {
  return [{ title: "Goowa - Phase 0 spike" }];
}

export default function SpikeRoute() {
  const [text, setText] = useState("hello");
  const ping = useActionMutation("ping");
  const [urlDraft, setUrlDraft] = useState("https://en.wikipedia.org/wiki/Fact-checking");
  const [url, setUrl] = useState("");
  const source = useActionQuery(
    "fetch-source",
    { url },
    { enabled: Boolean(url), retry: false },
  );

  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 p-6">
      <h1 className="text-2xl font-semibold">Phase 0 spike</h1>

      <section className="grid gap-3">
        <Label htmlFor="ping-text">Ping text</Label>
        <div className="flex gap-2">
          <Input
            id="ping-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button
            onClick={() => ping.mutate({ text })}
            disabled={ping.isPending}
          >
            Ping
          </Button>
        </div>
        {ping.error && (
          <p className="text-sm text-destructive">{ping.error.message}</p>
        )}
        {ping.data && (
          <pre className="rounded-lg border bg-muted p-3 text-sm">
            {JSON.stringify(ping.data, null, 2)}
          </pre>
        )}
      </section>

      <section className="grid gap-3">
        <Label htmlFor="source-url">Source URL</Label>
        <div className="flex gap-2">
          <Input
            id="source-url"
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
          />
          <Button
            onClick={() => setUrl(urlDraft)}
            disabled={source.isFetching}
          >
            Fetch
          </Button>
        </div>
        {source.error && (
          <p className="text-sm text-destructive">{source.error.message}</p>
        )}
        {source.data && (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted p-3 text-sm">
            {JSON.stringify(source.data, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
