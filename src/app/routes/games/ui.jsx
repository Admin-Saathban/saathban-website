/* Games-lane UI primitives — local to routes/games/ per house
   convention. Floors enforced once: ≥48px controls, ≥18px text via
   ts(), visible focus, state never colour alone. */

import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { GAME } from "./gameSurface.js";

/* `game` puts this screen on the table rather than on the app's
   cream. Carrom cannot seat a bot, so tapping it opens a table
   with one chair and an invitation to send — and on cream, with
   the app's header above it, that read as a page that had failed
   to load rather than as a game waiting for somebody. A table
   waiting is still a table, and it should look like one. */
export function GamesScreen({ children, backTo, backLabel, width = 640, game }) {
  const { ts, meta } = useI18n();
  return (
    <main
      className={game ? "sb-games sb-on-table" : "sb-games"}
      style={{
        minHeight: "100vh",
        background: game ? GAME.surfaceLift : C.bg,
        backgroundColor: game ? GAME.surface : C.bg,
        color: game ? GAME.ink : C.textMain,
        padding: "20px 16px 64px",
      }}
    >
      <style>{`
        .sb-games *, .sb-games *::before, .sb-games *::after { box-sizing: border-box; }

        /* ON THE TABLE. Painting the ground dark and leaving the
           contents alone is worse than not painting it at all: the
           heading went dark-on-dark and the cards stayed white, so
           carrom's waiting room read as a half-loaded page rather
           than as a table. These override the inline colours of
           components shared with the rest of the app, which is what
           !important is for and the only place it is used here. */
        .sb-on-table h1, .sb-on-table h2, .sb-on-table h3 { color: ${GAME.ink} !important; }
        .sb-on-table .sb-card {
          background: ${GAME.panel} !important;
          border: 2px solid ${GAME.panelEdge} !important;
          color: ${GAME.ink} !important;
        }
        .sb-on-table .sb-card p, .sb-on-table .sb-card span { color: ${GAME.ink}; }
        .sb-on-table a { color: ${GAME.ink} !important; }
        /* The app+s two buttons, re-dressed. Brass for the one you
           press, plum for the rest — the same two roles GameUI gives
           the ludo table, so a carrom table waiting and a ludo table
           playing are recognisably the same furniture. */
        .sb-on-table .sb-primary {
          background: ${GAME.accent} !important;
          color: ${GAME.accentInk} !important;
          border: 1px solid ${GAME.accentEdge} !important;
        }
        .sb-on-table .sb-ghost {
          background: ${GAME.pill} !important;
          color: ${GAME.ink} !important;
          border: 1px solid ${GAME.pillEdge} !important;
        }
        .sb-on-table input, .sb-on-table textarea {
          background: rgba(0,0,0,0.22) !important;
          color: ${GAME.ink} !important;
          border-color: ${GAME.pillEdge} !important;
        }
        .sb-on-table input::placeholder, .sb-on-table textarea::placeholder { color: ${GAME.inkMuted} !important; }
        .sb-games input, .sb-games textarea, .sb-games select {
          width: 100%;
          min-height: ${A11Y.minTapTargetPx}px;
          font-size: calc(${A11Y.minBodyPx}px * var(--sb-text-scale, 1));
          font-family: inherit;
          color: ${C.textMain};
          background: ${C.white};
          border: 2px solid ${C.warmGray};
          border-radius: 12px;
          padding: 10px 14px;
        }
        .sb-games input:focus-visible,
        .sb-games select:focus-visible,
        .sb-games button:focus-visible,
        .sb-games a:focus-visible {
          outline: 3px solid ${C.greenMuted};
          outline-offset: 2px;
        }
        .sb-games ::placeholder { color: ${C.textMuted}; opacity: 0.8; }
        @keyframes sb-games-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
      `}</style>
      <div style={{ maxWidth: width, margin: "0 auto" }}>
        {backTo && (
          <Link
            to={backTo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: A11Y.minTapTargetPx,
              fontSize: ts(A11Y.minBodyPx),
              color: C.brown,
              textDecoration: "none",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>
              {meta.dir === "rtl" ? "→" : "←"}
            </span>
            {backLabel}
          </Link>
        )}
        {children}
      </div>
    </main>
  );
}

/* The heading for a table, in one place so every screen makes the
   same choice. A NAMED table leads with its name and keeps the game
   as the quiet line underneath — "Sunday chai match" is what the
   person came for, and which game it is can be read off the board.
   An UNNAMED table renders exactly what it always rendered: the game,
   alone. There is deliberately no placeholder and no "Untitled
   table", because naming is optional and an empty slot would nag. */
export function TableHeading({ title, gameName, ts, style }) {
  const named = Boolean(title);
  return (
    <div style={{ minWidth: 0, ...style }}>
      <h1
        style={{
          fontSize: ts(named ? 24 : 28),
          fontWeight: 800,
          margin: 0,
          color: C.brown,
          overflowWrap: "anywhere",
        }}
      >
        {named ? title : gameName}
      </h1>
      {named && (
        <p
          style={{
            fontSize: ts(A11Y.minBodyPx),
            color: C.textMuted,
            margin: "2px 0 0",
          }}
        >
          {gameName}
        </p>
      )}
    </div>
  );
}

export function Card({ children, style }) {
  return (
    <section
      className="sb-card"
      style={{
        background: C.white,
        border: `1px solid ${C.warmGray}`,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function BodyText({ children, muted, style, ...props }) {
  const { ts } = useI18n();
  return (
    <p
      {...props}
      style={{
        fontSize: ts(A11Y.minBodyPx),
        lineHeight: 1.55,
        color: muted ? C.textMuted : C.textMain,
        margin: "0 0 12px",
        overflowWrap: "anywhere",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export function SectionLabel({ children }) {
  const { ts } = useI18n();
  return (
    <p
      style={{
        fontSize: ts(15),
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.olive,
        margin: "24px 0 10px",
      }}
    >
      {children}
    </p>
  );
}

export function PrimaryBtn({ children, style, ...props }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      className="sb-primary"
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: A11Y.minTapTargetPx + 8,
        padding: "0 26px",
        borderRadius: 50,
        border: "none",
        background: C.green,
        color: C.cream,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostBtn({ children, style, ...props }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      className="sb-ghost"
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: A11Y.minTapTargetPx,
        padding: "0 18px",
        borderRadius: 50,
        border: `2px solid ${C.warmGray}`,
        background: C.white,
        color: C.textMain,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Toast({ text }) {
  const { ts } = useI18n();
  if (!text) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        insetInlineStart: "50%",
        transform: "translateX(-50%)",
        bottom: 24,
        zIndex: 50,
        maxWidth: "min(92vw, 560px)",
        background: C.brown,
        color: C.cream,
        fontSize: ts(A11Y.minBodyPx),
        lineHeight: 1.5,
        padding: "14px 22px",
        borderRadius: 16,
        boxShadow: "0 6px 24px rgba(45, 36, 24, 0.35)",
      }}
    >
      {text}
    </div>
  );
}
