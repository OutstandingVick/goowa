import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { Logo } from "@/components/brand/Logo";

const GITHUB_URL = "https://github.com/OutstandingVick/goowa";
const MCP_CMD = "claude mcp add --transport http goowa https://goowa.vercel.app/mcp";
const BEST_KEY = "goowa-runner-best";

function CopyCommand() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ft-cmd">
      <code>{MCP_CMD}</code>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy command"}
        onClick={() => {
          void navigator.clipboard?.writeText(MCP_CMD);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="4" y="3" width="8" height="11" rx="1" />
            <path d="M6 3V2h4v1" />
          </svg>
        )}
      </button>
    </div>
  );
}

/**
 * Claim Runner: a tiny pixel endless runner. The gold check jumps over
 * unsupported claims. Space (while the game is on screen), click or tap.
 */
function ClaimRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [state, setState] = useState<"idle" | "running" | "over">("idle");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const P = 4; // pixel size
    let w = 0;
    const h = 220;
    const ground = h - 44;
    let raf = 0;
    let visible = false;
    let mode: "idle" | "running" | "over" = "idle";
    let y = 0; // player height above ground
    let vy = 0;
    let speed = 5;
    let dist = 0;
    let obstacles: { x: number; h: number }[] = [];
    const clouds = [
      { x: 120, y: 40, s: 1 },
      { x: 520, y: 22, s: 0.8 },
      { x: 900, y: 60, s: 1.2 },
    ];
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {}

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener("resize", resize);

    const px = (x: number, yy: number, cw: number, ch: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x / P) * P, Math.round(yy / P) * P, cw, ch);
    };
    const cloud = (x: number, yy: number, s: number) => {
      const c = "rgb(255 255 255 / 0.16)";
      px(x + 16 * s, yy, 32 * s, 8 * s, c);
      px(x + 4 * s, yy + 8 * s, 64 * s, 8 * s, c);
      px(x, yy + 16 * s, 80 * s, 8 * s, c);
    };
    // Player: gold block with a pixel check.
    const player = (x: number, top: number) => {
      px(x, top, 32, 32, "#ffcc33");
      const ink = "#3b1f6e";
      [
        [6, 16],
        [10, 20],
        [14, 24],
        [18, 20],
        [22, 16],
        [26, 12],
      ].forEach(([dx, dy]) => px(x + dx!, top + dy!, P, P, ink));
    };
    // Obstacle: an "unsupported claim" block with a pixel ✕.
    const block = (x: number, bh: number) => {
      const top = ground - bh;
      px(x, top, 28, bh, "rgb(255 255 255 / 0.22)");
      const ink = "#ff8a7a";
      for (let i = 0; i < 4; i++) {
        px(x + 6 + i * P, top + 6 + i * P, P, P, ink);
        px(x + 18 - i * P, top + 6 + i * P, P, P, ink);
      }
    };

    const reset = () => {
      y = 0;
      vy = 0;
      speed = 5;
      dist = 0;
      obstacles = [{ x: w + 100, h: 36 }];
      setScore(0);
    };
    const jump = () => {
      if (mode !== "running") {
        reset();
        mode = "running";
        setState("running");
        return;
      }
      if (y === 0) vy = 11;
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const c of clouds) {
        if (mode === "running") c.x -= speed * 0.2 * c.s;
        if (c.x < -100) c.x = w + 40;
        cloud(c.x, c.y, c.s);
      }
      // Ground line and dashes.
      px(0, ground, w, P, "rgb(255 255 255 / 0.35)");
      for (let i = 0; i < w / 90 + 2; i++) {
        const off = mode === "running" ? dist % 90 : 0;
        px(i * 90 - off, ground + 20, 32, P, "rgb(255 255 255 / 0.25)");
        px(i * 90 + 45 - off, ground + 34, 16, P, "rgb(255 255 255 / 0.2)");
      }

      if (mode === "running") {
        dist += speed;
        speed = Math.min(12, speed + 0.002);
        vy -= 0.6;
        y = Math.max(0, y + vy);
        if (y === 0) vy = 0;
        for (const o of obstacles) o.x -= speed;
        obstacles = obstacles.filter((o) => o.x > -40);
        const last = obstacles[obstacles.length - 1];
        if (!last || last.x < w - (260 + Math.random() * 300)) {
          obstacles.push({ x: w + 20, h: [28, 36, 48][Math.floor(Math.random() * 3)]! });
        }
        const s = Math.floor(dist / 40);
        setScore(s);
        // Collision.
        const pTop = ground - 32 - y;
        for (const o of obstacles) {
          if (o.x < 92 && o.x + 28 > 64 && pTop + 32 > ground - o.h + 4) {
            mode = "over";
            setState("over");
            setBest((b) => {
              const nb = Math.max(b, s);
              try {
                localStorage.setItem(BEST_KEY, String(nb));
              } catch {}
              return nb;
            });
          }
        }
      }
      for (const o of obstacles) block(o.x, o.h);
      player(64, ground - 32 - y);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = Boolean(e?.isIntersecting && e.intersectionRatio > 0.6);
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(canvas);
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !visible) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, button, a, [contenteditable]")) return;
      e.preventDefault();
      jump();
    };
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", jump);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", jump);
    };
  }, []);

  const pad = (n: number) => String(n).padStart(5, "0");
  return (
    <div className="ft-game">
      <div className="ft-score" aria-live="off">
        <span>
          Score<b>{pad(score)}</b>
        </span>
        <span>
          Best<b>{pad(best)}</b>
        </span>
      </div>
      {state !== "running" && (
        <div className="ft-game-msg">
          <p className="ft-game-title">&gt; claim run</p>
          <p className="ft-game-hint">
            {state === "over" ? "Unsupported claim hit. " : ""}
            Press space or tap to {state === "over" ? "retry" : "verify"}
            <span className="ft-caret">_</span>
          </p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="ft-canvas"
        aria-label="Claim Runner mini game: jump over unsupported claims"
      />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="ft">
      <div className="ft-top">
        <Link to="/" aria-label="Goowa home" className="ft-logo">
          <Logo variant="onPurple" size={40} />
        </Link>
        <div className="ft-center">
          <CopyCommand />
          <p>
            Check drafts from Claude or any MCP client, or{" "}
            <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer">
              read the docs
            </a>
          </p>
        </div>
        <p className="ft-copy">© 2026 Goowa</p>
      </div>
      <nav className="ft-links" aria-label="Footer">
        <a href="#how">How it works</a>
        <a href="#receipt">Claim receipt</a>
        <a href="#mcp">MCP</a>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span>Builder.io Agent-Native Hackathon</span>
      </nav>
      <ClaimRunner />
    </footer>
  );
}
