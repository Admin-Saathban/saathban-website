/* ════════════════════════════════════════════════
   Saath-Icon home — /app/home/log.

   Top to bottom: calendar strip, greeting + character, today's log card
   (each item carrying its streak control), and "Your days" — the one
   headline number, days with Saathban, which never resets. Nothing here
   is scored: the points card that stood below the log is gone, and so
   are its "of 10" and the badge bar.

   Logs read from and write to Supabase daily_logs through logStore.js
   for the signed-in Icon — offline-first, with a localStorage queue
   that syncs on reconnect. Today and the two days behind it are
   editable (48-hour backfill window); older days are settled.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  MOCK_ICON,
  characterLine,
  greetingKeyForHour,
  daysAgo,
  isoDate,
} from "./homeMock.js";
import CalendarStrip from "./CalendarStrip.jsx";
import GreetingCharacter from "./GreetingCharacter.jsx";
import DailyLogCard, { dayEntries, isEntryDone } from "./DailyLogCard.jsx";
import CompanyLine from "./CompanyLine.jsx";
import { useIconPrefs, useIconPrefsStatus } from "../../lib/iconPrefs.js";
import { useSession } from "../../lib/session.jsx";
import { useDailyLogs } from "./logStore.js";
import { pushToast } from "../../lib/feedback.jsx";
import YourDays from "../streaks/YourDays.jsx";
import { refreshStreaks, useMyStreaks } from "../streaks/streaksData.js";
import ConnectionLine from "./ConnectionLine.jsx";

// Weekday and month names come from Intl for the active language.
const dateLocaleFor = (lang) => (lang === "ur" ? "ur-PK" : "en-GB");

const css = `
  .ih-root, .ih-root * { box-sizing: border-box; }
  .ih-root { -webkit-font-smoothing: antialiased; }
  .ih-root button { -webkit-tap-highlight-color: transparent; }
  .ih-root :focus-visible { outline: 3px solid ${C.green}; outline-offset: 2px; }
  .ih-root textarea::placeholder { color: ${C.textMuted}; opacity: 1; }
  .ih-card { animation: ihFadeUp 0.45s ease both; }
  .ih-card:nth-child(2) { animation-delay: 0.05s; }
  .ih-card:nth-child(3) { animation-delay: 0.1s; }
  .ih-card:nth-child(4) { animation-delay: 0.15s; }
  @keyframes ihFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ih-root *, .ih-card { animation: none !important; transition: none !important; }
  }
`;

export default function IconHome() {
  const { t, ts, lang, meta } = useI18n();
  const dateLocale = dateLocaleFor(lang);
  const { profile, profileFresh, profileRefreshFailed } = useSession();
  // RequireAuth guarantees an Icon profile here; the fallback only
  // covers the first render of edge navigations.
  const iconId = profile?.id ?? null;
  const firstName = (profile?.full_name || MOCK_ICON.firstName).split(" ")[0];

  const { logsByDate, writeEntry, status, pendingCount, flushNow } = useDailyLogs(iconId);
  const [selectedOffset, setSelectedOffset] = useState(0);

  const prefs = useIconPrefs(iconId);
  const prefsStatus = useIconPrefsStatus(iconId);
  const { fresh: streaksFresh, failed: streaksFailed } = useMyStreaks(iconId);
  const fresh = profileFresh && prefsStatus === "ready" && status === "ready" && streaksFresh;
  const failed = profileRefreshFailed || prefsStatus === "local" || status === "local" || streaksFailed;
  const logFor = (offset) => logsByDate[isoDate(daysAgo(-offset))] || {};
  const todayLog = logFor(0);
  // Rest day lives in daily_logs since 0017 gave log_module a
  // 'rest_day' value — resting IS participation.
  const restToday = !!todayLog.rest_day?.on;
  const toggleRest = () =>
    writeEntry(isoDate(new Date()), "rest_day", { on: !restToday });
  const todayEntries = dayEntries(prefs, new Date());
  const doneToday = todayEntries.filter((e) => isEntryDone(e, todayLog)).length;

  /* When the queue drains the server has the day's rows, so the runs,
     today's values and the days with Saathban are asked for again. */
  useEffect(() => {
    if (iconId && pendingCount === 0 && status !== "loading") refreshStreaks();
  }, [iconId, pendingCount, status]);

  // Something logged on a given day — server rows and local writes alike.
  const anyLoggedOn = (offset) => {
    const log = logFor(offset);
    return dayEntries(prefs, daysAgo(-offset)).some((e) => isEntryDone(e, log));
  };

  // Consecutive empty days just before today, for the welcome-back tone.
  const missedDays = useMemo(() => {
    let n = 0;
    for (let off = -1; off >= -6; off--) {
      if (anyLoggedOn(off)) break;
      n++;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsByDate, prefs]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const offset = i - 6;
        return {
          offset,
          date: daysAgo(-offset),
          logged: offset === 0 ? doneToday > 0 : anyLoggedOn(offset),
          restDay: offset === 0 && restToday,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logsByDate, doneToday, restToday, prefs]
  );

  const now = new Date();
  const selectedDate = daysAgo(-selectedOffset);
  const dayLabel =
    selectedOffset === 0
      ? t("home.todayLower")
      : selectedOffset === -1
      ? t("home.yesterdayLower")
      : selectedDate.toLocaleDateString(dateLocale, { weekday: "long" });

  const lineSpec = characterLine({
    moodId: todayLog.mood?.choice,
    doneCount: doneToday,
    missedDays,
    firstName,
    restDay: restToday,
  });
  const line = t(lineSpec.key, lineSpec.vars);

  /* A log entry announces itself the moment it becomes complete —
     once per module per day, so editing a note doesn't chatter. */
  const announced = useRef(new Set());
  const updateLog = (moduleKey, value) => {
    const dateIso = isoDate(selectedDate);
    const entry = todayEntries.find((e) => e.key === moduleKey) || {
      kind: moduleKey.startsWith("tracker:") ? "tracker" : "module",
      key: moduleKey,
      id: moduleKey,
    };
    const was = isEntryDone(entry, logFor(selectedOffset));
    writeEntry(dateIso, moduleKey, value);
    const nowDone = isEntryDone(entry, { [moduleKey]: value });
    const stamp = `${dateIso}|${moduleKey}`;
    if (!was && nowDone && !announced.current.has(stamp)) {
      announced.current.add(stamp);
      const name =
        entry.kind === "tracker"
          ? entry.name || t("hub.todaysLog")
          : t(`settings.dailyLog.modules.${moduleKey}`);
      pushToast(t("feedback.logSaved", { module: name }));
    }
  };

  return (
    <>
      <main
        className="ih-root"
        style={{
          minHeight: "100vh",
          background: C.bg,
          fontFamily: meta.fonts.body,
          color: C.textMain,
          fontSize: ts(A11Y.minBodyPx),
        }}
      >
      <style>{css}</style>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 56px" }}>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 10px", fontWeight: 500 }}>
          {now.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" })}
        </p>

        <div className="ih-card">
          <CalendarStrip
            days={days}
            selectedOffset={selectedOffset}
            onSelect={setSelectedOffset}
          />
        </div>

        <div className="ih-card">
          <GreetingCharacter
            greeting={t(greetingKeyForHour(now.getHours()))}
            name={firstName}
            line={line}
          />
        </div>

        {selectedOffset < 0 && (
          <p
            style={{
              fontSize: ts(A11Y.minBodyPx),
              lineHeight: 1.5,
              color: C.brown,
              background: "rgba(255,255,255,0.7)",
              border: `2px solid ${C.warmGray}`,
              borderRadius: 14,
              padding: "12px 16px",
              margin: "0 0 14px",
            }}
          >
            {t("home.backfillNote", { day: dayLabel })}{" "}
            <button
              type="button"
              onClick={() => setSelectedOffset(0)}
              style={{
                minHeight: 48,
                background: "none",
                border: "none",
                padding: "0 4px",
                color: C.green,
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 700,
                fontFamily: "inherit",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {t("home.backToToday")}
            </button>
          </p>
        )}

        <div className="ih-card">
          <DailyLogCard
            key={selectedOffset}
            iconId={iconId}
            log={logFor(selectedOffset)}
            onChange={updateLog}
            editable={selectedOffset >= -2}
            restDay={selectedOffset === 0 && restToday}
            dayLabel={dayLabel}
            isToday={selectedOffset === 0}
            date={selectedDate}
            flushLogs={flushNow}
          />
        </div>

        {/* Sync standing — only speaks when something is still on its way.
            A fact about the device, never a worry about the person. */}
        {/* Only while something is actually waiting to be sent: "no
            connection" on its own is the ConnectionLine's to say, and
            saying it twice is noise. */}
        {pendingCount > 0 && (
          <p
            role="status"
            style={{
              fontSize: ts(A11Y.minBodyPx),
              lineHeight: 1.5,
              color: C.textMuted,
              margin: "-8px 0 14px",
              paddingInlineStart: 4,
            }}
          >
            {t("home.savedOffline")}
          </p>
        )}

        <div className="ih-card">
          <YourDays restDay={restToday} onToggleRest={toggleRest} editable />
        </div>

        {/* §5's social third, and it goes LAST — never in the middle.
            It renders nothing at all for somebody with nobody: a section
            that would be empty is absent, not an empty box announcing a
            gap. */}
        <CompanyLine iconId={iconId} />

        {/* Fixed above the bar, with its spacer here at the very end,
            so it never moves anything above it. */}
        <ConnectionLine fresh={fresh} failed={failed} />
      </div>
      </main>
    </>
  );
}
