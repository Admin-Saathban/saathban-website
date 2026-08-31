/* Community-lane UI primitives — local to routes/community/ so this
   lane never edits other lanes' files (same convention as routes/fam).
   Floors enforced once: ≥48px controls, ≥18px text via ts(), visible
   focus, state never colour alone. */

import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

/* `embedded`: this screen also renders INSIDE Home, and a screen inside
   another screen must stop behaving like a page.

   Two things went wrong while it did. It emitted a second <main>, so
   Home shipped two main landmarks — invalid, and a screen reader
   announces both. And it re-applied the 16px page inset on top of
   Home's own, so a post card sat 32px in while .sb-bleed could only
   pull back 16: measured on Home the same cards that reach 0..0 on
   Community stopped at 16..16, which is exactly the gap the owner
   keeps seeing on the screen he opens first.

   Fixed at the cause rather than with a viewport-width trick, because
   the nesting is the bug. Embedded it is a plain <div> with no inset;
   the host supplies both. */
export function CommunityScreen({ children, backTo, backLabel, width = 640, embedded = false }) {
  const { ts, meta } = useI18n();
  const Tag = embedded ? "div" : "main";
  return (
    <Tag
      className="sb-community"
      style={{
        minHeight: embedded ? undefined : "100vh",
        background: embedded ? undefined : C.bg,
        color: C.textMain,
        /* The page keeps its gutter and the cards escape it — see
           .sb-bleed in lib/i18n.jsx. Embedded, the host owns both. */
        padding: embedded ? 0 : "0 16px 64px",
      }}
    >
      <style>{`
        .sb-community *, .sb-community *::before, .sb-community *::after { box-sizing: border-box; }
        .sb-community input, .sb-community textarea {
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
        .sb-community textarea { resize: vertical; }
        .sb-community input:focus-visible,
        .sb-community textarea:focus-visible,
        .sb-community button:focus-visible,
        .sb-community a:focus-visible {
          outline: 3px solid ${C.greenMuted};
          outline-offset: 2px;
        }
        .sb-community ::placeholder { color: ${C.textMuted}; opacity: 0.8; }
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
    </Tag>
  );
}

/* Extra props (className, ref, data-*) pass through so the feedback
   layer can mark a freshly created card; a component that swallows
   them makes the highlight silently do nothing. */
/* A post, and the composer, and anything else that used to be a card.

   NO BORDER, NO CORNER, NO SIDE MARGIN — the owner's ruling of 30
   August and NAVIGATION_SPEC §4.1's one rule: an outline means "you
   can tap this" and nothing else. A post is not tappable, so a post
   has no outline.

   It bleeds to both screen edges. A 20px radius inset 16px from each
   side spent 32px of a 390px phone on gutter and drew a box around
   something nobody can press. Posts are separated from each other by
   the grey ground showing through, which is what the near-white
   background in §0.5 is FOR — on cream, white-on-cream was too close
   to read as a gap, which is why the border existed in the first
   place. Change the ground and the border becomes unnecessary rather
   than merely unfashionable. */
export function Card({ children, style, className, ...rest }) {
  return (
    <section
      {...rest}
      /* sb-bleed: this is a surface, so it reaches both edges. The
         page around it keeps its inset for text and controls. */
      className={["sb-bleed", className].filter(Boolean).join(" ")}
      style={{
        background: C.white,
        padding: "14px 16px",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function BodyText({ children, muted, style, className, ...props }) {
  const { ts } = useI18n();
  return (
    <p
      {...props}
      /* SELECTABLE, ALWAYS. The shell makes chrome unselectable so a
         long press on a button stops opening the selection ribbon —
         and body text is, by definition, not chrome. Marking it here
         rather than at call sites is the difference between the rule
         holding everywhere and holding on the one branch I remembered:
         the first version tagged a single post body inside a ternary,
         and the class was absent from the rendered page entirely. */
      className={["sb-selectable", className].filter(Boolean).join(" ")}
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

export function Toast({ text, actionLabel, onAction }) {
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
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ flex: 1 }}>{text}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          style={{
            minHeight: A11Y.minTapTargetPx,
            background: "none",
            border: "none",
            color: C.cream,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            fontFamily: "inherit",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
