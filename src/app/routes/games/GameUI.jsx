/* ════════════════════════════════════════════════
   The controls that belong to a game.

   The board has had its own look for a while; everything you press
   on it did not. Roll the dice was Saathban green, Emoji and Chat
   were the app's white pills, the exit confirm and every sheet were
   cream cards with brown ink. A dark board surrounded by the app's
   furniture is not a game — it is the app with the lights off, which
   is the owner's oldest complaint about these screens said a
   different way.

   So: one small set, read off the reference's own panels — brass for
   the thing you are meant to press, plum for everything else, gold
   edges on anything that reads as a panel. Nothing here imports the
   app's tokens for anything but the two neutrals it has no opinion
   about, and nothing outside routes/games may import this.

   Every control here is unselectable (NO_SELECT). Long-pressing a
   button inside a game must never raise the browser's text-selection
   ribbon over the board.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { GAME, NO_SELECT } from "./gameSurface.js";
import { A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

/* Press states, without a library and without a class per control.
   A chunky button that does not move when pressed reads as a picture
   of a button, and on a touch screen the press IS the feedback —
   there is no hover to fall back on. */
function usePress() {
  const [down, setDown] = useState(false);
  return [
    down,
    {
      onPointerDown: () => setDown(true),
      onPointerUp: () => setDown(false),
      onPointerLeave: () => setDown(false),
      onPointerCancel: () => setDown(false),
    },
  ];
}

/* THE thing to press. Brass, chunky, dark ink — gold takes dark text
   and every white-on-gold pairing fails contrast. */
export function GameBtn({ children, onClick, disabled, style = {}, ...rest }) {
  const { ts } = useI18n();
  const [down, press] = usePress();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...press}
      {...rest}
      style={{
        ...NO_SELECT,
        minHeight: A11Y.minTapTargetPx,
        padding: "10px 22px",
        borderRadius: 14,
        border: `1px solid ${GAME.accentEdge}`,
        background: down ? GAME.accentPressed : GAME.accent,
        color: GAME.accentInk,
        fontFamily: "inherit",
        fontSize: ts(19),
        fontWeight: 800,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        /* The lip under a moulded button, and it goes when pressed —
           the button is level with the table for as long as your
           thumb is on it. */
        boxShadow: down
          ? "inset 0 2px 6px rgba(0,0,0,0.35)"
          : `0 3px 0 ${GAME.accentEdge}, 0 6px 14px rgba(0,0,0,0.35)`,
        transform: down ? "translateY(2px)" : "none",
        transition: "transform 90ms ease, box-shadow 90ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* Everything else. Plum, quiet, and small — these sit under a board
   and must not compete with it. */
export function GamePill({ children, onClick, disabled, style = {}, ...rest }) {
  const { ts } = useI18n();
  const [down, press] = usePress();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...press}
      {...rest}
      style={{
        ...NO_SELECT,
        /* UNDER 40px. The app's floor is 48 and this is a deliberate
           exception inside a game: Emoji and Chat are conveniences
           beside the board, not the actions of the screen, and at 52
           they were taking height from the one thing that matters.
           The tap area stays comfortable because the pill is wide. */
        minHeight: 36,
        padding: "6px 16px",
        borderRadius: 18,
        border: `1px solid ${GAME.pillEdge}`,
        background: down ? GAME.pillPressed : GAME.pill,
        color: GAME.ink,
        fontFamily: "inherit",
        fontSize: ts(16),
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transform: down ? "translateY(1px)" : "none",
        transition: "transform 90ms ease, background 90ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* A panel: sheet, dialog, code box. Magenta-plum with a gold edge,
   arriving with a scale-and-settle rather than appearing. */
export function GamePanel({ children, style = {}, className, ...rest }) {
  return (
    <div
      className={`sb-game-panel${className ? " " + className : ""}`}
      {...rest}
      style={{
        ...NO_SELECT,
        boxSizing: "border-box",
        background: GAME.panel,
        border: `2px solid ${GAME.panelEdge}`,
        borderRadius: 18,
        boxShadow: GAME.panelShadow,
        color: GAME.ink,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* One <style> for the whole game's panel motion, mounted once by the
   play screen. Written here so the timing and the reduced-motion rule
   live beside the panel they govern. */
export function GameMotion() {
  return (
    <style>{`
      @keyframes sb-panel-in {
        from { opacity: 0; transform: translateY(10px) scale(0.965); }
        60%  { opacity: 1; transform: translateY(0) scale(1.006); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes sb-veil-in { from { opacity: 0 } to { opacity: 1 } }
      .sb-game-panel { animation: sb-panel-in ${GAME.motionMs}ms cubic-bezier(.2,.9,.3,1.2) both; }
      .sb-game-veil  { animation: sb-veil-in ${Math.round(GAME.motionMs * 0.8)}ms ease both; }
      @media (prefers-reduced-motion: reduce) {
        .sb-game-panel, .sb-game-veil { animation: none; }
      }
    `}</style>
  );
}

/* A line that says what just happened and then stops saying it.

   The play screen used to carry a permanent instruction — "Tap a die,
   then tap the goti it should move" — sitting under the board on
   every turn of every game for ever. A sentence that is always there
   is not read after the second time; it is just furniture, and this
   furniture was costing the board its height.

   So feedback arrives, is legible, and leaves. `keyed` is whatever
   makes this a NEW thing to say (a roll, a move); when it changes the
   line comes back. */
export function FlashLine({ keyed, children, ms = 2600, style = {} }) {
  const { ts } = useI18n();
  const [shown, setShown] = useState(true);
  useEffect(() => {
    setShown(true);
    const t = setTimeout(() => setShown(false), ms);
    return () => clearTimeout(t);
  }, [keyed, ms]);
  if (!children) return null;
  return (
    <p
      role="status"
      style={{
        ...NO_SELECT,
        margin: "6px 0 0",
        textAlign: "center",
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 700,
        color: GAME.ink,
        minHeight: 0,
        opacity: shown ? 1 : 0,
        transition: "opacity 260ms ease",
        pointerEvents: "none",
      }}
    >
      {children}
    </p>
  );
}
