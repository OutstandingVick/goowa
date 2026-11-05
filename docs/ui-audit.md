# Landing page UI audit (2026-11-05)

Method: the Improve UI audit skill from ui-skills.com (ibelick). Read-only
pass over the landing surface (`app/landing/*`, `app/landing.css`). There is
no landing design doc; `DESIGN.md` governs the app, so findings are
contradictions inside the surface or against the brand assets in
`public/brand/`.

| # | Problem | Evidence | Change | Confidence |
|---|---|---|---|---|
| 1 | Two golds on one surface | Logo segment `#EDB158` (`public/brand/*.svg`, `Logo.tsx`, OG image) vs page token `--gold: #FFCC33` | Set `--gold` to `#EDB158`; replace hard-coded `#FFCC33` tints | High |
| 2 | Two nav links to one destination | Pill "GitHub" and right-hand "Source" both open the repo | Keep "GitHub", drop "Source" | High |
| 3 | Three labels for `/app` | "Try the demo", "Open Goowa", "Try the live demo"; the first two side by side | Drop the pill "Try the demo"; "Open Goowa" is the nav CTA | Medium |

## Resolution

- **#1 fixed.** `--gold` is `#EDB158`; the hero card highlight, step badges,
  active node ring and the footer game player use the brand gold too.
- **#2 fixed.** "Source" removed from the nav along with its styles,
  including a mobile rule that would otherwise have hidden "Open Goowa".
