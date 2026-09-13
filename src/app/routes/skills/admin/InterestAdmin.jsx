/* ════════════════════════════════════════════════
   Grow admin — "Tell me when this opens" counts (0012).

   How many people asked to be told when each section opens. Aggregates
   only, from skill_interest_counts() (admin-only at the database) —
   never who.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { STRINGS, SKILLS } from "../strings.js";
import { fetchCounts } from "../data.js";
import { Notice, useAdminStyles } from "./ui.jsx";

export default function InterestAdmin() {
  const { lang, ts } = useI18n();
  const st = STRINGS[lang] || STRINGS.en;
  const a = st.admin;
  const s = useAdminStyles();
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchCounts()
      .then((c) => alive && setCounts(c))
      .catch(() => alive && setError(a.loadError));
    return () => {
      alive = false;
    };
  }, [a.loadError]);

  return (
    <section data-admin-tab="interest">
      <h2 style={s.h2}>{a.title}</h2>
      <p style={s.muted}>{a.subtitle}</p>
      {error && <Notice tone="error">{error}</Notice>}
      {counts === null ? (
        <p aria-busy="true" style={s.muted}>···</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {SKILLS.map((skill) => {
            const card = st.cards[skill];
            const n = counts[skill] || 0;
            return (
              <li
                key={skill}
                data-interest={skill}
                style={{ ...s.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, margin: 0 }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                  <span aria-hidden="true" style={{ fontSize: ts(26) }}>{card.emoji}</span>
                  <span style={{ fontSize: ts(19), fontWeight: 700 }}>{card.name}</span>
                </span>
                <span
                  style={{
                    fontSize: ts(17),
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
    </section>
  );
}
