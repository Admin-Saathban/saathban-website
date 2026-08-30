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
import { useDailyLogs , DB_MODULES } from "./logStore.js";
import { dayEntries, isEntryDone } from "./DailyLogCard.jsx";
import { greetingKeyForHour, isoDate } from "./homeMock.js";
import AppHeader from "../../components/AppHeader.jsx";
import supabase from "../../lib/supabase.js";
import {
  awardMyBadges,
  fetchMyEarnedBadges,
  fetchMyProgress,
  estimatePointsToday,
} from "../../lib/points.js";
import YourTurnChips from "../games/YourTurnChips.jsx";
import TodayReminders from "./TodayReminders.jsx";
import Feed from "../community/Feed.jsx";
import HomeStrip from "./HomeStrip.jsx";

/* Notifications, Settings, and My profile live in the AppHeader —
   the hub keeps cards for the places, not the chrome. My Circle is
   always here: an empty circle is a door to open, never a gap
   (SPEC.md, "The empty circle" — the page itself renders the door). */

export default function IconHub() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const iconId = profile?.id ?? null;
  const firstName = (profile?.full_name || "").split(" ")[0];

  const prefs = useIconPrefs(profile?.id);
  const { logsByDate } = useDailyLogs(iconId);
  const todayLog = logsByDate[isoDate(new Date())] || {};
  const entries = dayEntries(prefs, new Date());
  const done = entries.filter((e) => isEntryDone(e, todayLog)).length;

  /* The same server-owned figure the log screen shows — the hub must
     not quote a different number for the same day. */
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchMyProgress()
      .then((p) => alive && setProgress(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const pointsToday =
    progress?.points_today ??
    estimatePointsToday(entries, todayLog, {
      cap: progress?.daily_cap ?? 60,
      isDone: isEntryDone,
      durableModules: DB_MODULES,
    });
  /* Catch-up award on arriving home. The unseen COUNT is gone with the
     Milestones card that announced it — badges, streaks and
     celebrations are all My Journey's now — but the award itself still
     belongs here, because this is the screen a person opens. */
  useEffect(() => {
    if (!iconId) return undefined;
    awardMyBadges().catch(() => {
      /* the hub never blocks on a celebration */
    });
    return undefined;
  }, [iconId]);



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

          {/* GAMES_WIRING §2: green "your move" chips when a table is
              waiting on this Icon; renders null otherwise. */}
          <YourTurnChips />

          {/* ── Today's log ──
              While anything is still to log it is the loudest thing on
              the screen. Once every enabled module for today is done it
              becomes a chip: still here, still one tap, but no longer
              asking. Enabling a module or a new day rolling over puts
              the full card back, because `entries` is recomputed from
              prefs and today's date on every render. */}
          {done >= entries.length && entries.length > 0 ? (
            <Link
              to="/app/home/log"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: A11Y.minTapTargetPx,
                padding: "0 16px",
                marginBottom: 14,
                borderRadius: 50,
                border: `1.5px solid ${C.green}`,
                background: C.white,
                color: C.green,
                textDecoration: "none",
                fontSize: ts(17),
                fontWeight: 700,
              }}
            >
              <span aria-hidden="true">✓</span>
              <span style={{ flex: 1 }}>
                {t("hub.logDoneChip", { n: entries.length })}
              </span>
              <span aria-hidden="true" style={{ color: C.textMuted, fontSize: ts(16), fontWeight: 600 }}>
                {t("hub.logChange")}
              </span>
            </Link>
          ) : (
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
                    ? t("hub.logSummary", { done, total: entries.length, points: pointsToday })
                    : t("hub.logEmpty")}
                </span>
              </span>
              <span aria-hidden="true" style={{ fontSize: ts(22), color: C.green, fontWeight: 700 }}>
                {meta.dir === "rtl" ? "‹" : "›"}
              </span>
            </Link>
          )}

          {/* ── Today's reminders, one at a time ── */}
          <TodayReminders iconId={iconId} />

          {/* ── §4: three doors that must not need a menu ──
              Out & about, Friend groups and Grow sit here, under the
              day's things and above the feed, as labelled entries. */}
          <HomeStrip />

          {/* ── And then the people ──
              THE REAL FEED, not a reader of it. TONIGHT.md §1: home
              and community were two places where the user expected
              one, so everything Community offered moves here —
              composer, Everyone/Friends filter, Connect, origin
              labels, automatic widening. A thinner second copy is what
              made them two screens in the first place. */}
          <Feed />
        </div>
      </main>
    </>
  );
}
