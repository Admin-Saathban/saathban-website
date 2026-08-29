/* ════════════════════════════════════════════════
   Skills — admin interest counts. A simple page showing how many
   people asked to be told when each skill opens. Aggregates only,
   from the skill_interest_counts() RPC (admin-only at the database;
   non-admins get zero rows).

   Gated in two places: this component redirects a non-admin, and the
   route should be registered behind RequireAuth roles={["admin"]}
   (SKILLS_WIRING.md). RLS/RPC is the real boundary — the guard is
   navigation.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { STRINGS, SKILLS } from "./strings.js";
import { fetchCounts } from "./data.js";

export default function SkillsAdmin() {
  const { lang, ts, meta } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const a = s.admin;
  const { profile } = useSession();

  const [counts, setCounts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await fetchCounts();
        if (alive) setCounts(c);
      } catch {
        if (alive) setError(a.loadError);
      }
    })();
    return () => {
      alive = false;
    };
  }, [a.loadError]);

  // Defence in depth: a non-admin should never be routed here, but if they
  // are, don't render the page (the RPC would return nothing anyway).
  if (profile && profile.role !== "admin") {
    return <Navigate to="/app/skills" replace />;
  }

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
          {a.title}
        </h1>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 22px", lineHeight: 1.6 }}>
          {a.subtitle}
        </p>

        {error && (
          <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.error, fontWeight: 600 }}>{error}</p>
        )}

        {counts === null ? (
          <p aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>···</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {SKILLS.map((skill) => {
              const card = s.cards[skill];
              const n = counts[skill] || 0;
              return (
                <li
                  key={skill}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    background: C.white,
                    border: `1px solid ${C.warmGray}`,
                    borderRadius: 16,
                    padding: "16px 20px",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                    <span aria-hidden="true" style={{ fontSize: ts(26) }}>{card.emoji}</span>
                    <span style={{ fontSize: ts(20), fontWeight: 700 }}>{card.name}</span>
                  </span>
                  <span
                    style={{
                      fontSize: ts(A11Y.minBodyPx),
                      fontWeight: 700,
                      color: n > 0 ? C.green : C.textMuted,
                      background: n > 0 ? "#e8f0e6" : C.cream,
                      border: `1px solid ${n > 0 ? C.sage : C.warmGray}`,
                      borderRadius: 50,
                      padding: "6px 16px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.countLabel(n)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
