/* ════════════════════════════════════════════════
   AreaCards — the hub-style navigation card grid, shared by every
   role's home (Icon hub, Fam dashboard, Buddy home).

   Rule (user direction, 2026-08-29): every role's home must surface
   everything that role can reach — no area may exist only behind a
   deep link. Cards take {to, emoji, key} where key is a hub.* locale
   key; style matches the Icon hub exactly (48px+ targets, 18px+
   labels, meaning never colour-only).
   ════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";

export default function AreaCards({ cards }) {
  const { t, ts } = useI18n();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {cards.map((c) => (
        <Link
          key={c.to}
          to={c.to}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 96,
            padding: "16px 20px",
            background: C.white,
            border: `2px solid ${C.warmGray}`,
            borderRadius: 18,
            textDecoration: "none",
            color: C.textMain,
            textAlign: "center",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 30 }}>{c.emoji}</span>
          <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>{t(c.key)}</span>
        </Link>
      ))}
    </div>
  );
}
