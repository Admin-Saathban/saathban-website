/* ════════════════════════════════════════════════
   Carrom board — top-down canvas renderer + drag-aim-release striker
   with a power meter. Rails-independent: it takes a physics `state` and,
   when it's your turn, lets you aim and shoot; it animates the shot from
   the deterministic physics frames and hands the resolved outcome back
   through onShoot(shot, result). The parent (a rails controller, or the
   standalone hotseat controller) persists/authorises and passes the next
   authoritative state back down.

   Controls are deliberately large and forgiving (SPEC: seniors, phone
   width): tap/drag along your baseline to position the big striker, then
   pull back from it like a slingshot — a wide arrow shows the aim and a
   chunky meter shows the power — and lift your finger to shoot. Warm
   wooden palette.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { STRINGS } from "./carromCopy.js";
import {
  BOARD, POCKET_R, resolveShot, STRIKER_R, MAX_LAUNCH_SPEED,
} from "./physics.js";

/* Warm wooden palette (local — the board wants wood, not app chrome).
   A real carrom board is a single plank of ply, so the surface is a
   gradient rather than a flat fill and the grain runs one way across
   the whole of it. */
const WOOD = "#e7d3b3";
const WOOD_LIGHT = "#f2e2c6";
const WOOD_DARK = "#d6bc92";
const WOOD_EDGE = "#c9ad83";
const FRAME = C.brown;
const LINE = "#b9975f";
const LINE_RED = "#a23b2c";
const POCKET = "#2a1c12";
const COIN_W = "#faf3e9";
const COIN_B = "#3a2a1e";
const QUEEN = "#a23b2c";
const STRIKER_FILL = "#f6ead2";

/* A small deterministic generator, so the grain is the same every time
   the board is rebuilt. Math.random() here would make the wood crawl
   whenever the canvas resized — the plank would change species on a
   rotation. */
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 4294967296;
  };
}

/* Everything that never moves — wood, grain, lines, pockets — drawn
   ONCE into an offscreen canvas and blitted each frame. Grain is a few
   hundred strokes; redrawing it sixty times a second would cost more
   than the whole rest of the game. */
