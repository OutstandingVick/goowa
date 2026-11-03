import { useActionQuery } from "@agent-native/core/client/hooks";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Goowa - Documents" }];
}

export default function DebugIndexRoute() {
  const { data, isLoading } = useActionQuery("list-documents", {});
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 p-6 text-sm">
      <h1 className="text-2xl font-semibold">Documents</h1>
      {isLoading && <p>Loading…</p>}
      <ul className="grid gap-1">
        {data?.documents.map((doc) => (
          <li key={doc.id}>
            <Link className="underline" to={`/debug/${doc.id}`}>
              {doc.title}
            </Link>{" "}
            · {doc.status} · {doc.updatedAt}
          </li>
        ))}
      </ul>
    </main>
  );
}
