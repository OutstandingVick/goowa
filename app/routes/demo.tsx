import { useActionMutation } from "@agent-native/core/client/hooks";
import { IconLoader2 } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";

import { errorText } from "@/lib/goowa";

export function meta() {
  return [
    { title: "Loading demo · Goowa" },
    { name: "robots", content: "noindex" },
  ];
}

/** Hidden demo route: reset the demo document, then open it in the editor. */
export default function DemoRoute() {
  const reset = useActionMutation("reset-demo");
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    reset.mutate(
      { origin: window.location.origin },
      {
        onSuccess: (result) =>
          navigate(`/docs/${(result as { documentId: string }).documentId}`, {
            replace: true,
          }),
      },
    );
  }, [navigate, reset]);

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      {reset.error ? (
        <>
          <h1 className="text-base font-semibold">Could not load the demo</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {errorText(reset.error)}
          </p>
          <Link to="/docs" className="text-sm underline underline-offset-4">
            Back to documents
          </Link>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" aria-hidden />
          Resetting the demo document…
        </p>
      )}
    </main>
  );
}
