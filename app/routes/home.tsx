import { Navigate } from "react-router";

import { APP_TITLE } from "@/lib/app-config";

const SEO_TITLE = `${APP_TITLE} - Research drafts with verified claims`;
const SEO_DESCRIPTION =
  "An AI agent drafts from your sources, every factual claim is tied to a source, and humans decide what is accepted and published.";

// Chat routes reuse this meta.
export function meta() {
  return [
    { title: SEO_TITLE },
    { name: "description", content: SEO_DESCRIPTION },
    { property: "og:title", content: SEO_TITLE },
    { property: "og:description", content: SEO_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
  ];
}

// The template's Get started page is replaced by the documents list.
export default function HomeRoute() {
  return <Navigate to="/docs" replace />;
}
