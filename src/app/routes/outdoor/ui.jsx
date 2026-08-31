/* Outdoor-lane UI primitives — deliberately local to routes/outdoor/
   (each lane carries its own, per house convention). Floors enforced
   once: ≥48px controls, ≥18px text via ts(), visible focus, state
   never colour alone. */

import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

/* The page inset. NOT applied again by this file: <main> above
   already carries 16px, and Lane 2's shell no longer zeroes it — the
   !important hack that made a second gutter necessary has been
   replaced by .sb-bleed. Kept as a named number because .sb-bleed
   pulls back by exactly this much, and the two must agree. */
export const GUTTER = 16;

export function OutdoorScreen({ children, backTo, backLabel, width = 640 }) {
  const { ts, meta } = useI18n();
  return (
    <main
      className="sb-outdoor"
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "20px 16px 64px",
      }}
    >
      <style>{`
        .sb-outdoor *, .sb-outdoor *::before, .sb-outdoor *::after { box-sizing: border-box; }
        .sb-outdoor input, .sb-outdoor textarea, .sb-outdoor select {
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
        .sb-outdoor textarea { resize: vertical; }
        .sb-outdoor input:focus-visible,
        .sb-outdoor textarea:focus-visible,
        .sb-outdoor select:focus-visible,
        .sb-outdoor button:focus-visible,
        .sb-outdoor a:focus-visible {
          outline: 3px solid ${C.greenMuted};
          outline-offset: 2px;
        }
        .sb-outdoor ::placeholder { color: ${C.textMuted}; opacity: 0.8; }
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

/* Extra props (className, ref, data-*) pass through so the feedback
   layer can mark a freshly created card; a component that swallows
   them makes the highlight silently do nothing. */
export function Card({ children, style, className, emphasis, ...rest }) {
  return (
    <section {...rest}
      /* sb-bleed: a surface reaches both edges below a tablet. The
         page keeps its inset for text and controls (lib/i18n.jsx). */
      className={["sb-bleed", className].filter(Boolean).join(" ")}
      style={{
        background: C.white,
        /* No border and no radius. On the grey ground white IS the
           edge — the border existed to separate white from cream and
           has had nothing to do since the ground changed. And an
           outline now means TAPPABLE, so an outlined card said "press
           me" about a container that does nothing. Emphasis is a
           tint, for the same reason. */
        padding: 20,
        marginBottom: 12,
        ...(emphasis ? { background: "#EEF3E8" } : null),

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
        ...style,
      }}
    >
      {children}
    </button>
  );
}
/* OUT_AND_ABOUT_SPEC section 10, FEEDBACK.md: the lane-local Toast that
   used to live here is gone. Every outcome in this area now goes
   through the shared feedback store, and a second toast
   implementation is how two toasts end up on screen at once. */

/* ════════════════════════════════════════════════
   Saying you will come — ONE word, ONE confirmed style.

   The same act had five words across the app: "I'll come", "I'm in",
   "Count me in", "I'm coming", and a confirmed state that rendered as
   plain text on an activity card and a filled button on an event card
   two rows below it. A person cannot learn a verb that changes every
   time they meet it, and two visual states for one meaning reads as
   two different things having happened.

   The word is "I'll come". The confirmed state is an outlined pill
   with a tick that says "You're coming".

   WHY THE CONFIRMED STATE IS STILL AN OUTLINE. The current rule is
   that an outline means tappable, and coming is usually undoable —
   tapping again cancels. Where there is no way to change your mind,
   the same pill renders as a non-interactive span: identical to read,
   honest about what it will do.
   ════════════════════════════════════════════════ */
/* The pill, on its own, for the one place that is a LINK rather than
   a button — the "someone is here right now" card, whose tap opens
   the place. Same shape as every other way of saying you will come,
   because a third look for one word is what item 1 is about. */
export function comingPill(ts) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: A11Y.minTapTargetPx,
    padding: "0 18px",
    borderRadius: 50,
    border: `2px solid ${C.green}`,
    background: C.white,
    color: C.green,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 700,
    textDecoration: "none",
  };
}

export function ComingButton({ coming, onClick, disabled, busyLabel }) {
  const { t, ts } = useI18n();

  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: A11Y.minTapTargetPx,
    padding: "0 18px",
    borderRadius: 50,
    border: `2px solid ${C.green}`,
    background: coming ? "#EAF2E3" : C.white,
    color: C.green,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 700,
  };

  const label = busyLabel || (coming ? t("whatson.coming") : t("whatson.illCome"));

  /* No handler means the state cannot be changed — so it must not
     look like a button that does nothing when pressed. */
  if (!onClick) {
    return (
      <span style={base}>
        {coming && <span aria-hidden="true">✓</span>}
        {label}
      </span>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ ...base, cursor: "pointer", opacity: disabled ? 0.6 : 1 }}>
      {coming && <span aria-hidden="true">✓</span>}
      {label}
    </button>
  );
}


/* A quiet action at the foot of a screen: outlined, because an
   outline means tappable, but in the muted ink rather than the green
   so it does not compete with the primary ask at the top. */
export function footAction(ts) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: A11Y.minTapTargetPx,
    padding: "0 16px",
    borderRadius: 50,
    border: `1.5px solid ${C.warmGray}`,
    background: C.white,
    color: C.textMain,
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 600,
    textDecoration: "none",
  };
}
