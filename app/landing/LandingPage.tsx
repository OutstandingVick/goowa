import {
  IconBrandGithub,
  IconFileCheck,
  IconLock,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Link } from "react-router";
import type { LinksFunction } from "react-router";

import { Logo } from "@/components/brand/Logo";

import { Footer } from "./Footer";
import { HowItWorks } from "./HowItWorks";
import { ProofTabs } from "./ProofTabs";

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
    { property: "og:image", content: "/goowa-og.png" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

function Eyebrow({ children }: { children: string }) {
  return <p className="l-eyebrow">+ {children}</p>;
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
            cited page never says this. The figure traces to a blog it copied.
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

export default function LandingPage() {
  return (
    <div className="l-page">
      <main id="top">
        <section className="l-hero">
          <div className="l-hero-glow" aria-hidden="true" />
          <header className="l-nav">
            <a href="#top" className="l-brand">
              <Logo variant="onPurple" size={28} />
            </a>
            <nav className="l-nav-pill" aria-label="Sections">
              <a href="#how">How it works</a>
              <a href="#receipt">Receipt</a>
              <a href="#mcp">MCP</a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </nav>
            <div className="l-nav-right">
              <Link className="l-nav-start" to="/app">
                Open Goowa
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
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
              Goowa ties each factual sentence to the passage that supports it,
              flags citations that never said it, and publishes only when a
              human says so.
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

        <HowItWorks />

        <ProofTabs />

      </main>

      <Footer />
    </div>
  );
}
