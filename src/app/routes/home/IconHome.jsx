/* ════════════════════════════════════════════════
   Saath-Icon home — /app/home (build step 9, UI on mock data).

   Layout follows SPEC.md top to bottom: calendar strip, greeting +
   character, today's log card, today's score + sharing. The Outdoor,
   Skills, Events and Community rows belong to their own build steps
   and are not built here.

   All data comes from homeMock.js — no Supabase calls yet. State is
   per-day: today and the two days behind it are editable (48-hour
   backfill window); older days are settled.
   ════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { COLORS as C, FONTS } from "../../../shared/tokens.js";
import {
  MOCK_ICON,
  MOCK_PAST_DAYS,
  POINTS_PER_MODULE,
  MOCK_LIFETIME_POINTS,
  characterLine,
  greetingForHour,
  daysAgo,
} from "./homeMock.js";
import CalendarStrip from "./CalendarStrip.jsx";
import GreetingCharacter from "./GreetingCharacter.jsx";
import DailyLogCard, { dayEntries, isEntryDone } from "./DailyLogCard.jsx";
import ScoreShare from "./ScoreShare.jsx";
import { useIconPrefs } from "../../lib/iconPrefs.js";

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  // Logs the Icon writes this session, keyed by day offset (0 = today).
  const [logsByOffset, setLogsByOffset] = useState({ 0: {}, "-1": {}, "-2": {} });
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [restToday, setRestToday] = useState(false);

  const prefs = useIconPrefs();
  const todayLog = logsByOffset[0];
  const todayEntries = dayEntries(prefs, new Date());
  const doneToday = todayEntries.filter((e) => isEntryDone(e, todayLog)).length;
  const pointsToday = doneToday * POINTS_PER_MODULE;

  // Something logged on a given (possibly backfilled) day this session?
  const anyLoggedOn = (offset) => {
    const log = logsByOffset[offset] || {};
    return dayEntries(prefs, daysAgo(-offset)).some((e) => isEntryDone(e, log));
  };

  // Consecutive empty days just before today, for the welcome-back tone.
  const missedDays = useMemo(() => {
    let n = 0;
    for (let off = -1; off >= -6; off--) {
      const past = MOCK_PAST_DAYS[String(off)];
      if (anyLoggedOn(off) || (past && (past.modulesLogged > 0 || past.restDay))) break;
      n++;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsByOffset, prefs]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const offset = i - 6;
        const past = MOCK_PAST_DAYS[String(offset)];
        return {
          offset,
          date: daysAgo(-offset),
          logged:
            offset === 0
              ? doneToday > 0
              : anyLoggedOn(offset) || (past?.modulesLogged || 0) > 0,
          restDay: offset === 0 ? restToday : !!past?.restDay,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logsByOffset, doneToday, restToday, prefs]
  );

  const now = new Date();
  const selectedDate = daysAgo(-selectedOffset);
  const dayLabel =
    selectedOffset === 0
      ? "today"
      : selectedOffset === -1
      ? "yesterday"
      : WEEKDAY_LONG[selectedDate.getDay()];

  const line = characterLine({
    moodId: todayLog.mood?.choice,
    doneCount: doneToday,
    missedDays,
    firstName: MOCK_ICON.firstName,
    restDay: restToday,
  });

  const updateLog = (moduleId, value) =>
    setLogsByOffset((prev) => ({
      ...prev,
      [selectedOffset]: { ...prev[selectedOffset], [moduleId]: value },
    }));

  return (
    <main
      className="ih-root"
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: FONTS.sans,
        color: C.textMain,
        fontSize: 18,
      }}
    >
      <style>{css}</style>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 56px" }}>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 10px", fontWeight: 500 }}>
          {WEEKDAY_LONG[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
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
            greeting={greetingForHour(now.getHours())}
            name={MOCK_ICON.firstName}
            line={line}
          />
        </div>

        {selectedOffset < 0 && (
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.5,
              color: C.brown,
              background: "rgba(255,255,255,0.7)",
              border: `2px solid ${C.warmGray}`,
              borderRadius: 14,
              padding: "12px 16px",
              margin: "0 0 14px",
            }}
          >
            You're adding to {dayLabel}'s log — life happens, and later is fine.{" "}
            <button
              type="button"
              onClick={() => setSelectedOffset(0)}
              style={{
                minHeight: 48,
                background: "none",
                border: "none",
                padding: "0 4px",
                color: C.green,
                fontSize: 18,
                fontWeight: 700,
                fontFamily: FONTS.sans,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Back to today
            </button>
          </p>
        )}

        <div className="ih-card">
          <DailyLogCard
            key={selectedOffset}
            log={logsByOffset[selectedOffset] || {}}
            onChange={updateLog}
            editable={selectedOffset >= -2}
            restDay={selectedOffset === 0 && restToday}
            dayLabel={dayLabel}
            date={selectedDate}
          />
        </div>

        <div className="ih-card">
          <ScoreShare
            points={pointsToday}
            doneCount={doneToday}
            totalModules={todayEntries.length}
            lifetimePoints={MOCK_LIFETIME_POINTS}
            restDay={restToday}
            onToggleRest={() => setRestToday((r) => !r)}
            editable
            circleMembers={MOCK_ICON.circleMembers}
          />
        </div>
      </div>
    </main>
  );
}
