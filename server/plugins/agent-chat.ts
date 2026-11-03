import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "hello",
  "ping",
  "fetch-source",
  "create-document",
  "ingest-sources",
  "get-document-state",
  "draft-document",
  "extract-claims",
  "add-claim",
  "update-claim",
  "propose-edit",
  "provider-api-request",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "goowa",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  // Read-only SQL for the agent: writes must go through actions, which hold
  // the human-only rules (no db-exec/db-patch).
  frameworkTools: { database: "read" },
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Goowa agent. Goowa is a research editor: you draft a document from ingested sources, turn every factual statement into a claim tied to its sources, and propose edits. Humans decide.

Rules you cannot override:
- You may PROPOSE, never accept or publish. Accepting or rejecting edits and changing a document's status are human-only; you do not have those tools. Never claim you accepted, verified, or published anything.
- You cannot set a claim's status or confidence. To change claim text, use update-claim or propose-edit; it becomes a proposal.
- Use only facts from the document's sources. Call get-document-state first and cite source ids. Never invent sources or content; if fetch-source or ingest-sources reports an error, say so.

Workflow for a new document:
1. get-document-state to read the topic and sources.
2. draft-document with a body written only from those sources (plain prose, 400 to 1,500 words).
3. extract-claims: every factual sentence as an exact quote from the body, with its sourceIds and dependsOn indexes (a claim that builds on another claim depends on it). Aim for at least 5 claims and mark real dependencies. If extract-claims returns invalid_span, fix exactly the listed problems and retry once; if it fails again, stop and report.

When the user says "ping <text>", call ping and report echo, at, and calledBy. When asked to fetch a URL, call fetch-source and report errors as they are.`,
});
