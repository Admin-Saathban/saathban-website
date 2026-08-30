/* ════════════════════════════════════════════════
   Three doors that must not need a menu — TONIGHT.md LANE 2 §4.

   Out & about, Friend groups and Grow with Saathban. The user wants
   them more reachable than More allows, and does not want the bottom
   bar overloaded — so they sit on Home, under the day's things and
   above the feed, as three labelled entries.

   LABELLED, NEVER ICON-ALONE. The same rule as the bottom bar (§3):
   an emoji is a decoration a person may or may not read, and three
   unlabelled tiles is a puzzle. Each says what it is.

   THEY STAY IN More AS WELL, deliberately. navItems.js exists so the
   bar and the More screen can never disagree about what exists, and
   removing these three from More to avoid "duplication" would mean a
   person who learned the menu now cannot find them. Two ways to the
   same room is not a defect; two rooms that look like one is, and that
   was §1's complaint.
   ════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

const DOORS = [
  { to: "/app/outdoor", key: "hub.outdoor", emoji: "🌳" },
  { to: "/app/groups", key: "hub.groups", emoji: "🧑‍🤝‍🧑" },
  { to: "/app/skills", key: "hub.grow", emoji: "🌱" },
];

export default function HomeStrip() {
  const { t, ts, meta } = useI18n();
  return (
    <nav
      aria-label={t("hub.stripLabel")}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        margin: "0 0 18px",
      }}
    >
      {DOORS.map((d) => (
        <Link
          key={d.to}
          to={d.to}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            minHeight: 84,
            padding: "10px 6px",
            borderRadius: 18,
            border: `2px solid ${C.warmGray}`,
            background: C.white,
            color: C.textMain,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>{d.emoji}</span>
          <span
            style={{
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 600,
              lineHeight: 1.25,
              fontFamily: meta.fonts.body,
            }}
          >
            {t(d.key)}
          </span>
        </Link>
      ))}
    </nav>
  );
}
