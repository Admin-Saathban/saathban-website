/* ════════════════════════════════════════════════
   My journey — /app/history. The Icon's own record, warm and
   judgement-free (SPEC: never guilt for gaps; rest days count;
   backfill marked gently, never as a fault).

   Four parts on one gentle scroll:
     1. a month calendar of logged days — tap a day for its detail
     2. presence: streak, days this month, rest days honoured
     3. the badge timeline, with any personal notes from Saathban
     4. trends (mood line, sleep bars) — the caller's own rows only,
        so nobody else can ever reach these, whatever is shared
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { MOODS } from "../home/homeMock.js";
import {
  fetchMonthLogs,
  fetchRecentLogs,
  recentMonthKeys,
  moodByMonth,
  dailySeries,
  presenceByDay,
  pointsByMonth,
  moduleSummary,
  monthKeyOf,
  fetchMyProgress,
  fetchBadgeDefinitions,
  fetchMyEarnedBadges,
  byDate,
  dayGlance,
  sleepHoursNumber,
} from "./historyData.js";
import { HistoryScreen, Card, BodyText, SectionLabel } from "./ui.jsx";
import JourneyAhead from "./JourneyAhead.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import {
  MoodMonths,
  DailyBars,
  PresenceHeat,
  PointsLine,
  ModuleSummaries,
} from "./JourneyVisuals.jsx";

const iso = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function JourneyPage() {
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null); // 'YYYY-MM-DD'
  const [progress, setProgress] = useState(null);
  const [badges, setBadges] = useState([]);
  const [defs, setDefs] = useState({});
  const [error, setError] = useState("");
  const [recent, setRecent] = useState(null); // the last six months of logs

  useEffect(() => {
    let alive = true;
    fetchMonthLogs(profile.id, ym.y, ym.m)
      .then((rows) => alive && setLogs(rows))
      .catch(() => alive && setError(t("history.loadError")));
    return () => {
      alive = false;
    };
  }, [profile.id, ym]);

  /* The longer view: six months in one query, aggregated on the
     client. Same own-rows-only rule as everything else here. */
  useEffect(() => {
    let alive = true;
    fetchRecentLogs(profile.id, 6)
      .then((rows) => alive && setRecent(rows))
      .catch(() => alive && setRecent([]));
    return () => {
      alive = false;
    };
  }, [profile.id]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchMyProgress(), fetchMyEarnedBadges(), fetchBadgeDefinitions()])
      .then(([p, earned, defList]) => {
        if (!alive) return;
        setProgress(p);
        setBadges(earned);
        setDefs(Object.fromEntries(defList.map((d) => [d.key, d])));
      })
      .catch(() => alive && setError(t("history.loadError")));
    return () => {
      alive = false;
    };
  }, []);

  const days = useMemo(() => byDate(logs), [logs]);
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const isThisMonth = ym.y === today.getFullYear() && ym.m === today.getMonth();
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString(dateLocale, {
    month: "long",
    year: "numeric",
  });
  // Monday-first column of the 1st.
  const lead = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  // 2026-08-24 is a Monday — weekday initials in the viewer's locale.
  const weekdayInitials = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 7, 24 + i).toLocaleDateString(dateLocale, { weekday: "narrow" })
  );

  const moodFace = (choice) => MOODS.find((x) => x.id === choice)?.face ?? "•";
  const monthPresence = Object.keys(days).length;
  const monthRest = Object.values(days).filter((rows) =>
    rows.some((r) => r.module === "rest_day" && r.payload?.on !== false)
  ).length;

  const selectedRows = selected ? days[selected] ?? [] : null;

  return (
    <HistoryScreen backTo="/app/home" backLabel={t("common.backToHome")}>
      <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(30), margin: "0 0 6px", color: C.green }}>
        📖 {t("history.title")}
      </h1>
      <BodyText muted>{t("history.intro")}</BodyText>

      {/* §14 — a journey, not a dashboard. The header, what is close
          enough to be worth saying, and the months as chapters come
          FIRST; the calendar and the graphs are things to look into,
          not the headline. */}
      <JourneyAhead
        progress={progress}
        badges={badges}
        logRows={recent}
        onShare={(what, key) => {
          /* §14 — every section shares itself, and every share
             carries an optional message and lands where the result
             lives. Until the share sheet is shared with Lane A this
             names exactly WHAT would go, rather than pretending. */
          pushToast(t(`history.share.pending.${what}`, { month: key || "" }), { tone: "info", key: "journey" });
        }}
      />
      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {error}
        </BodyText>
      )}

      {/* ── 1. Calendar ─────────────────────────────────────────── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            aria-label={t("history.calendar.prev")}
            onClick={() => {
              setSelected(null);
              setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
            }}
            style={navBtn}
          >
            {meta.dir === "rtl" ? "›" : "‹"}
          </button>
          <p style={{ flex: 1, textAlign: "center", fontSize: ts(21), fontWeight: 700, margin: 0 }}>
            {monthLabel}
          </p>
          <button
            type="button"
            aria-label={t("history.calendar.next")}
            disabled={isThisMonth}
            onClick={() => {
              setSelected(null);
              setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
            }}
            style={{ ...navBtn, opacity: isThisMonth ? 0.35 : 1 }}
          >
            {meta.dir === "rtl" ? "‹" : "›"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {weekdayInitials.map((w, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{ textAlign: "center", fontSize: ts(15), fontWeight: 700, color: C.textMuted }}
            >
              {w}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const key = iso(ym.y, ym.m, d);
            const rows = days[key];
            const glance = rows ? dayGlance(rows) : null;
            // Log dates roll on the SERVER day; a logged day is never
            // "future", whatever the local clock says.
            const future = isThisMonth && d > today.getDate() && !rows;
            const isSel = selected === key;
            return (
              <button
                key={key}
                type="button"
                disabled={future}
                onClick={() => setSelected(isSel ? null : key)}
                aria-pressed={isSel}
                aria-label={new Date(ym.y, ym.m, d).toLocaleDateString(dateLocale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                style={{
                  minHeight: A11Y.minTapTargetPx,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  background: isSel ? C.green : glance ? "#eef3e8" : C.white,
                  color: isSel ? C.cream : future ? C.warmGray : C.textMain,
                  border: glance?.backfilled
                    ? `2px dashed ${isSel ? C.cream : C.olive}`
                    : `1.5px solid ${isSel ? C.green : C.warmGray}`,
                  borderRadius: 12,
                  fontSize: ts(16),
                  fontFamily: "inherit",
                  cursor: future ? "default" : "pointer",
                  padding: 2,
                }}
              >
                <span style={{ fontWeight: 700 }}>{d}</span>
                <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>
                  {glance?.rest ? "🌙" : glance?.mood ? moodFace(glance.mood) : glance ? "•" : " "}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
          <Legend icon="🙂" text={t("history.calendar.legendMood")} ts={ts} />
          <Legend icon="🌙" text={t("history.calendar.legendRest")} ts={ts} />
          <Legend icon="⬚" text={t("history.calendar.legendBackfilled")} ts={ts} dashed />
        </div>

        {monthPresence === 0 && (
          <BodyText muted style={{ marginTop: 12, marginBottom: 0 }}>
            {t("history.calendar.empty")}
          </BodyText>
        )}

        {/* Day detail */}
        {selected === null ? (
          monthPresence > 0 && (
            <BodyText muted style={{ marginTop: 12, marginBottom: 0 }}>
              {t("history.day.pick")}
            </BodyText>
          )
        ) : (
          <DayDetail
            date={selected}
            rows={selectedRows}
            dateLocale={dateLocale}
            moodFace={moodFace}
            t={t}
            ts={ts}
          />
        )}
      </Card>

      {/* ── 2. Presence ─────────────────────────────────────────── */}
      <SectionLabel>{t("history.presence.title")}</SectionLabel>
      <Card>
        <p style={{ fontSize: ts(24), fontWeight: 800, color: C.green, margin: "0 0 6px" }}>
          {progress == null
            ? "…"
            : progress.current_streak > 1
              ? `🔥 ${t("history.presence.streak", { n: progress.current_streak })}`
              : progress.current_streak === 1
                ? `🌱 ${t("history.presence.streakOne")}`
                : t("history.presence.streakNone")}
        </p>
        <BodyText>
          {monthPresence === 1
            ? t("history.presence.monthOne")
            : t("history.presence.month", { n: monthPresence })}
          {progress != null && <> · {t("history.presence.life", { n: progress.presence_days })}</>}
          {progress != null && <> · {t("history.presence.points", { n: progress.points })}</>}
        </BodyText>
        {monthRest > 0 && (
          <BodyText style={{ fontWeight: 600 }}>
            🌙{" "}
            {monthRest === 1
              ? t("history.presence.restOne")
              : t("history.presence.rest", { n: monthRest })}
          </BodyText>
        )}
        <BodyText muted style={{ margin: 0 }}>
          {t("history.presence.gapNote")}
        </BodyText>
      </Card>

      {/* ── 3. Badge timeline ───────────────────────────────────── */}
      <SectionLabel>{t("history.badges.title")}</SectionLabel>
      {badges.length === 0 ? (
        <BodyText muted>{t("history.badges.empty")}</BodyText>
      ) : (
        badges.map((b) => {
          const def = defs[b.badge_key];
          if (!def) return null;
          return (
            <Card key={b.id} style={{ display: "flex", gap: 14 }}>
              <span aria-hidden="true" style={{ fontSize: 34 }}>
                {def.emoji}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 2px" }}>
                  {lang === "ur" ? def.name_ur : def.name_en}
                </p>
                <BodyText muted style={{ marginBottom: 6 }}>
                  {new Date(b.earned_at).toLocaleDateString(dateLocale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {lang === "ur" ? def.desc_ur : def.desc_en}
                </BodyText>
                {b.message && (
                  <div
                    style={{
                      background: "#f4f7f1",
                      border: `2px solid ${C.sage ?? C.olive}`,
                      borderRadius: 14,
                      padding: "10px 14px",
                    }}
                  >
                    <p style={{ fontSize: ts(15), fontWeight: 700, color: C.olive, margin: "0 0 4px" }}>
                      💌 {t("history.badges.noteFrom")}
                    </p>
                    <BodyText style={{ margin: 0 }}>{b.message}</BodyText>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}

      {/* ── 4. Trends — the Icon's alone ────────────────────────── */}
      {/* §14 — "graphs collapsed at the bottom: something to look
          INTO, never the headline". A chart of a bad month as the
          first thing a person sees is the failure this prevents. */}
      <details style={{ marginTop: 18 }}>
        <summary
          style={{
            minHeight: A11Y.minTapTargetPx,
            display: "flex",
            alignItems: "center",
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            color: C.greenMuted,
            cursor: "pointer",
          }}
        >
          {t("history.trends.title")}
        </summary>
      <BodyText muted>🔒 {t("history.trends.privacy")}</BodyText>
      <Trends logs={logs} daysInMonth={daysInMonth} moodFace={moodFace} t={t} ts={ts} lang={lang} />

      {/* ── The longer view: six auto-drawn pictures of your own
             record. Same privacy as everything above — these are
             built from your rows alone. ── */}
      {recent && (
        <>
          <MoodMonths data={moodByMonth(recent, recentMonthKeys(6))} dateLocale={dateLocale} />
          <DailyBars
            title={t("history.visuals.sleepTitle")}
            series={dailySeries(recent, "sleep", (p) => sleepHoursNumber(p.hours))}
            max={12}
            unitKey="history.visuals.unitHours"
            emptyKey="history.visuals.sleepEmpty"
            tone={C.olive}
            dateLocale={dateLocale}
          />
          <DailyBars
            title={t("history.visuals.waterTitle")}
            series={dailySeries(recent, "water", (p) =>
              p.glasses == null || p.glasses === "" ? null : Number(p.glasses)
            )}
            max={10}
            unitKey="history.visuals.unitGlasses"
            emptyKey="history.visuals.waterEmpty"
            tone="#5b86b5"
            dateLocale={dateLocale}
          />
          <PresenceHeat presence={presenceByDay(recent)} />
          <PointsLine data={pointsByMonth(recent, recentMonthKeys(6))} dateLocale={dateLocale} />
          <ModuleSummaries
            summary={moduleSummary(recent, monthKeyOf(iso(ym.y, ym.m, 1)))}
            monthName={monthLabel}
          />
        </>
      )}
      </details>
    </HistoryScreen>
  );
}

const navBtn = {
  minWidth: 48,
  minHeight: 48,
  fontSize: 26,
  background: C.white,
  border: `2px solid ${C.warmGray}`,
  borderRadius: 12,
  color: C.textMain,
  cursor: "pointer",
};

function Legend({ icon, text, ts, dashed }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: ts(15), color: C.textMuted }}>
      <span
        aria-hidden="true"
        style={
          dashed
            ? { border: `2px dashed ${C.olive}`, borderRadius: 6, padding: "0 5px" }
            : undefined
        }
      >
        {icon}
      </span>
      {text}
    </span>
  );
}

/* One tapped day, in warm words. */
function DayDetail({ date, rows, dateLocale, moodFace, t, ts }) {
  const backfilled = rows.some((r) => r.is_backfilled);
  const line = { fontSize: ts(A11Y.minBodyPx), lineHeight: 1.6, margin: "0 0 8px" };
  const moduleLine = (r) => {
    const p = r.payload || {};
    switch (r.module) {
      case "mood": {
        const label = t(`home.moods.${p.choice}`);
        return `${moodFace(p.choice)} ${label.startsWith("home.") ? "" : label}`.trim();
      }
      case "sleep": {
        const q = t(`home.sleepQuality.${p.quality}`);
        return `🛏️ ${t("history.day.sleep", { h: p.hours ?? "?", q: q.startsWith("home.") ? "" : q })}`;
      }
      case "water": {
        const n = Number(p.glasses) || 0;
        return `💧 ${n === 1 ? t("history.day.waterOne") : t("history.day.water", { n })}`;
      }
      case "medication": {
        const n = (p.taken || []).length;
        return `💊 ${n === 1 ? t("history.day.medsOne") : t("history.day.meds", { n })}`;
      }
      case "diet": {
        const n = (p.meals || []).length;
        return `🍲 ${n === 1 ? t("history.day.mealsOne") : t("history.day.meals", { n })}`;
      }
      case "exercise":
        return `🚶 ${t("history.day.exercise")}`;
      case "rest_day":
        return p.on === false ? null : `🌙 ${t("history.day.rest")}`;
      default: {
        const label = t(`settings.dailyLog.modules.${r.module}`);
        return `✓ ${label.startsWith("settings.") ? t("history.day.logged") : label}`;
      }
    }
  };

  const moodNote = rows.find((r) => r.module === "mood")?.payload?.note;

  return (
    <div style={{ borderTop: `1.5px solid ${C.warmGray}`, marginTop: 14, paddingTop: 14 }}>
      <p style={{ fontSize: ts(19), fontWeight: 700, margin: "0 0 10px" }}>
        {/* Component-wise construction: new Date("YYYY-MM-DD") parses
            as UTC midnight and shows the PREVIOUS day west of
            Greenwich. */}
        {(() => {
          const [yy, mm, dd] = date.split("-").map(Number);
          return new Date(yy, mm - 1, dd).toLocaleDateString(dateLocale, {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
        })()}
      </p>
      {rows.length === 0 && <p style={{ ...line, color: C.textMuted }}>{t("history.day.nothing")}</p>}
      {rows.map((r) => {
        const text = moduleLine(r);
        return text ? (
          <p key={r.module} style={line}>
            {text}
          </p>
        ) : null;
      })}
      {moodNote && (
        <p style={{ ...line, color: C.textMuted }}>
          <strong>{t("history.day.yourNote")}: </strong>
          {moodNote}
        </p>
      )}
      {backfilled && (
        <p style={{ ...line, color: C.olive, fontStyle: "italic", marginBottom: 0 }}>
          {t("history.day.backfilled")}
        </p>
      )}
    </div>
  );
}

/* Mood as a gentle line, sleep as soft bars — month scale. */
function Trends({ logs, daysInMonth, moodFace, t, ts }) {
  const moods = logs
    .filter((r) => r.module === "mood" && r.mood_value != null)
    .map((r) => ({ d: Number(r.log_date.slice(8)), v: r.mood_value, choice: r.payload?.choice }));
  const sleeps = logs
    .filter((r) => r.module === "sleep")
    .map((r) => ({ d: Number(r.log_date.slice(8)), h: Number(String(r.payload?.hours ?? "").replace("+", "")) || null }))
    .filter((s) => s.h != null);

  const W = 560;
  const H = 120;
  const x = (d) => 16 + ((d - 1) / Math.max(1, daysInMonth - 1)) * (W - 32);
  const yMood = (v) => 12 + ((5 - v) / 4) * (H - 34);

  return (
    <>
      <Card>
        <p style={{ fontSize: ts(19), fontWeight: 700, margin: "0 0 8px" }}>
          {t("history.trends.moodDaily")}
        </p>
        {moods.length < 2 ? (
          <BodyText muted style={{ margin: 0 }}>
            {t("history.trends.empty")}
          </BodyText>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={t("history.trends.mood")}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            {[1, 3, 5].map((v) => (
              <line key={v} x1="8" x2={W - 8} y1={yMood(v)} y2={yMood(v)} stroke={C.warmGray} strokeWidth="1" strokeDasharray="3 5" />
            ))}
            <polyline
              points={moods.map((m) => `${x(m.d)},${yMood(m.v)}`).join(" ")}
              fill="none"
              stroke={C.green}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {moods.map((m) => (
              <g key={m.d}>
                <circle cx={x(m.d)} cy={yMood(m.v)} r="6" fill={C.green} />
                <text x={x(m.d)} y={yMood(m.v) - 12} textAnchor="middle" fontSize="15">
                  {moodFace(m.choice)}
                </text>
                <text x={x(m.d)} y={H - 4} textAnchor="middle" fontSize="12" fill={C.textMuted}>
                  {m.d}
                </text>
              </g>
            ))}
          </svg>
        )}
      </Card>

    </>
  );
}
