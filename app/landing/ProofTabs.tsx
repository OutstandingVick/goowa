import { useEffect, useState } from "react";

const permissions = [
  ["Draft and propose edits", true],
  ["Verify claims against sources", true],
  ["Accept or reject an edit", false],
  ["Set a final claim status", false],
  ["Override a blocker, with a reason", false],
  ["Publish", false],
] as const;

const receiptJson = `{
  "document": { "title": "Stablecoins 2024", "revision": 1,
                "publishedBy": "human" },
  "claims": [{
    "index": 1, "status": "supported",
    "evidence": [{
      "snippet": "USDC is a digital dollar issued by Circle",
      "startOffset": 412, "endOffset": 455,
      "sourceContentHash": "901d7b2a85a0…"
    }]
  }],
  "summary": { "claims": 3, "agentPublishAttemptsBlocked": 1 },
  "receiptHash": "e21ffc82d7e4…"
}`;

const mcpCmd = `claude mcp add --transport http goowa \\
  https://goowa.vercel.app/mcp \\
  --header "Authorization: Bearer <token>"`;

const tabs = [
  {
    id: "permissions",
    label: "Permissions",
    lead: "Enforced on the server, not in a prompt. Every refused attempt is logged and counted on the receipt.",
  },
  {
    id: "receipt",
    label: "Receipt",
    lead: "Publishing freezes a tamper-evident receipt. Anyone can verify it, and re-check it against live sources.",
  },
  {
    id: "mcp",
    label: "MCP",
    lead: "Connect Claude, Cursor or any MCP client and check drafts written anywhere. Same rules, revocable tokens.",
  },
] as const;

type TabId = (typeof tabs)[number]["id"];

function CodeWindow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <pre className="l-code pt-code">
      <div className="l-code-bar">
        <i />
        <i />
        <i />
        <span>{name}</span>
      </div>
      <code>{children}</code>
    </pre>
  );
}

function Panel({ tab }: { tab: TabId }) {
  if (tab === "permissions") {
    return (
      <div className="pt-grid">
        <table className="pt-table">
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">Agent</th>
              <th scope="col">Human</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map(([label, agent]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className={agent ? "t-ok" : "t-bad"}>
                  {agent ? "yes" : "blocked"}
                </td>
                <td className="t-ok">yes</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pt-feed">
          <p className="pt-feed-title">Activity</p>
          <ul>
            <li>
              <b className="t-bad">Agent attempted to publish · blocked</b>
              <span>via MCP · 2 min ago</span>
            </li>
            <li>
              <b className="t-bad">Agent attempted to accept an edit · blocked</b>
              <span>via MCP · 3 min ago</span>
            </li>
            <li>
              <b>Edit proposed: claim 3 rewritten</b>
              <span>agent · 5 min ago</span>
            </li>
            <li>
              <b className="t-ok">Published revision 1 by you</b>
              <span>human · just now</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }
  if (tab === "receipt") {
    return (
      <div className="pt-grid">
        <CodeWindow name="receipt.json">{receiptJson}</CodeWindow>
        <ul className="pt-points">
          <li>
            <b>Tamper-evident.</b> A canonical SHA-256 hash covers the body,
            every claim and every evidence span.
          </li>
          <li>
            <b>Checkable by anyone.</b> Paste a receipt into the verifier; a
            single edited character is pinpointed.
          </li>
          <li>
            <b>Live re-check.</b> Re-fetch the sources later and see which
            claims they still support.
          </li>
        </ul>
      </div>
    );
  }
  return (
    <div className="pt-grid">
      <CodeWindow name="terminal">
        <span className="t-ok">$ </span>
        {mcpCmd}
      </CodeWindow>
      <ul className="pt-points">
        <li>
          <b>check-draft.</b> Send text and source URLs; get counts by
          verdict, the blockers, and an editor link.
        </li>
        <li>
          <b>Same rules.</b> External agents can propose and verify, never
          accept or publish.
        </li>
        <li>
          <b>Revocable.</b> Tokens are per user and stop working the moment
          you revoke them.
        </li>
      </ul>
    </div>
  );
}

export function ProofTabs() {
  const [tab, setTab] = useState<TabId>("permissions");

  // Nav links (#receipt, #mcp) open the matching tab.
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setTab(id as TabId);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const current = tabs.find((t) => t.id === tab)!;
  return (
    <section id="proof" className="pt">
      <span id="receipt" className="pt-anchor" />
      <span id="mcp" className="pt-anchor" />
      <h2 className="pt-title">Rules you can see. Proof you can check.</h2>
      <div className="pt-tabs" role="tablist" aria-label="Goowa guarantees">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`pt-tab-${t.id}`}
            aria-selected={t.id === tab}
            aria-controls="pt-panel"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="pt-lead">{current.lead}</p>
      <div
        id="pt-panel"
        role="tabpanel"
        aria-labelledby={`pt-tab-${tab}`}
        className="pt-frame"
      >
        <div className="pt-inner" key={tab}>
          <Panel tab={tab} />
        </div>
      </div>
    </section>
  );
}
