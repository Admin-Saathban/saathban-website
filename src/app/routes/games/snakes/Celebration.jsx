/* ════════════════════════════════════════════════
   Reaching 100.

   CONFETTI IS IN THE WINNER'S COLOUR, not in a party palette. A
   hundred multicoloured squares say "a game ended"; a hundred pieces
   of the yellow player's yellow say "YOU won", and on a shared phone
   passed round a room that difference is the whole point.

   IT IS HELD. The moment does not slide away after a beat — the name
   stays on the table until somebody dismisses it, because the person
   who won is often not the person holding the phone, and the table
   needs time to look over and see it.

   The chime is played once, by the screen that opens this, rather
   than on a timer inside it: a sound that fires from a component's
   render can fire twice under StrictMode and a doubled win chime is
   instantly, embarrassingly wrong.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "../../../lib/i18n.jsx";
import { playSound } from "../../../lib/sound.js";
import { colorOf } from "./skins.js";
import useBackToClose from "../../../components/useBackToClose.js";

const CSS = `
@keyframes sb-snk-fall {
  0%   { transform: translate3d(0,-12vh,0) rotate(0deg); opacity: 0; }
  8%   { opacity: 1; }
  100% { transform: translate3d(var(--dx), 108vh, 0) rotate(var(--spin)); opacity: 1; }
}
@keyframes sb-snk-rise {
  from { opacity: 0; transform: translateY(14px) scale(.94); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .sb-snk-bit { animation: none !important; display: none; }
  .sb-snk-card { animation: none !important; }
}`;

export default function Celebration({ colorIdx = 0, name, onDone }) {
  const { t, ts } = useI18n();
  const c = colorOf(colorIdx);
  const fired = useRef(false);

  /* Back dismisses the winner's moment instead of leaving the table. */
  useBackToClose(true, onDone);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    playSound("win");
  }, []);

  /* Fixed at mount: re-rolling these on every render would restart
     every animation each time the parent polls. */
  const bits = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: Math.random() * 100,
        dx: `${(Math.random() * 2 - 1) * 18}vw`,
        spin: `${Math.random() * 900 - 450}deg`,
        delay: Math.random() * 1.1,
        dur: 2.4 + Math.random() * 1.9,
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 9,
        /* Three tones of the ONE colour, so it reads as depth rather
           than as a second hue joining in. */
        fill: [c.body, c.light, c.deep][i % 3],
        round: i % 4 === 0,
      })),
    [c]
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }}
      role="dialog"
      aria-modal="true"
    >
      <style>{CSS}</style>
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,10,20,.62)" }} />

      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
        {bits.map((b, i) => (
          <span
            key={i}
            className="sb-snk-bit"
            style={{
              position: "absolute",
              top: 0,
              left: `${b.left}%`,
              width: b.w,
              height: b.h,
              background: b.fill,
              borderRadius: b.round ? "50%" : 1.5,
              "--dx": b.dx,
              "--spin": b.spin,
              animation: `sb-snk-fall ${b.dur}s linear ${b.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="sb-snk-card"
        style={{
          position: "relative",
          animation: "sb-snk-rise 420ms cubic-bezier(.2,.9,.3,1) both",
          background: "#14110C",
          border: `2px solid ${c.body}`,
          borderRadius: 22,
          padding: "26px 28px",
          textAlign: "center",
          maxWidth: 320,
          boxShadow: "0 20px 50px rgba(0,0,0,.6)",
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }} aria-hidden="true">👑</div>
        <p style={{ margin: "0 0 4px", fontSize: ts(24), fontWeight: 800, color: c.light }}>{name}</p>
        <p style={{ margin: "0 0 18px", fontSize: ts(17), color: "#D8D2C4" }}>{t("snakes.win.body")}</p>
        <button
          type="button"
          onClick={onDone}
          style={{
            minHeight: 48, padding: "0 26px", borderRadius: 14, border: "none",
            background: c.body, color: c.ink, fontSize: ts(17), fontWeight: 800, cursor: "pointer",
          }}
        >
          {t("snakes.win.done")}
        </button>
      </div>
    </div>
  );
}
