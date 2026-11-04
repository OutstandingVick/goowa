// The propagation "ripple": pulse the changed claim's card, draw connectors
// down the claim panel to each affected card, then nudge those cards. About
// 600 ms in total; skipped under prefers-reduced-motion.

const SVG = "http://www.w3.org/2000/svg";

function card(id: string) {
  return document.querySelector<HTMLElement>(
    `[data-claim-card="${CSS.escape(id)}"]`,
  );
}

export function playRipple(triggerId: string, affectedIds: string[]) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const from = card(triggerId);
  const panel = from?.closest("aside");
  if (!from || !panel) return;
  const targets = affectedIds
    .map(card)
    .filter((el): el is HTMLElement => Boolean(el));

  from.scrollIntoView({ block: "nearest" });
  from.classList.remove("g-ripple-card");
  void from.offsetWidth;
  from.classList.add("g-ripple-card");

  const box = panel.getBoundingClientRect();
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("aria-hidden", "true");
  Object.assign(svg.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${panel.scrollWidth}px`,
    height: `${panel.scrollHeight}px`,
    pointerEvents: "none",
    overflow: "visible",
    zIndex: "5",
  });
  const y = (el: HTMLElement) =>
    el.getBoundingClientRect().top - box.top + panel.scrollTop + 22;
  const x = from.getBoundingClientRect().left - box.left + panel.scrollLeft - 6;
  targets.forEach((el, i) => {
    const path = document.createElementNS(SVG, "path");
    const y0 = y(from);
    const y1 = y(el);
    // An elbow in the left gutter: out, down, and back in.
    path.setAttribute("d", `M ${x + 8} ${y0} H ${x} V ${y1} H ${x + 8}`);
    path.setAttribute("class", "g-ripple-line");
    const len = Math.abs(y1 - y0) + 16;
    path.style.setProperty("--len", String(len));
    path.style.animationDelay = `${120 + i * 70}ms`;
    svg.appendChild(path);
    window.setTimeout(
      () => {
        el.classList.remove("g-ripple-card");
        void el.offsetWidth;
        el.classList.add("g-ripple-card");
      },
      300 + i * 70,
    );
  });
  if (getComputedStyle(panel).position === "static")
    panel.style.position = "relative";
  panel.appendChild(svg);
  window.setTimeout(() => svg.remove(), 1100);
}
