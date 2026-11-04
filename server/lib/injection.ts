// Prompt-injection scan for ingested sources. Deterministic rules only; the
// findings are data (plain strings), never rendered as HTML.

import { parseHTML } from "linkedom";

import type { InjectionFinding } from "../db/schema.js";

const PHRASES: { re: RegExp; reason: string }[] = [
  {
    re: /\bignore (?:all |any )?(?:the )?(?:previous|prior|above|earlier) (?:instructions|prompts?|messages?|rules)\b/i,
    reason: "Tells an AI to ignore its instructions",
  },
  {
    re: /\bdisregard (?:all |any )?(?:the )?(?:previous|prior|above|earlier|your) (?:instructions|prompts?|rules|guidelines)\b/i,
    reason: "Tells an AI to disregard its instructions",
  },
  {
    re: /\byou are (?:an? )?(?:AI|artificial intelligence|language model|LLM|assistant|chatbot)\b/i,
    reason: "Addresses an AI directly",
  },
  {
    re: /\b(?:AI|LLM|language model|assistant)s?(?: agents?)?,? (?:reading|summari[sz]ing|processing) this\b/i,
    reason: "Addresses an AI reading the page",
  },
  { re: /\bsystem prompt\b/i, reason: "Mentions a system prompt" },
  {
    re: /\b(?:do not|don't|never) (?:mention|reveal|disclose|tell (?:the )?user)\b/i,
    reason: "Asks to hide information from the user",
  },
  { re: /\bnew instructions?:/i, reason: "Injects new instructions" },
  {
    re: /\byou must (?:always )?(?:say|state|write|claim|cite|include)\b/i,
    reason: "Dictates what an AI must write",
  },
  {
    re: /<\/?(?:system|assistant|instructions?)>/i,
    reason: "Contains chat-role markup",
  },
];

const AI_ADDRESSED =
  /\b(?:AI|LLMs?|language models?|chatbots?|AI assistants?|AI agents?)\b[^.]{0,80}\b(?:must|should|need to|are required to|write|say|state|cite|ignore)\b/i;

const ZERO_WIDTH = /[​-‍⁠﻿]/;

const HIDDEN_STYLE: { re: RegExp; reason: string }[] = [
  { re: /display\s*:\s*none/i, reason: "Hidden with display:none" },
  { re: /visibility\s*:\s*hidden/i, reason: "Hidden with visibility:hidden" },
  {
    re: /font-size\s*:\s*0(?:px|em|rem|%)?\s*(?:;|$)/i,
    reason: "Hidden with zero font size",
  },
  {
    re: /opacity\s*:\s*0(?:\.0+)?\s*(?:;|$)/i,
    reason: "Hidden with zero opacity",
  },
  {
    re: /(?:left|top|text-indent)\s*:\s*-\d{3,}px/i,
    reason: "Positioned off-screen",
  },
  {
    re: /color\s*:\s*(?:#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\s*(?:;|$)/i,
    reason: "White text (likely white-on-white)",
  },
  {
    re: /(?:width|height)\s*:\s*[01]px[^;]*;[^"]*overflow\s*:\s*hidden/i,
    reason: "Clipped to 1px",
  },
];

function clip(text: string, max = 240) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Instruction-like phrases in plain text. */
export function scanText(text: string): InjectionFinding[] {
  const findings: InjectionFinding[] = [];
  for (const { re, reason } of PHRASES) {
    const m = re.exec(text);
    if (!m) continue;
    const from = Math.max(0, m.index - 80);
    const to = Math.min(text.length, m.index + m[0].length + 120);
    findings.push({ snippet: clip(text.slice(from, to)), reason });
  }
  if (ZERO_WIDTH.test(text)) {
    const at = text.search(ZERO_WIDTH);
    findings.push({
      snippet: clip(
        text
          .slice(Math.max(0, at - 60), at + 60)
          .replace(/[​-‍⁠﻿]/g, "⟨zero-width⟩"),
      ),
      reason: "Contains zero-width characters",
    });
  }
  return findings;
}

export type HtmlScan = {
  findings: InjectionFinding[];
  hiddenTexts: string[]; // text of hidden elements, to strip from stored text
};

/** Hidden elements, suspicious meta tags, and comments in raw HTML. */
export function scanHtml(html: string): HtmlScan {
  const findings: InjectionFinding[] = [];
  const hiddenTexts: string[] = [];
  const { document } = parseHTML(html);

  for (const el of Array.from(
    document.querySelectorAll("body *"),
  ) as Element[]) {
    const text = (el.textContent ?? "").trim();
    if (text.length < 15) continue;
    const style = el.getAttribute("style") ?? "";
    // aria-hidden only hides from screen readers, so it is not a signal.
    const hit =
      HIDDEN_STYLE.find((h) => h.re.test(style)) ??
      (el.hasAttribute("hidden")
        ? { reason: "Hidden with the hidden attribute" }
        : undefined);
    if (!hit) continue;
    // Real sites hide menus and dialogs; hidden text only counts when it is
    // instruction-like or addressed to an AI.
    if (!PHRASES.some(({ re }) => re.test(text)) && !AI_ADDRESSED.test(text)) {
      continue;
    }
    // Report the outermost hidden element only.
    if (hiddenTexts.some((t) => t.includes(text))) continue;
    hiddenTexts.push(text);
    findings.push({ snippet: clip(text), reason: hit.reason });
  }

  for (const meta of Array.from(
    document.querySelectorAll("meta[content]"),
  ) as Element[]) {
    const content = meta.getAttribute("content") ?? "";
    for (const f of scanText(content)) {
      findings.push({
        snippet: clip(content),
        reason: `Meta tag: ${f.reason}`,
      });
    }
  }

  for (const m of html.matchAll(/<!--([\s\S]*?)-->/g)) {
    for (const f of scanText(m[1] ?? "")) {
      findings.push({
        snippet: clip(m[1] ?? ""),
        reason: `HTML comment: ${f.reason}`,
      });
    }
  }
  return { findings, hiddenTexts };
}

/** Remove hidden spans, zero-width characters, and instruction sentences. */
export function stripSuspicious(text: string, hiddenTexts: string[]): string {
  let out = text;
  for (const hidden of hiddenTexts) {
    const flat = hidden.replace(/\s+/g, " ").trim();
    out = out.split(hidden).join(" ").split(flat).join(" ");
  }
  out = out.replace(/[​-‍⁠﻿]/g, "");
  // Drop whole sentences that match an instruction phrase.
  out = out
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !PHRASES.some(({ re }) => re.test(s)))
    .join(" ");
  return out.replace(/\s+/g, " ").trim();
}

/** Combined scan of a fetched page. */
export function scanSource(html: string, text: string) {
  const fromHtml = html ? scanHtml(html) : { findings: [], hiddenTexts: [] };
  const findings = [...fromHtml.findings, ...scanText(text)];
  // De-duplicate identical findings.
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = `${f.reason}|${f.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    findings: unique,
    cleanText: stripSuspicious(text, fromHtml.hiddenTexts),
  };
}