function buildBoardLayer(S, BOARD, POCKET_R, BASE_INSET) {
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d");
  const N = (v) => v * S;
  const rnd = seeded(0x5a47ba7);

  // the plank
  const base = g.createLinearGradient(0, 0, S, S);
  base.addColorStop(0, WOOD_LIGHT);
  base.addColorStop(0.45, WOOD);
  base.addColorStop(1, WOOD_DARK);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);

  /* Grain: long, nearly-horizontal strokes that wander a little. Two
     passes — fine light fibres, then a few darker heartwood lines — so
     it reads as timber rather than as hatching. */
  g.save();
  g.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    const count = pass === 0 ? 210 : 26;
    for (let i = 0; i < count; i++) {
      const y = rnd() * S;
      const amp = (pass === 0 ? 1.5 : 4) + rnd() * (pass === 0 ? 2 : 6);
      const wob = 0.004 + rnd() * 0.01;
      g.beginPath();
      g.moveTo(-4, y);
      for (let x = 0; x <= S; x += S / 22) {
        g.lineTo(x, y + Math.sin(x * wob + i) * amp);
      }
      g.strokeStyle =
        pass === 0
          ? `rgba(150,110,60,${0.03 + rnd() * 0.05})`
          : `rgba(120,80,40,${0.05 + rnd() * 0.06})`;
      g.lineWidth = pass === 0 ? 0.6 + rnd() * 0.9 : 1.4 + rnd() * 1.8;
      g.stroke();
    }
  }
  g.restore();

  // a soft vignette, so the middle of the board sits under the light
  const vig = g.createRadialGradient(N(0.5), N(0.45), N(0.12), N(0.5), N(0.5), N(0.78));
  vig.addColorStop(0, "rgba(255,248,232,0.20)");
  vig.addColorStop(0.6, "rgba(255,255,255,0)");
  vig.addColorStop(1, "rgba(90,60,25,0.16)");
  g.fillStyle = vig;
  g.fillRect(0, 0, S, S);

  // the playing field: a double border, as painted on a real board
  g.strokeStyle = WOOD_EDGE;
  g.lineWidth = Math.max(2, N(0.012));
  g.strokeRect(N(0.02), N(0.02), N(BOARD - 0.04), N(BOARD - 0.04));
  g.strokeStyle = "rgba(120,85,40,0.35)";
  g.lineWidth = Math.max(1, N(0.004));
  g.strokeRect(N(0.045), N(0.045), N(BOARD - 0.09), N(BOARD - 0.09));

  // centre: the red ring and its inner circle
  g.strokeStyle = LINE_RED;
  g.lineWidth = Math.max(1.5, N(0.007));
  g.beginPath();
  g.arc(N(0.5), N(0.5), N(0.11), 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = LINE;
  g.lineWidth = Math.max(1, N(0.004));
  g.beginPath();
  g.arc(N(0.5), N(0.5), N(0.055), 0, Math.PI * 2);
  g.stroke();

  /* Baselines, each ending in the two small circles a real board has —
     they are what tells you where the striker may sit. */
  for (const by of [BASE_INSET, BOARD - BASE_INSET]) {
    g.strokeStyle = LINE;
    g.lineWidth = Math.max(1.5, N(0.006));
    g.beginPath();
    g.moveTo(N(0.16), N(by));
    g.lineTo(N(BOARD - 0.16), N(by));
    g.stroke();
    for (const bx of [0.16, BOARD - 0.16]) {
      g.beginPath();
      g.arc(N(bx), N(by), N(0.022), 0, Math.PI * 2);
      g.strokeStyle = LINE_RED;
      g.lineWidth = Math.max(1.2, N(0.005));
      g.stroke();
    }
  }

  /* Pockets, with depth: a dark well that is darkest just off-centre,
     a shadow under the near lip, and a thin lit rim on the far side —
     the two together are what make a circle read as a hole rather than
     as a black disc. */
  for (const p of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const cx = N(p[0]);
    const cy = N(p[1]);
    const r = N(POCKET_R);

    g.save();
    g.beginPath();
    g.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
    g.fillStyle = "rgba(90,60,25,0.22)";
    g.fill();
    g.restore();

    const well = g.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.08, cx, cy, r);
    well.addColorStop(0, "#120a05");
    well.addColorStop(0.55, POCKET);
    well.addColorStop(1, "#4a3320");
    g.fillStyle = well;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.arc(cx, cy, r * 0.98, Math.PI * 0.15, Math.PI * 0.85);
    g.strokeStyle = "rgba(255,236,200,0.5)";
    g.lineWidth = Math.max(1, r * 0.11);
    g.stroke();
  }

  return c;
}

/* A coin as an object with weight: a contact shadow under it, a body
   lit from the top-left, a rim, and one specular highlight. */
function drawCoin(ctx, N, x, y, r, base, isQueen) {
  const cx = N(x);
  const cy = N(y);
  const rr = N(r);

  ctx.beginPath();
  ctx.ellipse(cx, cy + rr * 0.3, rr * 0.98, rr * 0.52, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(70,45,20,0.30)";
  ctx.fill();

  const body = ctx.createRadialGradient(cx - rr * 0.36, cy - rr * 0.4, rr * 0.12, cx, cy, rr * 1.05);
  if (base === COIN_W) {
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.55, COIN_W);
    body.addColorStop(1, "#d8c7ac");
  } else if (base === COIN_B) {
    body.addColorStop(0, "#6d5442");
    body.addColorStop(0.5, COIN_B);
    body.addColorStop(1, "#211611");
  } else {
    body.addColorStop(0, "#d0655a");
    body.addColorStop(0.5, QUEEN);
    body.addColorStop(1, "#6d2118");
  }
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  ctx.lineWidth = Math.max(1, rr * 0.1);
  ctx.strokeStyle = base === COIN_W ? "rgba(120,90,50,0.45)" : "rgba(0,0,0,0.35)";
  ctx.stroke();

  // the turned edge every carrom coin has
  ctx.beginPath();
  ctx.arc(cx, cy, rr * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = base === COIN_B ? "rgba(255,255,255,0.10)" : "rgba(120,90,50,0.20)";
  ctx.lineWidth = Math.max(0.8, rr * 0.07);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx - rr * 0.34, cy - rr * 0.38, rr * 0.34, rr * 0.22, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = base === COIN_B ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.72)";
  ctx.fill();

  if (isQueen) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,240,220,0.55)";
    ctx.fill();
  }
}

