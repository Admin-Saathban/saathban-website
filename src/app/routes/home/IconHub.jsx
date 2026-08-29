/* ════════════════════════════════════════════════
   /app/home — the Saath-Icon hub, the after-sign-in landing.

   Greeting + today-at-a-glance (log summary, today's reminders), then
   large cards to everywhere an Icon goes: Today's log first and one
   tap away, then Community, Events, Skills, Notifications, Profile,
   Settings. My Circle appears only once the circle has a member or a
   pending request (SPEC.md: circle stays out of main navigation until
   it has a member — Settings remains its permanent home).

   The AppHeader mark lands here for Icons (roleHomePath → /app/home).
   Cards keep the accessibility floors: ≥48px targets, ≥18px text,
   meaning never carried by colour alone.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { useIconPrefs } from "../../lib/iconPrefs.js";
import { useDailyLogs } from "./logStore.js";
import { dayEntries, isEntryDone } from "./DailyLogCard.jsx";
import { greetingKeyForHour, isoDate, POINTS_PER_MODULE } from "./homeMock.js";
import AppHeader from "../../components/AppHeader.jsx";
import supabase from "../../lib/supabase.js";
import { awardMyBadges, fetchMyEarnedBadges } from "../../lib/points.js";

/* Notifications and Settings live in the AppHeader (bell + links) —
   the hub keeps cards for the places, not the chrome. */
const CARDS = [
  { to: "/app/community", emoji: "🪷", key: "hub.community" },
  { to: "/app/events", emoji: "🎪", key: "hub.events" },
  { to: "/app/skills", emoji: "🌱", key: "hub.skills" },
  { to: "/app/milestones", emoji: "🏅", key: "hub.milestones" },
  { to: "/app/outdoor", emoji: "🌳", key: "hub.outdoor" },
  { to: "/app/profile", emoji: "🙂", key: "hub.profile" },
];

export default function IconHub() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const iconId = profile?.id ?? null;
  const firstName = (profile?.full_name || "").split(" ")[0];

  const prefs = useIconPrefs();
  const { logsByDate } = useDailyLogs(iconId);
  const todayLog = logsByDate[isoDate(new Date())] || {};
  const entries = dayEntries(prefs, new Date());
  const done = entries.filter((e) => isEntryDone(e, todayLog)).length;

  const [reminders, setReminders] = useState([]);
  const [hasCircle, setHasCircle] = useState(false);
  const [unseenBadges, setUnseenBadges] = useState(0);

  // Celebration hook: catch-up award, then count unseen celebrations —
  // the Milestones card announces them; the screen itself plays them.
  useEffect(() => {
    if (!iconId) return undefined;
    let alive = true;
    (async () => {
      try {
        await awardMyBadges();
        const earned = await fetchMyEarnedBadges();
        if (alive) setUnseenBadges(earned.filter((b) => !b.seen_at).length);
      } catch {
        /* the hub never blocks on the celebration count */
      }
    })();
    return () => {
      alive = false;
    };
  }, [iconId]);

  useEffect(() => {
    if (!iconId) return undefined;
    let alive = true;
    (async () => {
      const [{ data: rem }, { data: members }, { data: invites }] = await Promise.all([
        supabase
          .from("reminders")
          .select("id, label, emoji, remind_times, days_label")
          .eq("icon_id", iconId)
          .order("remind_time"),
        supabase.from("circle_members").select("id").eq("icon_id", iconId).limit(1),
        supabase
          .from("circle_invites")
          .select("id")
          .eq("icon_id", iconId)
          .eq("direction", "member_to_icon")
          .is("used_at", null)
          .limit(1),
      ]);
      if (!alive) return;
      setReminders(rem || []);
      setHasCircle((members || []).length > 0 || (invites || []).length > 0);
    })();
    return () => {
      alive = false;
    };
  }, [iconId]);

  const fmtTime = (hms) => {
    const [h, m] = hms.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(meta.dir === "rtl" ? "ur-PK" : "en-GB", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const cardStyle = {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minHeight: 84,
    padding: "16px 20px",
    background: C.white,
    border: `2px solid ${C.warmGray}`,
    borderRadius: 18,
    textDecoration: "none",
    color: C.textMain,
  };

  return (
    <>
      <AppHeader />
      <main
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textMain,
          fontFamily: meta.fonts.body,
          padding: "20px 16px 56px",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(30),
              fontWeight: 700,
              color: C.green,
              margin: "6px 0 20px",
              lineHeight: Math.max(1.25, meta.lineHeight - 0.4),
            }}
          >
            {t(greetingKeyForHour(new Date().getHours()))}
            {firstName ? (meta.dir === "rtl" ? "، " : ", ") + firstName : ""}
          </h1>

          {/* ── Today's log, one tap away ── */}
          <Link
            to="/app/home/log"
            style={{
              ...cardStyle,
              border: `2.5px solid ${C.green}`,
              marginBottom: 14,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 34 }}>🌤️</span>
            <span style={{ flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: meta.fonts.heading,
                  fontSize: ts(22),
                  fontWeight: 700,
                  color: C.green,
                }}
              >
                {t("hub.todaysLog")}
              </span>
              <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                {done > 0
                  ? t("hub.logSummary", { done, total: entries.length, points: done * POINTS_PER_MODULE })
                  : t("hub.logEmpty")}
              </span>
            </span>
            <span aria-hidden="true" style={{ fontSize: ts(22), color: C.green, fontWeight: 700 }}>
              {meta.dir === "rtl" ? "‹" : "›"}
            </span>
          </Link>

          {/* ── Today's reminders ── */}
          {reminders.length > 0 && (
            <section
              style={{
                background: C.white,
                border: `2px solid ${C.warmGray}`,
                borderRadius: 18,
                padding: "16px 20px",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  fontFamily: meta.fonts.heading,
                  fontSize: ts(20),
                  fontWeight: 700,
                  color: C.brown,
                  margin: "0 0 10px",
                }}
              >
                {t("hub.reminders")}
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {reminders.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 10,
                      fontSize: ts(A11Y.minBodyPx),
                      lineHeight: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <span aria-hidden="true">{r.emoji}</span>
                    <span style={{ fontWeight: 600 }}>{r.label}</span>
                    <span dir="ltr" style={{ color: C.textMuted }}>
                      {(r.remind_times || []).map(fmtTime).join(" · ")}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: ts(15) }}>{r.days_label}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Everywhere else ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(hasCircle
              ? [...CARDS.slice(0, 3), { to: "/app/circle", emoji: "🤝", key: "hub.circle" }, ...CARDS.slice(3)]
              : CARDS
            ).map((c) => {
              const celebrating = c.key === "hub.milestones" && unseenBadges > 0;
              return (
                <Link
                  key={c.to}
                  to={c.to}
                  style={{
                    ...cardStyle,
                    minHeight: 96,
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 6,
                    textAlign: "center",
                    ...(celebrating ? { border: `2.5px solid ${C.green}` } : {}),
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 30 }}>
                    {celebrating ? "🎉" : c.emoji}
                  </span>
                  <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>{t(c.key)}</span>
                  {celebrating && (
                    <span style={{ fontSize: ts(15), color: C.green, fontWeight: 700 }}>
                      {t("hub.celebrate")}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
