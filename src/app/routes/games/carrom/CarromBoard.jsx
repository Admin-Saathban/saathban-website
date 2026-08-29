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
import {
  BOARD, POCKET_R, resolveShot, STRIKER_R, MAX_LAUNCH_SPEED,
} from "./physics.js";

// Warm wooden palette (local — the board wants wood, not app chrome).
const WOOD = "#e7d3b3";
const WOOD_EDGE = "#c9ad83";
const FRAME = C.brown;
const LINE = "#b9975f";
const POCKET = "#2a1c12";
const COIN_W = "#faf3e9";
const COIN_B = "#3a2a1e";
const QUEEN = "#a23b2c";
const STRIKER_FILL = "#f6ead2";

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
      // surface + frame
      ctx.fillStyle = WOOD;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = WOOD_EDGE;
      ctx.lineWidth = N(0.012);
      ctx.strokeRect(N(0.02), N(0.02), N(BOARD - 0.04), N(BOARD - 0.04));
      // centre circle + baselines
      ctx.strokeStyle = LINE;
      ctx.lineWidth = Math.max(1, N(0.004));
      ctx.beginPath(); ctx.arc(N(0.5), N(0.5), N(0.11), 0, Math.PI * 2); ctx.stroke();
      for (const by of [BASE_INSET, BOARD - BASE_INSET]) {
        ctx.beginPath(); ctx.moveTo(N(0.16), N(by)); ctx.lineTo(N(BOARD - 0.16), N(by)); ctx.stroke();
      }
      // pockets
      for (const p of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        ctx.beginPath(); ctx.arc(N(p[0]), N(p[1]), N(POCKET_R), 0, Math.PI * 2);
        ctx.fillStyle = POCKET; ctx.fill();
      }

      // pieces — from the animation frame if playing, else the rest state
      const a = anim.current;
      if (a && a.i < a.frames.length) {
        for (const p of a.frames[a.i]) {
          if (p.id === "striker") { drawDisc(p.x, p.y, STRIKER_R, STRIKER_FILL, FRAME); continue; }
          const fill = p.owner === "queen" ? QUEEN : p.owner === "w" ? COIN_W : COIN_B;
          drawDisc(p.x, p.y, p.r, fill, "#00000030");
        }
        a.i += 1;
        if (a.i >= a.frames.length) { const done = a.done; anim.current = null; done && done(); }
      } else {
        for (const p of st.pieces) {
          if (p.pocketed) continue;
          const fill = p.owner === "queen" ? QUEEN : p.owner === "w" ? COIN_W : COIN_B;
          drawDisc(p.x, p.y, p.r, fill, "#00000030");
        }
        // striker + aim guide, only when it's your turn and not animating
        if (isYourTurn) {
          const sx = strikerX.current, sy = baselineY;
          drawDisc(sx, sy, STRIKER_R, STRIKER_FILL, FRAME);
          const ai = aim.current;
          if (ai) {
            // aim arrow from striker in the shot direction
            const len = 0.16 + ai.power * 0.22;
            const ex = sx + Math.cos(ai.angle) * len, ey = sy + Math.sin(ai.angle) * len;
            ctx.strokeStyle = C.green; ctx.lineWidth = N(0.012); ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(N(sx), N(sy)); ctx.lineTo(N(ex), N(ey)); ctx.stroke();
          }
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
        aria-label="Carrom board"
      />
      {/* Chunky power meter */}
      <div style={{ height: 16, background: C.cream, borderRadius: 50, marginTop: 12, overflow: "hidden", border: `1.5px solid ${C.warmGray}` }}>
        <div style={{ height: "100%", width: `${Math.round(powerView * 100)}%`, background: C.green, transition: "width 60ms linear" }} />
      </div>
    </div>
  );
}
