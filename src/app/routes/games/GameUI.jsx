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

import { useEffect, useRef, useState } from "react";
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
        /* NO MOULDED LIP. A hard 3px edge under a control is the
           other half of the 1990s look the gradient was — together
           they draw a plastic key on a toolbar. One soft shadow
           says the button is above the sheet, and pressing it
           takes the shadow away, which is the whole of what
           pressing something looks like. */
        boxShadow: down
          ? "inset 0 1px 4px rgba(0,0,0,0.30)"
          : "0 4px 14px rgba(0,0,0,0.34)",
        transform: down ? "translateY(1px)" : "none",
        transition: "transform 100ms ease, box-shadow 100ms ease",
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
        transition: "transform 100ms ease, background 100ms ease",
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

/* ANYTHING THAT OPENS OVER THE TABLE CAN BE CLOSED, and the hook
   that does it is the APP'S, not this lane's.

   I wrote a second one here first. Another lane had already
   audited all 23 overlay surfaces in the app, found that 22 of
   them held their open state in a plain useState and so could not
   be dismissed with the Android back gesture, and shipped
   components/useBackToClose.js. Two hooks pushing history entries
   with the same intent and slightly different bookkeeping is how a
   person ends up pressing back twice, so mine is deleted and every
   sheet in the game world uses theirs.

   Re-exported from here so a games file has one place to import
   its chrome from. */
export { default as useBackToClose } from "../../components/useBackToClose.js";

/* A sheet's grab handle, which is also a swipe-down to close.

   It LOOKED like one before and was only a button, so a downward
   drag on it did nothing and the affordance was a lie. Pointer
   events rather than touch events, so a mouse drag works too and
   there is one code path to be wrong in. */
/* `up` for a panel anchored to the TOP of the screen, where the
   gesture that dismisses it is a pull upwards rather than down. */
export function SheetHandle({ onClose, label, up = false }) {
  const from = useRef(null);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClose}
      onPointerDown={(e) => {
        from.current = e.clientY;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={(e) => {
        const start = from.current;
        from.current = null;
        /* Forty pixels down. Short enough to be an easy flick and
           long enough that a tap with a shaky hand is still a
           tap — and a tap closes it anyway, so the two agree. */
        const travel = up ? start - e.clientY : e.clientY - start;
        if (start != null && travel > 40) onClose?.();
      }}
      style={{
        display: "block",
        margin: up ? "10px auto 0" : "0 auto 12px",
        width: 96,
        height: 24,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        touchAction: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: 44,
          height: 4,
          margin: "0 auto",
          borderRadius: 2,
          background: "rgba(255,255,255,0.28)",
        }}
      />
    </button>
  );
}

/* The ✕ in a sheet's top-right. Present because a drag handle is
   a convention and a cross is a control: the owner looked for a
   way out and there was not one drawn. */
export function SheetClose({ onClose, label }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      style={{
        position: "absolute",
        top: 12,
        insetInlineEnd: 12,
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        border: `1px solid ${GAME.glassEdge}`,
        background: GAME.glass,
        color: GAME.ink,
        fontSize: 20,
        lineHeight: 1,
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span aria-hidden="true">✕</span>
    </button>
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
        /* ON A SURFACE, NOT ON THE TABLE.

           This was bare bold text laid straight onto the dark
           ground, and bare light text on a dark ground with no
           edge and no surface under it is the oldest look a
           screen has — it is what a terminal does. The owner's
           word for it was "dated", which is exact.

           It is a card now, in the same midnight the chat, the
           profile cards and the settings menu are made of, so
           the sentence under the board comes from the same
           world as everything else on the screen. Warm off-
           white ink rather than white: #F6EBE2 against a blue-
           black reads as lamplight, and pure white reads as a
           system message.

           SHRINK-WRAPPED, and centred by the column it lives in.
           A full-width bar would be a status line; a card the
           width of its own sentence is a remark. */
        color: GAME.ink,
        display: "inline-block",
        maxWidth: "100%",
        padding: "7px 14px",
        borderRadius: 13,
        background: GAME.panel,
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        lineHeight: 1.35,
        minHeight: 0,
        opacity: shown ? 1 : 0,
        /* It arrives with the card, not only with the ink: a
           surface fading up under a sentence is what stops the
           line looking like it was always there. */
        transform: shown ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 260ms ease, transform 260ms cubic-bezier(.2,.9,.3,1)",
        pointerEvents: "none",
      }}
    >
      {children}
    </p>
  );
}
