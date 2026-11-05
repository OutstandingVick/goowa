import {
  IconArrowRight,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconCode,
  IconExternalLink,
  IconFileCheck,
  IconGitBranch,
  IconLinkOff,
  IconLock,
  IconPlayerPlay,
  IconShieldLock,
  IconSparkles,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { LinksFunction } from "react-router";

import landingStylesheet from "../landing.css?url";

export const DEMO_VIDEO_URL = "#demo-video";
export const GITHUB_URL = "https://github.com/OutstandingVick/goowa";
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: landingStylesheet },
];
export function meta() {
  return [
    { title: "Goowa — AI drafts. Goowa checks every claim." },
    {
      name: "description",
      content:
        "A research editor that verifies every factual claim, catches citation laundering, and publishes tamper-evident proof.",
    },
    {
      property: "og:title",
      content: "Goowa — AI drafts. Goowa checks every claim.",
    },
    {
      property: "og:description",
      content: "Claim-level verification for research drafted with AI.",
    },
    { property: "og:image", content: "/goowa-og.svg" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

function Wordmark() {
  return (
    <span className="wordmark" aria-label="Goowa">
      <span className="wordmark-mark" aria-hidden="true">
        <span />
      </span>
      <span>Goowa</span>
    </span>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}
const consoleLines = [
  ["goowa> ingest 4 sources", "command"],
  ["✓ 3 fetched · ⚠ 1 quarantined", "warn"],
  ["goowa> extract claims", "command"],
  ["✓ 12 claims", "success"],
  ["goowa> verify", "command"],
  ["✓ 9 supported · ⚠ 1 weak", "success"],
  ["✕ 1 laundered · ✕ 1 unsupported", "danger"],
  ["agent> publish", "command"],
  ["✕ blocked: human approval required", "danger"],
  ["you> approve", "command"],
  ["✓ published · receipt 0x9f3a…c21", "gold"],
] as const;
function AgentConsole() {
  return (
    <div
      className="console-shell"
      aria-label="Example of Goowa checking a draft"
    >
      <div className="console-bar">
        <span className="console-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span>verification.run</span>
        <span className="console-live">
          <i /> LIVE
        </span>
      </div>
      <div className="console-body">
        {consoleLines.map(([text, tone], index) => (
          <div
            className={`console-line ${tone}`}
            style={{ "--line": index } as React.CSSProperties}
            key={text}
          >
            {text}
          </div>
        ))}
      </div>
      <div className="console-summary">
        <span>
          <IconCircleCheck aria-hidden /> 9 supported
        </span>
        <span>
          <IconShieldLock aria-hidden /> 1 quarantined
        </span>
        <span>
          <IconLock aria-hidden /> publish gated
        </span>
      </div>
    </div>
  );
}
function Navigation() {
  return (
    <header className="landing-nav">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="nav-inner" aria-label="Main navigation">
        <a href="#top" className="nav-brand">
          <Wordmark />
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#receipt">Receipt</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
        <div className="nav-actions">
          <Link className="button button-primary button-small" to="/app">
            Open Goowa <IconArrowRight aria-hidden />
          </Link>
        </div>
      </nav>
    </header>
  );
}

function ProblemSection() {
  return (
    <section className="section problem-section" id="problem">
      <div className="section-heading split-heading">
        <div>
          <Eyebrow>THE PROBLEM</Eyebrow>
          <h2>A citation link isn’t evidence.</h2>
        </div>
        <p>
          AI can attach a real source to a claim the source never made. The link
          works. The sentence sounds certain. The evidence still isn’t there.
        </p>
      </div>
      <div className="comparison-grid">
        <article className="draft-card typical-draft">
          <div className="card-label">
            <span>Typical AI draft</span>
            <span className="status-quiet">Looks cited</span>
          </div>
          <h3>Remote work and productivity</h3>
          <p>
            Recent research shows that remote work increases productivity by{" "}
            <mark>45%</mark>, while improving employee retention across
            knowledge-work teams.<sup>[1]</sup>
          </p>
          <div className="fake-source">
            <IconExternalLink aria-hidden /> workplace-study.org/remote-work
          </div>
        </article>
        <article className="draft-card goowa-draft">
          <div className="card-label">
            <span>Same draft in Goowa</span>
            <span className="status-supported">
              <IconCheck aria-hidden /> Checked
            </span>
          </div>
          <h3>Remote work and productivity</h3>
          <p>
            Recent research shows that remote work increases productivity by{" "}
            <span className="claim-bad" tabIndex={0}>
              45%
              <span className="claim-tooltip" role="tooltip">
                Cited page doesn’t contain this figure
              </span>
            </span>
            , while{" "}
            <span className="claim-good">improving employee retention</span>{" "}
            across knowledge-work teams.<sup>[1]</sup>
          </p>
          <div className="verification-row">
            <span className="status-laundered">
              <IconLinkOff aria-hidden /> Laundered citation
            </span>
            <span>Closest source figure: 38%</span>
          </div>
        </article>
      </div>
      <div className="pain-grid">
        <div>
          <span>01</span>
          <h3>Confident and wrong</h3>
          <p>Fluent prose can hide a claim that no source supports.</p>
        </div>
        <div>
          <span>02</span>
          <h3>Walls of text you can’t steer</h3>
          <p>
            Corrections get lost when claims and dependencies stay invisible.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>Agents that publish as you</h3>
          <p>
            Automation crosses a line when review and approval are optional.
          </p>
        </div>
      </div>
    </section>
  );
}

const steps = [
  [
    "01",
    "Ingest & draft",
    "Bring your sources. Goowa fetches them, quarantines injected instructions, and gives the agent only safe material.",
    IconShieldLock,
  ],
  [
    "02",
    "Every claim becomes a card",
    "Each factual statement is checked against the exact passage it cites—not merely whether a link exists.",
    IconFileCheck,
  ],
  [
    "03",
    "Correct once, it ripples",
    "Edit one claim and every dependent claim is flagged with a proposal for you to accept or reject.",
    IconGitBranch,
  ],
  [
    "04",
    "Publish with proof",
    "The agent can prepare and verify. Only you can approve publication and export the Claim Receipt.",
    IconLock,
  ],
] as const;
function WorkflowDiagram() {
  return (
    <div
      className="workflow-diagram"
      aria-label="Sources flow through verification to human approval and a receipt"
    >
      <div className="diagram-top">
        <span>GOOWA / DRAFT 04</span>
        <span className="diagram-state">
          <i /> VERIFYING
        </span>
      </div>
      <div className="source-stack">
        <div>
          <IconFileCheck aria-hidden />
          <span>
            <strong>Source 01</strong>
            <small>Fetched · clean</small>
          </span>
          <IconCheck className="ok" aria-hidden />
        </div>
        <div>
          <IconFileCheck aria-hidden />
          <span>
            <strong>Source 02</strong>
            <small>Fetched · clean</small>
          </span>
          <IconCheck className="ok" aria-hidden />
        </div>
        <div className="quarantined">
          <IconShieldLock aria-hidden />
          <span>
            <strong>Source 03</strong>
            <small>Hidden instructions found</small>
          </span>
          <IconLock aria-hidden />
        </div>
      </div>
      <div className="diagram-flow">
        <span>extract</span>
        <i />
        <span>verify</span>
        <i />
        <span>approve</span>
      </div>
      <div className="claim-stack">
        <div data-status="supported">
          <span>
            <IconCircleCheck aria-hidden /> Claim 08
          </span>
          <b>Supported</b>
        </div>
        <div data-status="weak">
          <span>⚠ Claim 09</span>
          <b>Weak</b>
        </div>
        <div data-status="laundered">
          <span>
            <IconLinkOff aria-hidden /> Claim 10
          </span>
          <b>Laundered</b>
        </div>
      </div>
      <div className="diagram-gate">
        <IconLock aria-hidden />
        <span>
          <strong>Human approval gate</strong>
          <small>Agent publish attempt blocked</small>
        </span>
        <button type="button">Approve</button>
      </div>
    </div>
  );
}
function HowSection() {
  return (
    <section className="section how-section" id="how">
      <div className="section-heading">
        <Eyebrow>HOW IT WORKS</Eyebrow>
        <h2>Draft, verify, correct, prove.</h2>
        <p>
          Four steps keep the speed of an agent without handing it editorial
          control.
        </p>
      </div>
      <div className="how-grid">
        <div className="steps-list">
          {steps.map(([number, title, text, Icon]) => (
            <article className="step" key={number}>
              <span className="step-number">{number}</span>
              <div>
                <Icon className="step-icon" aria-hidden />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="diagram-sticky">
          <WorkflowDiagram />
        </div>
      </div>
    </section>
  );
}

function FeatureVisual({ type }: { type: number }) {
  if (type === 1)
    return (
      <div className="mini-ui mismatch-ui">
        <div>
          <span>CLAIM</span>
          <p>
            Productivity increased <mark>45%</mark>.
          </p>
        </div>
        <div>
          <span>CLOSEST PASSAGE</span>
          <p>
            Participants reported a <mark>38%</mark> increase.
          </p>
        </div>
        <p className="mini-alert">
          <IconLinkOff aria-hidden /> Figure not found in cited passage
        </p>
      </div>
    );
  if (type === 2)
    return (
      <div className="mini-ui quarantine-ui">
        <div className="source-chip">
          <IconCode aria-hidden />
          <span>
            research-notes.html<small>Scanning source…</small>
          </span>
        </div>
        <div className="scan-line">
          <span />
          <span />
          <span />
        </div>
        <p>
          <IconShieldLock aria-hidden /> Hidden instructions found
        </p>
      </div>
    );
  if (type === 3)
    return (
      <div className="mini-ui numeric-ui">
        <div>
          <span>CLAIM SAYS</span>
          <strong>45%</strong>
        </div>
        <div className="not-equal">≠</div>
        <div>
          <span>SOURCE SAYS</span>
          <strong>38%</strong>
        </div>
        <p>
          ⚠ Verdict capped at <b>Weak</b>
        </p>
      </div>
    );
  if (type === 4)
    return (
      <div className="mini-ui ripple-ui">
        <div className="ripple-source">
          <IconSparkles aria-hidden /> Claim 04 · edited
        </div>
        <div className="ripple-lines">
          <i />
          <i />
        </div>
        <div className="ripple-targets">
          <span>
            Claim 07 <b>Needs review</b>
          </span>
          <span>
            Claim 11 <b>Needs review</b>
          </span>
        </div>
      </div>
    );
  if (type === 5)
    return (
      <div className="mini-ui select-ui">
        <p>
          The trial included <mark>2,400 participants</mark> across six regions.
        </p>
        <div className="selection-pop">
          <IconSparkles aria-hidden /> Ask agent to fix <span>⌘↵</span>
        </div>
      </div>
    );
  return (
    <div className="mini-ui gate-ui">
      <div>
        <span>agent&gt; publish</span>
        <b>
          <IconCircleX aria-hidden /> Blocked
        </b>
      </div>
      <ul>
        <li>
          <IconCircleX aria-hidden /> 1 laundered citation
        </li>
        <li>⚠ 1 weak claim</li>
        <li>
          <IconLock aria-hidden /> Human approval required
        </li>
      </ul>
    </div>
  );
}
const features = [
  [
    "Citation laundering detection",
    "A real link must support the exact claim—not just look credible.",
  ],
  [
    "Injection quarantine",
    "Suspicious source instructions are fenced off before the agent can use them.",
  ],
  ["Numeric guard", "A mismatched number cannot receive a supported verdict."],
  [
    "Dependency ripple",
    "One correction marks every affected downstream claim for review.",
  ],
  [
    "Select-to-correct",
    "Highlight a sentence and ask the agent for a scoped proposal.",
  ],
  ["Publish gate", "Agents can request publication. They cannot approve it."],
] as const;
function FeaturesSection() {
  return (
    <section className="section features-section" id="features">
      <div className="section-heading split-heading">
        <div>
          <Eyebrow>FEATURES</Eyebrow>
          <h2>Built for the moment the agent is confident and wrong.</h2>
        </div>
        <p>
          Goowa turns editorial safeguards into visible, inspectable product
          behavior.
        </p>
      </div>
      <div className="feature-grid">
        {features.map(([title, text], index) => (
          <article className="feature-card" key={title}>
            <div className="feature-meta">
              <span>0{index + 1}</span>
              <span>LIVE CAPABILITY</span>
            </div>
            <FeatureVisual type={index + 1} />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReceiptDemo() {
  const [verified, setVerified] = useState(false);
  const [tampered, setTampered] = useState(false);
  return (
    <div className="receipt-demo">
      <div className="receipt-head">
        <div>
          <span className="receipt-logo">
            <IconFileCheck aria-hidden />
          </span>
          <span>
            <small>CLAIM RECEIPT</small>
            <strong>Remote work and productivity</strong>
          </span>
        </div>
        <span className="receipt-revision">REV. 04</span>
      </div>
      <div className="receipt-claim">
        <small>CLAIM 08</small>
        <p>Structured remote work policies improved employee retention.</p>
        <span className="status-supported">
          <IconCircleCheck aria-hidden /> Supported
        </span>
      </div>
      <dl className="receipt-fields">
        <div>
          <dt>Evidence snippet</dt>
          <dd>
            “Retention rose among teams with documented asynchronous practices…”
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>workplace-study.org / p. 14</dd>
        </div>
        <div>
          <dt>Verified by</dt>
          <dd>Goowa verifier · Human approved</dd>
        </div>
        <div>
          <dt>Timestamp</dt>
          <dd>2026-10-18 · 14:32 UTC</dd>
        </div>
      </dl>
      <div className="receipt-hash">
        <span>
          <small>receiptHash</small>
          <code>0x9f3a7d82b410…c21</code>
        </span>
        <IconCheck aria-hidden />
      </div>
      <div
        className={`receipt-checks ${verified ? "is-verified" : ""} ${tampered ? "is-tampered" : ""}`}
        aria-live="polite"
      >
        <span>
          <IconCircleCheck aria-hidden /> Document hash
        </span>
        <span>
          <IconCircleCheck aria-hidden /> Claims
        </span>
        <span>
          <IconCircleCheck aria-hidden /> Evidence
        </span>
      </div>
      <div className="receipt-actions">
        <button type="button" onClick={() => setVerified(true)}>
          <IconFileCheck aria-hidden />{" "}
          {verified ? "Receipt verified" : "Verify receipt"}
        </button>
        <label>
          <span>Tamper demo</span>
          <input
            type="checkbox"
            checked={tampered}
            onChange={(e) => {
              setTampered(e.target.checked);
              setVerified(true);
            }}
          />
          <i />
        </label>
      </div>
    </div>
  );
}
function ProofSection() {
  return (
    <section className="section proof-section" id="receipt">
      <div className="section-heading">
        <Eyebrow>PROOF</Eyebrow>
        <h2>Every article ships with a receipt.</h2>
        <p>
          A tamper-evident record of the source, passage, verdict, human
          decision, and hash behind every claim.
        </p>
      </div>
      <div className="proof-grid">
        <ReceiptDemo />
        <div className="action-proof">
          <Eyebrow>AGENT-NATIVE</Eyebrow>
          <h3>One action, everywhere.</h3>
          <p>
            The verifier is defined once. The interface, in-app agent, and
            external agents all call the same capability with the same rules.
          </p>
          <div className="code-labels">
            <span>React UI</span>
            <span>In-app agent</span>
            <span>MCP · Claude / Cursor</span>
          </div>
          <pre>
            <code>
              <span className="code-purple">export default</span> defineAction(
              {`{`}\n description:{" "}
              <span className="code-gold">&quot;Verify one claim…&quot;</span>
              ,\n mcpTool: <span className="code-purple">true</span>,\n schema:
              z.object({`{`}\n claimId: z.string(),\n {`}`}),\n run:{" "}
              <span className="code-purple">async</span> ({`{`} claimId {`}`},
              ctx) =&gt; {`{`}\n <span className="code-purple">const</span>{" "}
              result = <span className="code-purple">await</span>{" "}
              verifyAndStore(\n claim, actorOf(ctx)\n );\n{" "}
              <span className="code-purple">return</span> result;\n {`}`},\n
              {`}`});
            </code>
          </pre>
          <p className="agent-rule">
            <IconLock aria-hidden /> External agents get the same rules: they
            can propose and verify, never publish.
          </p>
        </div>
      </div>
    </section>
  );
}
function FinalSection() {
  return (
    <section className="final-section">
      <div className="final-glow" aria-hidden />
      <div className="final-content">
        <Eyebrow>KEEP THE SPEED. ADD THE PROOF.</Eyebrow>
        <h2>Stop publishing claims you haven’t checked.</h2>
        <p>
          Draft with an agent. Verify against the source. Keep the final
          decision human.
        </p>
        <div className="button-row">
          <Link className="button button-primary" to="/app">
            Open Goowa <IconArrowRight aria-hidden />
          </Link>
          <a
            className="button button-secondary"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub <IconExternalLink aria-hidden />
          </a>
        </div>
        <small>
          Built for the Builder.io Agent-Native Hackathon · by Victor Ogbonna
          (Outstandingvick)
        </small>
      </div>
    </section>
  );
}
function Footer() {
  return (
    <footer className="landing-footer">
      <div className="footer-inner">
        <div>
          <Wordmark />
          <p>Claim-level verification for research drafted with AI.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link to="/app">App</Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={DEMO_VIDEO_URL}>Demo video</a>
          <a href="#receipt">Receipt example</a>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Goowa</span>
        <span>Human approval required.</span>
      </div>
    </footer>
  );
}
export default function LandingPage() {
  useEffect(() => {
    document.body.classList.add("landing-body");
    const url = new URL(window.location.href);
    if (url.searchParams.has("landing")) {
      url.searchParams.delete("landing");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    return () => document.body.classList.remove("landing-body");
  }, []);
  return (
    <div className="landing-page" id="top">
      <Navigation />
      <main id="main">
        <section className="hero-section">
          <div className="hero-grid">
            <div className="hero-copy">
              <Eyebrow>AGENT-NATIVE RESEARCH EDITOR</Eyebrow>
              <h1>
                AI drafts. Goowa checks every claim. <span>You approve.</span>
              </h1>
              <p className="hero-sub">
                Verify every claim against its source, catch citations that
                don’t support the text, and publish with tamper-evident proof.
              </p>
              <div className="button-row">
                <Link className="button button-primary" to="/app">
                  Try the live demo <IconArrowRight aria-hidden />
                </Link>
                <a className="button button-secondary" href={DEMO_VIDEO_URL}>
                  <IconPlayerPlay aria-hidden /> Watch the 2-min demo
                </a>
              </div>
              <p className="hero-note">
                <IconLock aria-hidden /> The agent can draft and verify. It
                cannot publish.
              </p>
            </div>
            <div className="hero-scene">
              <div className="hero-glow" aria-hidden />
              <div className="hero-artifact artifact-supported" aria-hidden>
                <IconCircleCheck />
                <span>
                  <small>CLAIM 08</small>
                  Supported
                </span>
              </div>
              <div className="hero-artifact artifact-quarantine" aria-hidden>
                <IconShieldLock />
                <span>
                  <small>SOURCE 03</small>
                  Quarantined
                </span>
              </div>
              <div className="hero-artifact artifact-receipt" aria-hidden>
                <IconFileCheck />
                <span>
                  <small>RECEIPT HASH</small>
                  0x9f3a…c21
                </span>
              </div>
              <div className="hero-visual">
                <div className="visual-label">
                  <span>LIVE VERIFICATION RUN</span>
                  <span>DEMO DOCUMENT · 12 CLAIMS</span>
                </div>
                <AgentConsole />
              </div>
            </div>
          </div>
          <div className="hero-strip" aria-label="Product safeguards">
            <span>
              <IconCircleCheck aria-hidden /> Claim-level verification
            </span>
            <span>
              <IconLinkOff aria-hidden /> Citation laundering detection
            </span>
            <span>
              <IconShieldLock aria-hidden /> Injection quarantine
            </span>
            <span>
              <IconFileCheck aria-hidden /> Tamper-evident receipts
            </span>
          </div>
        </section>
        <ProblemSection />
        <HowSection />
        <FeaturesSection />
        <ProofSection />
        <FinalSection />
      </main>
      <Footer />
    </div>
  );
}
