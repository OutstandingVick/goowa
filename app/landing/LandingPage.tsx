import {
  IconBrandGithub,
  IconFileCheck,
  IconLock,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Link } from "react-router";
import type { LinksFunction } from "react-router";

import landingStylesheet from "../landing.css?url";

export const GITHUB_URL = "https://github.com/OutstandingVick/goowa";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap",
  },
  { rel: "stylesheet", href: landingStylesheet },
];

export function meta() {
  return [
    { title: "Goowa · Every claim, checked against its source" },
    {
      name: "description",
      content:
        "A research editor where an AI agent drafts, every factual claim is verified against its source, and only a human can publish.",
    },
    { property: "og:title", content: "Goowa · Every claim, checked." },
    {
      property: "og:description",
      content: "Claim-level verification for research drafted with AI.",
    },
    { property: "og:image", content: "/goowa-og.svg" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

function Eyebrow({ children }: { children: string }) {
  return <p className="l-eyebrow">+ {children}</p>;
}

function Cta({ dark = true }: { dark?: boolean }) {
  return (
    <div className="l-ctas">
      <Link className={dark ? "l-btn l-btn-dark" : "l-btn"} to="/app">
        Open Goowa →
      </Link>
      <a className="l-btn" href={GITHUB_URL} target="_blank" rel="noreferrer">
        View source
      </a>
    </div>
  );
}

/** A real-looking draft with each claim marked by its verdict. */
function Specimen() {
  return (
    <figure className="l-specimen" aria-label="A draft with verified claims">
      <div className="l-specimen-bar">
        <span>draft · stablecoins-2024.md</span>
        <span className="l-dot-live">verifying</span>
      </div>
      <p className="l-specimen-body">
        <mark className="v-ok">
          USDC is a digital dollar issued by Circle.
          <sup>1</sup>
        </mark>{" "}
        <mark className="v-ok">
          Over 99% of stablecoins are US dollar-denominated.
          <sup>2</sup>
        </mark>{" "}
        <mark className="v-bad">
          Stablecoins processed $27.6 trillion in 2024, more than Visa and
          Mastercard combined.
          <sup>3</sup>
        </mark>
      </p>
      <ol className="l-verdicts">
        <li>
          <b className="t-ok">1 · supported</b>
          <span>exact quote, developers.circle.com</span>
        </li>
        <li>
          <b className="t-ok">2 · supported</b>
          <span>paraphrase, bis.org annual report</span>
        </li>
        <li>
          <b className="t-bad">3 · laundered</b>
          <span>
            cited page never says this. The figure traces to a blog it
            copied.
          </span>
        </li>
      </ol>
      <div className="l-specimen-foot">
        <span>agent → publish</span>
        <span className="t-bad">blocked · human approval required</span>
      </div>
    </figure>
  );
}

const steps = [
  [
    "Ingest",
    "Sources are fetched and scanned. Pages carrying prompt injections are quarantined, never used as evidence.",
  ],
  [
    "Extract",
    "Every sentence with a figure, a date, or a name becomes a claim, tied to the sources it cites.",
  ],
  [
    "Verify",
    "Each claim is matched against the source text: exact quote, paraphrase, or numbers that disagree. Weak and laundered claims are flagged.",
  ],
  [
    "Decide",
    "The agent proposes fixes. You accept or reject them. Change one claim and everything depending on it is re-checked.",
  ],
] as const;

const permissions = [
  ["Draft and propose edits", true, true],
  ["Verify claims against sources", true, true],
  ["Accept or reject an edit", false, true],
  ["Set a final claim status", false, true],
  ["Override a blocker, with a reason", false, true],
  ["Publish", false, true],
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

export default function LandingPage() {
  return (
    <div className="l-page">
      <main id="top">
        <section className="l-hero">
          <div className="l-hero-glow" aria-hidden="true" />
          <header className="l-nav">
            <a href="#top" className="l-brand">
              <span className="l-brand-mark" aria-hidden="true" />
              Goowa
            </a>
            <nav aria-label="Sections">
              <a href="#how">How it works</a>
              <a href="#receipt">Receipt</a>
              <a href="#mcp">MCP</a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </nav>
            <div className="l-nav-ctas">
              <a
                className="l-hbtn l-hbtn-light"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                Source
              </a>
              <Link className="l-hbtn l-hbtn-gold" to="/app">
                Open Goowa
              </Link>
            </div>
          </header>

          <div className="l-hero-copy">
            <h1>
              AI drafts the research.
              <br />
              You approve every claim.
            </h1>
            <p className="l-lead">
              Goowa ties each factual sentence to the passage that supports
              it, flags citations that never said it, and publishes only when
              a human says so.
            </p>
            <div className="l-hero-ctas">
              <Link className="l-hbtn l-hbtn-light" to="/app">
                Try the live demo
              </Link>
              <a className="l-hbtn l-hbtn-glass" href="#how">
                See how it works
              </a>
            </div>
          </div>

          <div className="l-tiles" aria-hidden="true">
            <span className="l-tile l-tile-a">
              <IconBrandGithub />
            </span>
            <span className="l-tile l-tile-b">
              <IconShieldCheck />
            </span>
            <span className="l-tile l-tile-c">
              <IconFileCheck />
            </span>
            <span className="l-tile l-tile-d">
              <IconLock />
            </span>
            <span className="l-chip">
              <b>Claim 3 · laundered</b>
              <span>Cited page never says it</span>
            </span>
            <div className="l-float-card">
              <Specimen />
            </div>
          </div>
        </section>

        <section className="l-band">
          <p>
            AI writes fluent research with confident citations.{" "}
            <em>Some of those citations never said it.</em>
          </p>
        </section>

        <section id="how" className="l-section">
          <Eyebrow>How it works</Eyebrow>
          <h2>Draft. Check. Decide.</h2>
          <ol className="l-steps">
            {steps.map(([title, body], i) => (
              <li key={title}>
                <span className="l-step-n">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="l-section l-split">
          <div>
            <Eyebrow>Permissions</Eyebrow>
            <h2>The agent proposes. You publish.</h2>
            <p className="l-body">
              Enforced on the server, not in a prompt. Every refused attempt is
              logged in the activity feed and counted on the receipt. External
              agents connecting over MCP get the same rules.
            </p>
          </div>
          <table className="l-table">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Agent</th>
                <th scope="col">Human</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map(([label, agent, human]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className={agent ? "t-ok" : "t-bad"}>
                    {agent ? "yes" : "blocked"}
                  </td>
                  <td className={human ? "t-ok" : "t-bad"}>
                    {human ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="receipt" className="l-section l-split">
          <div>
            <Eyebrow>Claim receipt</Eyebrow>
            <h2>Proof that travels with the article.</h2>
            <ul className="l-list">
              <li>
                <b>Tamper-evident.</b> A canonical SHA-256 hash covers the
                body, every claim and every evidence span.
              </li>
              <li>
                <b>Checkable by anyone.</b> Paste a receipt into the verifier;
                a single edited character is pinpointed.
              </li>
              <li>
                <b>Live re-check.</b> Re-fetch the sources later and see which
                claims they still support.
              </li>
            </ul>
          </div>
          <pre className="l-code" aria-label="Example receipt JSON">
            <div className="l-code-bar">
              <i />
              <i />
              <i />
              <span>receipt.json</span>
            </div>
            <code>{receiptJson}</code>
          </pre>
        </section>

        <section id="mcp" className="l-section l-split">
          <div>
            <Eyebrow>MCP</Eyebrow>
            <h2>Check a draft from any agent.</h2>
            <p className="l-body">
              Connect Claude, Cursor or any MCP client and call{" "}
              <code>check-draft</code> on text written anywhere. You get counts
              by verdict, the blockers, and an editor link for the human
              decision. Tokens are per user and revocable.
            </p>
          </div>
          <pre className="l-code" aria-label="Command to add Goowa to Claude Code">
            <div className="l-code-bar">
              <i />
              <i />
              <i />
              <span>terminal</span>
            </div>
            <code>
              <span className="t-ok">$ </span>
              {mcpCmd}
            </code>
          </pre>
        </section>

        <section className="l-closing">
          <h2>Drafts are cheap. Proof isn&rsquo;t.</h2>
          <Cta />
        </section>
      </main>

      <footer className="l-footer">
        <span>Goowa · Builder.io Agent-Native Hackathon 2026</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