/* The striker is a different OBJECT, not a bigger coin: paler, ringed
   twice, with a bright rim. At a glance across a phone it must never be
   mistaken for a piece you can pocket for points. */
function drawStriker(ctx, N, x, y, r) {
  const cx = N(x);
  const cy = N(y);
  const rr = N(r);

  ctx.beginPath();
  ctx.ellipse(cx, cy + rr * 0.32, rr * 1.0, rr * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(70,45,20,0.34)";
  ctx.fill();

  const body = ctx.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.1, cx, cy, rr * 1.05);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.5, STRIKER_FILL);
  body.addColorStop(1, "#cbbb9d");
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  ctx.strokeStyle = FRAME;
  ctx.lineWidth = Math.max(1.5, rr * 0.13);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, rr * 0.6, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(87,52,37,0.45)";
  ctx.lineWidth = Math.max(1, rr * 0.07);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, rr * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(87,52,37,0.5)";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx - rr * 0.33, cy - rr * 0.4, rr * 0.32, rr * 0.2, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fill();
}

const BASE_INSET = 0.14; // baseline distance from the edge (normalized)
const MAX_PULL = 0.34; // pull length (normalized) that maps to full power

export default function CarromBoard({
  state,
  seat = 0,
  isYourTurn,
  onShoot,
  size = 340,
  mySeat0 = null,
}) {
  const { lang } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [px, setPx] = useState(size); // rendered pixel size (square)
  // striker x-position along the baseline (normalized), and live aim
  const strikerX = useRef(0.5);
  const aim = useRef(null); // { angle, power } while pulling
  const anim = useRef(null); // { frames, i } while a shot plays
  const rafState = useRef({ state });

  rafState.current.state = state;

  const baselineY = seat === 0 ? BOARD - BASE_INSET : BASE_INSET;
  // Point of view: the player on the far side looks at the board the
  // other way up, so their own baseline is nearest them. Rotating the
  // rendering alone would send every drag the wrong way, so the
  // pointer mapping is rotated by exactly the same half turn below.
  const flip = mySeat0 === 1;

  // Fit a square to the container width (phone-first), capped for desktop.
  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current ? wrapRef.current.clientWidth : size;
      setPx(Math.max(240, Math.min(w, 460)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [size]);

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // no 2d context (SSR / headless) — render loop stays idle
    let raf;
    const S = px;
    const N = (v) => v * S; // normalized → pixels
    const layer = buildBoardLayer(S, BOARD, POCKET_R, BASE_INSET);

    const drawDisc = (x, y, r, fill, ring) => {
      ctx.beginPath();
      ctx.arc(N(x), N(y), N(r), 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (ring) { ctx.lineWidth = Math.max(1.5, N(0.006)); ctx.strokeStyle = ring; ctx.stroke(); }
    };

    /* Applied at the start of every frame; undone at the end, so the
       transform can never accumulate across frames. */
    const applyPov = () => {
      if (!flip) return;
      ctx.translate(N(BOARD / 2), N(BOARD / 2));
      ctx.rotate(Math.PI);
      ctx.translate(-N(BOARD / 2), -N(BOARD / 2));
    };

    const frame = () => {
      const st = rafState.current.state;
      ctx.clearRect(0, 0, S, S);
      ctx.save();
      applyPov();
      // the plank, its grain, the painted lines and the pockets: all
      // still, so all drawn once and blitted
      ctx.drawImage(layer, 0, 0);

      // pieces — from the animation frame if playing, else the rest state
      const a = anim.current;
      if (a && a.i < a.frames.length) {
        for (const p of a.frames[a.i]) {
          if (p.id === "striker") { drawStriker(ctx, N, p.x, p.y, STRIKER_R); continue; }
          const fill = p.owner === "queen" ? QUEEN : p.owner === "w" ? COIN_W : COIN_B;
          drawCoin(ctx, N, p.x, p.y, p.r, fill, p.owner === "queen");
        }
        a.i += 1;
        if (a.i >= a.frames.length) { const done = a.done; anim.current = null; done && done(); }
      } else {
        for (const p of st.pieces) {
          if (p.pocketed) continue;
          const fill = p.owner === "queen" ? QUEEN : p.owner === "w" ? COIN_W : COIN_B;
          drawCoin(ctx, N, p.x, p.y, p.r, fill, p.owner === "queen");
        }
        // striker + aim guide, only when it's your turn and not animating
        if (isYourTurn) {
          const sx = strikerX.current, sy = baselineY;
          const ai = aim.current;

          if (ai) {
            /* THE AIM LINE IS DRAWN BEFORE THE STRIKER, so the striker
               sits on top of it rather than being crossed out by it.

               Three parts, because one thin line is not enough to aim
               with on a phone held at arm's length: a long faint guide
               all the way to the far rail showing where the shot is
               pointed, a solid thick shaft whose LENGTH is the power,
               and a filled arrowhead at its end. */
            const cosA = Math.cos(ai.angle);
            const sinA = Math.sin(ai.angle);

            ctx.save();
            ctx.setLineDash([N(0.018), N(0.022)]);
            ctx.strokeStyle = "rgba(6,50,20,0.30)";
            ctx.lineWidth = Math.max(2, N(0.008));
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(N(sx), N(sy));
            ctx.lineTo(N(sx + cosA * 1.4), N(sy + sinA * 1.4));
            ctx.stroke();
            ctx.restore();

            const len = 0.12 + ai.power * 0.26;
            const ex = sx + cosA * len;
            const ey = sy + sinA * len;
            ctx.strokeStyle = C.green;
            ctx.lineWidth = Math.max(4, N(0.022));
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(N(sx), N(sy));
            ctx.lineTo(N(ex), N(ey));
            ctx.stroke();

            const head = N(0.055);
            ctx.beginPath();
            ctx.moveTo(N(ex) + cosA * head, N(ey) + sinA * head);
            ctx.lineTo(N(ex) + Math.cos(ai.angle + 2.5) * head, N(ey) + Math.sin(ai.angle + 2.5) * head);
            ctx.lineTo(N(ex) + Math.cos(ai.angle - 2.5) * head, N(ey) + Math.sin(ai.angle - 2.5) * head);
            ctx.closePath();
            ctx.fillStyle = C.green;
            ctx.fill();

            /* Power, again, as a ring filling around the striker — the
               meter under the board is honest but it is not where the
               finger is looking. */
            ctx.beginPath();
            ctx.arc(N(sx), N(sy), N(STRIKER_R) * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ai.power);
            ctx.strokeStyle = ai.power > 0.8 ? "#8C2F22" : C.green;
            ctx.lineWidth = Math.max(3, N(0.014));
            ctx.lineCap = "round";
            ctx.stroke();
          }

          drawStriker(ctx, N, sx, sy, STRIKER_R);
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [px, isYourTurn, baselineY, flip]);

  // ── pointer: reposition on the baseline, or slingshot-aim from the striker ──
  const mode = useRef(null); // 'move' | 'aim'
  const toNorm = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = (t.clientX - rect.left) / rect.width;
    const y = (t.clientY - rect.top) / rect.height;
    // Undo the POV rotation so a drag means the same thing on both
    // sides of the board.
    return flip ? { x: BOARD - x, y: BOARD - y } : { x, y };
  };

  const onDown = (e) => {
    if (!isYourTurn || anim.current) return;
    e.preventDefault();
    const p = toNorm(e);
    const onStriker = Math.hypot(p.x - strikerX.current, p.y - baselineY) < STRIKER_R * 2.4;
    mode.current = onStriker ? "aim" : "move";
    if (mode.current === "move") strikerX.current = Math.max(0.16, Math.min(BOARD - 0.16, p.x));
    else aim.current = { angle: seat === 0 ? -Math.PI / 2 : Math.PI / 2, power: 0 };
  };
  const onMove = (e) => {
    if (!isYourTurn || anim.current || !mode.current) return;
    e.preventDefault();
    const p = toNorm(e);
    if (mode.current === "move") {
      strikerX.current = Math.max(0.16, Math.min(BOARD - 0.16, p.x));
    } else {
      // slingshot: pull away from the target; the striker flings the opposite way
      const dx = strikerX.current - p.x, dy = baselineY - p.y;
      const pull = Math.hypot(dx, dy);
      // constrain to shoot INTO the board (away from your baseline)
      let angle = Math.atan2(dy, dx);
      const into = seat === 0 ? -Math.PI / 2 : Math.PI / 2;
      // clamp the aim to the forward half-plane
      const forward = seat === 0 ? dy < 0 : dy > 0;
      if (!forward) angle = into;
      aim.current = { angle, power: Math.max(0, Math.min(1, pull / MAX_PULL)) };
    }
  };
  const onUp = (e) => {
    if (!isYourTurn || anim.current || !mode.current) return;
    e.preventDefault();
    const wasAim = mode.current === "aim";
    const ai = aim.current;
    mode.current = null;
    aim.current = null;
    if (wasAim && ai && ai.power > 0.05) {
      fireShot({ x: strikerX.current, y: baselineY, angle: ai.angle, power: ai.power });
    }
  };

  const fireShot = (shot) => {
    const st = rafState.current.state;
    const result = resolveShot(st, shot, seat, { frames: true });
    // play the animation, then report the outcome up
    anim.current = { frames: result.frames || [], i: 0, done: () => onShoot?.(shot, result) };
    if (!result.frames || result.frames.length === 0) onShoot?.(shot, result);
  };

  const [powerView, setPowerView] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPowerView(aim.current ? aim.current.power : 0), 60);
    return () => clearInterval(id);
  }, []);

  return (
    <div ref={wrapRef} style={{ width: "100%", maxWidth: 460, margin: "0 auto" }}>
      <canvas
        ref={canvasRef}
        width={px}
        height={px}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        style={{
          width: "100%",
          height: "auto",
          aspectRatio: "1 / 1",
          borderRadius: 16,
          border: `10px solid ${FRAME}`,
          touchAction: "none",
          display: "block",
          background: WOOD,
        }}
        aria-label={s.boardLabel}
      />
      {/* The power meter. Taller than a progress bar wants to be, and
          labelled at both ends: "something is filling up" is not a
          reading anyone can shoot by. The bar deepens towards firm
          rather than switching colour at a threshold, so the strength
          is legible without a line being crossed — and the words carry
          it for anyone the colour does not reach. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <span style={{ fontSize: 15, color: C.textMuted, flexShrink: 0 }}>{s.powerGentle}</span>
        <div
          role="progressbar"
          aria-label={s.power}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(powerView * 100)}
          style={{
            flex: 1,
            height: 24,
            background: C.cream,
            borderRadius: 50,
            overflow: "hidden",
            border: `2px solid ${C.warmGray}`,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round(powerView * 100)}%`,
              background: `linear-gradient(90deg, ${C.sage}, ${C.green})`,
              transition: "width 60ms linear",
            }}
          />
        </div>
        <span style={{ fontSize: 15, color: C.textMuted, flexShrink: 0 }}>{s.powerFirm}</span>
      </div>
    </div>
  );
}
