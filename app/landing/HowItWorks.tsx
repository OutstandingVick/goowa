import { useEffect, useState } from "react";

const STEP_MS = 6000;

const steps = [
  {
    id: "ingest",
    title: "Ingest sources",
    body: "Each URL is fetched server-side and scanned. Pages carrying prompt injections are quarantined and can never be used as evidence.",
  },
  {
    id: "extract",
    title: "Extract claims",
    body: "Every sentence with a figure, a date or a name becomes a claim card, stored as an exact quote and tied to the sources it cites.",
  },
  {
    id: "verify",
    title: "Verify each claim",
    body: "Claims are matched against the source text: exact quote, paraphrase, or numbers that disagree. Weak and laundered citations are flagged.",
  },
  {
    id: "propagate",
    title: "Propose and propagate",
    body: "The agent proposes fixes. Change one claim and every claim depending on it is marked for review and re-checked.",
  },
  {
    id: "gate",
    title: "Human gate and receipt",
    body: "Only a human accepts edits and publishes. Publishing freezes a tamper-evident Claim Receipt anyone can verify.",
  },
] as const;

type StepId = (typeof steps)[number]["id"];

const stats = [
  ["5", "Verdict types", "Supported to laundered"],
  ["0", "Agent publishes", "Server-enforced"],
  ["SHA-256", "Receipt hash", "Tamper-evident"],
  ["214", "Tests passing", "Deterministic checks"],
] as const;

function Diagram({ active }: { active: StepId }) {
  const on = (id: StepId) => (active === id ? " is-on" : "");
  return (
    <div className="hw-diagram" aria-hidden="true">
      <svg className="hw-wires" viewBox="0 0 440 520" preserveAspectRatio="none">
        <path d="M80 20 L220 92 M220 20 L220 92 M360 20 L220 92" />
        <path d="M220 150 L220 210" />
        <path d="M220 280 L90 330 M220 280 L220 330 M220 280 L350 330" />
        <path d="M90 410 L220 456 M220 410 L220 456 M350 410 L220 456" />
        <path
          className="hw-dash"
          d="M300 130 C 430 200, 430 360, 330 452"
        />
      </svg>
      <span className="hw-dot" style={{ left: "18%", top: "4%" }} />
      <span className="hw-dot" style={{ left: "50%", top: "4%" }} />
      <span className="hw-dot" style={{ left: "82%", top: "4%" }} />

      <div className={`hw-node${on("ingest")}`} style={{ left: "50%", top: "18%" }}>
        <i>⬡</i>Sources · fetched
      </div>
      <div
        className={`hw-node hw-node-wide${on("extract")}${on("verify")}`}
        style={{ left: "50%", top: "47%" }}
      >
        <i>◎</i>
        {active === "extract" ? "Claim extraction" : "Verification engine"}
      </div>
      <span className="hw-side" style={{ left: "88%", top: "47%" }}>
        Propose edit
      </span>
      {["Claim 1", "Claim 2", "Claim 3"].map((c, i) => (
        <div
          key={c}
          className={`hw-pod${on("verify")}${on("propagate")}${i === 2 ? " is-bad" : ""}`}
          style={{ left: `${20 + i * 30}%`, top: "71%" }}
        >
          <i>{i === 2 ? "✕" : "✓"}</i>
          {c}
        </div>
      ))}
      <div className={`hw-gate${on("gate")}`} style={{ left: "50%", top: "94%" }}>
        Human gate · publish + receipt
      </div>
    </div>
  );
}

export function HowItWorks({ eyebrow }: { eyebrow?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(
      () => setIndex((i) => (i + 1) % steps.length),
      STEP_MS,
    );
    return () => window.clearTimeout(t);
  }, [index, paused]);

  return (
    <section id="how" className="hw">
      <p className="hw-eyebrow">
        <span /> {eyebrow ?? "How verification works"}
      </p>
      <h2 className="hw-title">
        One draft, every claim.
        <br />
        <span className="hw-seg">Checked before it ships.</span>
      </h2>
      <p className="hw-lead">
        The agent drafts and proposes. Goowa ties each claim to the passage that
        supports it, and a human decides what gets published.
      </p>

      <div className="hw-panel">
        <Diagram active={steps[index]!.id} />
        <ol
          className="hw-steps"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {steps.map((s, i) => (
            <li key={s.id} className={i === index ? "is-active" : ""}>
              <button
                type="button"
                aria-expanded={i === index}
                onClick={() => setIndex(i)}
              >
                {s.title}
              </button>
              {i === index && (
                <>
                  <p>{s.body}</p>
                  <span
                    key={`${index}-${paused}`}
                    className={`hw-progress${paused ? " is-paused" : ""}`}
                    style={{ animationDuration: `${STEP_MS}ms` }}
                  />
                </>
              )}
            </li>
          ))}
        </ol>
      </div>

      <dl className="hw-stats">
        {stats.map(([value, label, sub]) => (
          <div key={label}>
            <dt>{value}</dt>
            <dd>
              {label}
              <small>{sub}</small>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
