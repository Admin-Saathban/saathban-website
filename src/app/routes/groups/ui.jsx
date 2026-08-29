/* Groups-lane UI primitives — local so the lane owns its look. Floors:
   ≥18px text via ts(), ≥48px targets, visible focus, state in words. */

import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

export function Screen({ children, backTo, backLabel, width = 680 }) {
  const { ts, meta } = useI18n();
  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <style>{`.sb-groups input, .sb-groups textarea, .sb-groups select {
        width:100%; min-height:${A11Y.minTapTargetPx}px; font-size:calc(${A11Y.minBodyPx}px * var(--sb-text-scale,1));
        font-family:inherit; color:${C.textMain}; background:${C.white}; border:2px solid ${C.warmGray};
        border-radius:12px; padding:10px 14px; box-sizing:border-box; }
        .sb-groups :focus-visible { outline:3px solid ${C.greenMuted}; outline-offset:2px; }`}</style>
      <div className="sb-groups" style={{ maxWidth: width, margin: "0 auto" }}>
        {backTo && (
          <Link to={backTo} style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, fontSize: ts(A11Y.minBodyPx), color: C.brown, textDecoration: "none", fontWeight: 600 }}>
            <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>{meta.dir === "rtl" ? "→" : "←"}</span>
            {backLabel}
          </Link>
        )}
        {children}
      </div>
    </main>
  );
}

export function H1({ children }) {
  const { ts, meta } = useI18n();
  return <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "8px 0 6px" }}>{children}</h1>;
}

export function Card({ children, style }) {
  return <section style={{ background: C.white, border: `1px solid ${C.warmGray}`, borderRadius: 18, padding: 20, marginBottom: 16, ...style }}>{children}</section>;
}

export function BodyText({ children, muted, style, ...rest }) {
  const { ts } = useI18n();
  return <p {...rest} style={{ fontSize: ts(A11Y.minBodyPx), lineHeight: 1.6, color: muted ? C.textMuted : C.textMain, margin: "0 0 10px", ...style }}>{children}</p>;
}

export function SectionLabel({ children }) {
  const { ts } = useI18n();
  return <p style={{ fontSize: ts(15), fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.greenMuted, margin: "22px 0 12px" }}>{children}</p>;
}

export function Pill({ children, tone = "neutral" }) {
  const { ts } = useI18n();
  const tones = { neutral: { bg: C.cream, fg: C.textMuted, bd: C.warmGray }, green: { bg: "#e8f0e6", fg: C.green, bd: C.sage }, brown: { bg: "#f3e9df", fg: C.brown, bd: "#d9c3b2" } };
  const t = tones[tone] || tones.neutral;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: ts(15), fontWeight: 600, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 50, padding: "5px 13px" }}>{children}</span>;
}

export function PrimaryBtn({ children, style, ...props }) {
  const { ts } = useI18n();
  return <button type="button" {...props} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 56, padding: "0 26px", borderRadius: 50, border: "none", background: C.green, color: C.cream, fontSize: ts(19), fontWeight: 600, fontFamily: "inherit", cursor: "pointer", opacity: props.disabled ? 0.6 : 1, ...style }}>{children}</button>;
}

export function GhostBtn({ children, style, ...props }) {
  const { ts } = useI18n();
  return <button type="button" {...props} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: A11Y.minTapTargetPx, padding: "0 18px", borderRadius: 50, border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, fontFamily: "inherit", cursor: "pointer", opacity: props.disabled ? 0.6 : 1, ...style }}>{children}</button>;
}
