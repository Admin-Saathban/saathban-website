/* ════════════════════════════════════════════════
   Badges — /app/badges. NAVIGATION_SPEC §6, row 4.

   The More row pointed here and nothing was mounted on it. It could
   have been redirected to /app/milestones, which already draws badges
   — but that route is guarded to saath_icon and admin, so for a Fam
   member the row would have been a door onto a redirect. That is the
   exact defect LANE 3 found on My Journey. A badge belongs to whoever
   earned it, and earned_badges is scoped by RLS to its owner, so this
   screen is simply everyone's.

   PRODUCT_DECISIONS §9 governs what may appear: participation, never
   performance. There is no count of other people here, no rank, no
   "top", and nothing compares two lives. Unearned badges are drawn as
   things still ahead — doors, never locks — which is why they keep
   their name and their description instead of being greyed to a
   question mark.

   Family is shown by SHAPE, COLOUR AND A WORD together (§0.1). The
   shapes alone are a code you have to have been taught.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { fetchBadgeDefinitions, fetchMyEarnedBadges } from "../../lib/points.js";
import AppHeader from "../../components/AppHeader.jsx";
import { arrivalClass } from "../../components/motion.jsx";
import { familyOfKind, FAMILY_LABEL_KEY } from "./badgeFamilies.js";

function Medal({ family, emoji, earned }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 52,
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 26,
        lineHeight: 1,
        borderRadius: family.radius,
        background: earned ? family.fill : "transparent",
        border: `2.5px ${earned ? "solid" : "dashed"} ${family.ring}`,
        /* Not earned yet is drawn lighter, never hidden and never
           replaced by a lock: §9 says the ones ahead are doors. */
        opacity: earned ? 1 : 0.55,
      }}
    >
      {emoji}
    </span>
  );
}

function BadgeRow({ badge, earnedAt, lang, ts, meta, t, dateLocale }) {
  const family = familyOfKind(badge.trigger_kind);
  const earned = Boolean(earnedAt);
  const name = lang === "ur" ? badge.name_ur : badge.name_en;
  const desc = lang === "ur" ? badge.desc_ur : badge.desc_en;
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 4px",
        /* §4.1 — an outline means you can tap it. This is a list of
           facts, not of buttons, so it separates by whitespace. */
        borderBottom: `1px solid ${C.warmGray}`,
      }}
    >
      <Medal family={family} emoji={badge.emoji} earned={earned} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontFamily: meta.fonts.heading,
            fontSize: ts(18),
            fontWeight: 700,
            color: earned ? C.textMain : C.textMuted,
          }}
        >
          {name}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: ts(15), lineHeight: 1.45, color: C.textMuted }}>
          {desc}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: ts(13), color: C.textMuted, fontWeight: 600 }}>
          {t(FAMILY_LABEL_KEY[family.id])}
          {earned && earnedAt
            ? ` · ${t("badges.earnedOn", {
                date: new Date(earnedAt).toLocaleDateString(dateLocale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })}`
            : ""}
        </p>
      </div>
    </li>
  );
}

export default function BadgesPage() {
  const { t, ts, lang, meta } = useI18n();
  const { state } = useLocation();
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  const [defs, setDefs] = useState(null);
  const [earned, setEarned] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchBadgeDefinitions(), fetchMyEarnedBadges()])
      .then(([d, e]) => {
        if (!alive) return;
        setDefs(d);
        setEarned(e);
      })
      .catch(() => alive && setDefs([]));
    return () => {
      alive = false;
    };
  }, []);

  const earnedAtOf = new Map(earned.map((e) => [e.badge_key, e.earned_at]));
  const mine = (defs || []).filter((b) => earnedAtOf.has(b.key));
  const ahead = (defs || []).filter((b) => !earnedAtOf.has(b.key));

  const heading = {
    fontFamily: meta.fonts.heading,
    fontSize: ts(20),
    fontWeight: 700,
    color: C.green,
    margin: "22px 0 2px",
  };

  return (
    <>
      <AppHeader />
      <main
        className={arrivalClass(state)}
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textMain,
          fontFamily: meta.fonts.body,
          padding: "16px 16px 80px",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(26),
              fontWeight: 700,
              color: C.green,
              margin: "0 0 4px",
            }}
          >
            {t("badges.title")}
          </h1>
          <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 6px", lineHeight: 1.5 }}>
            {t("badges.intro")}
          </p>

          {defs === null ? null : (
            <>
              {/* §0.6 — a section that would be empty is absent. With
                  nothing earned the page says so once, in its own
                  words, instead of drawing an empty heading. */}
              {mine.length > 0 ? (
                <>
                  <h2 style={heading}>{t("badges.yours")}</h2>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {mine.map((b) => (
                      <BadgeRow
                        key={b.key}
                        badge={b}
                        earnedAt={earnedAtOf.get(b.key)}
                        {...{ lang, ts, meta, t, dateLocale }}
                      />
                    ))}
                  </ul>
                </>
              ) : (
                <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "18px 0 0", lineHeight: 1.55 }}>
                  {t("badges.none")}
                </p>
              )}

              {ahead.length > 0 && (
                <>
                  <h2 style={heading}>{t("badges.ahead")}</h2>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {ahead.map((b) => (
                      <BadgeRow
                        key={b.key}
                        badge={b}
                        earnedAt={null}
                        {...{ lang, ts, meta, t, dateLocale }}
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
