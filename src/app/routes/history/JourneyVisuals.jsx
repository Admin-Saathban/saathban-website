/* ════════════════════════════════════════════════
   My journey — the longer view, drawn from the person's own logs.

   Six auto-generated pictures: mood month by month, sleep, water,
   a presence heat calendar, points over time, and this month's
   modules in words. Every one is built from rows already fetched for
   this page (icon_id = the caller), so nothing here is reachable by
   anyone else, whatever is shared elsewhere.

   House rules for all of them:
   - Warm and large. Numbers big enough to read without leaning in.
   - Never a comparison. No target lines, no "better than", no other
     person anywhere. The only subject is you, over time.
   - A sparse or empty stretch is a kind sentence, never a bare chart
     or an accusing gap.
   - Colour never carries meaning alone: every shape is labelled.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MOODS } from "../home/homeMock.js";
import { Card, BodyText, SectionLabel } from "./ui.jsx";

const W = 560; // shared viewBox width

/* Short month label, e.g. "Aug" — from a 'YYYY-MM' key. */
function monthLabel(key, dateLocale) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(dateLocale, { month: "short" });
}

function Empty({ children }) {
  return (
    <BodyText muted style={{ margin: 0 }}>
      {children}
    </BodyText>
  );
}

function Panel({ title, children }) {
  const { ts } = useI18n();
  return (
    <Card>
      <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 10px" }}>{title}</p>
      {children}
    </Card>
  );
}

/* ── 1. Mood, month by month ───────────────────────────────────── */
export function MoodMonths({ data, dateLocale }) {
  const { t, ts } = useI18n();
  const withData = data.filter((d) => d.avg != null);
  const H = 150;
  const face = (v) => MOODS[Math.min(4, Math.max(0, 5 - Math.round(v)))]?.face ?? "•";
  const x = (i) => 34 + (i / Math.max(1, data.length - 1)) * (W - 68);
  const y = (v) => 22 + ((5 - v) / 4) * (H - 60);

  return (
    <Panel title={t("history.visuals.moodMonths")}>
      {withData.length < 2 ? (
        <Empty>{t("history.visuals.moodMonthsEmpty")}</Empty>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={withData
              .map((d) => `${monthLabel(d.month, dateLocale)}: ${d.avg.toFixed(1)} of 5`)
              .join("; ")}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            {[1, 3, 5].map((v) => (
              <line
                key={v}
                x1="24"
                x2={W - 24}
                y1={y(v)}
                y2={y(v)}
                stroke={C.warmGray}
                strokeDasharray="3 6"
              />
            ))}
            <polyline
              points={withData.map((d) => `${x(data.indexOf(d))},${y(d.avg)}`).join(" ")}
              fill="none"
              stroke={C.green}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {data.map((d, i) => (
              <g key={d.month}>
                {d.avg != null && (
                  <>
                    <circle cx={x(i)} cy={y(d.avg)} r="7" fill={C.green} />
                    <text x={x(i)} y={y(d.avg) - 14} textAnchor="middle" fontSize="18">
                      {face(d.avg)}
                    </text>
                  </>
                )}
                <text
                  x={x(i)}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="700"
                  fill={d.avg == null ? C.warmGray : C.textMain}
                >
                  {monthLabel(d.month, dateLocale)}
                </text>
              </g>
            ))}
          </svg>
          <BodyText muted style={{ margin: "8px 0 0", fontSize: ts(16) }}>
            {t("history.visuals.moodMonthsNote")}
          </BodyText>
        </>
      )}
    </Panel>
  );
}

/* ── 2 & 3. Daily bars: sleep hours, glasses of water ──────────── */
export function DailyBars({ title, series, max, unitKey, emptyKey, tone, dateLocale }) {
  const { t, ts } = useI18n();
  const H = 130;
  const recent = series.slice(-30);
  const bw = recent.length ? Math.min(16, (W - 40) / recent.length - 3) : 0;
  const avg = recent.length ? recent.reduce((a, b) => a + b.value, 0) / recent.length : 0;

  return (
    <Panel title={title}>
      {recent.length < 2 ? (
        <Empty>{t(emptyKey)}</Empty>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={recent
              .map((d) => `${d.date.slice(8)}: ${d.value}`)
              .join("; ")}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            {recent.map((d, i) => {
              const h = (Math.min(d.value, max) / max) * (H - 40);
              const bx = 20 + i * ((W - 40) / recent.length);
              return (
                <g key={d.date}>
                  <rect
                    x={bx}
                    y={H - 24 - h}
                    width={bw}
                    height={Math.max(2, h)}
                    rx={4}
                    fill={tone}
                  />
                  {(i === 0 || i === recent.length - 1) && (
                    <text x={bx + bw / 2} y={H - 8} textAnchor="middle" fontSize="14" fill={C.textMuted}>
                      {Number(d.date.slice(8))}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <BodyText style={{ margin: "8px 0 0", fontWeight: 600 }}>
            {t("history.visuals.typically", { value: avg.toFixed(1), unit: t(unitKey) })}
          </BodyText>
        </>
      )}
    </Panel>
  );
}

/* ── 4. Presence heat calendar ─────────────────────────────────── */
export function PresenceHeat({ presence, weeks = 12 }) {
  const { t, ts, meta } = useI18n();
  const today = new Date();
  const days = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ key, day: d, info: presence[key] });
  }
  const anyPresence = days.some((d) => d.info);
  // Warmth grows with how much of the day was logged — never a score,
  // just "a little" through "a full day".
  const shade = (n) => (n >= 5 ? C.green : n >= 3 ? "#5f8f63" : n >= 1 ? "#9dbc9f" : null);

  return (
    <Panel title={t("history.visuals.presenceTitle")}>
      {!anyPresence ? (
        <Empty>{t("history.visuals.presenceEmpty")}</Empty>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateRows: "repeat(7, 1fr)",
              gridAutoFlow: "column",
              gap: 3,
              direction: "ltr", // the calendar always reads oldest → newest
            }}
          >
            {days.map(({ key, day, info }) => {
              const fill = info ? shade(info.count) : null;
              return (
                <span
                  key={key}
                  title={key}
                  aria-hidden="true"
                  style={{
                    aspectRatio: "1",
                    borderRadius: 4,
                    background: fill || C.white,
                    border: `1px solid ${fill ? "transparent" : C.warmGray}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                  }}
                >
                  {info?.rest ? "🌙" : ""}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontSize: ts(15), color: C.textMuted }}>
              ▪ {t("history.visuals.legendSome")}
            </span>
            <span style={{ fontSize: ts(15), color: C.textMuted }}>
              ■ {t("history.visuals.legendFull")}
            </span>
            <span style={{ fontSize: ts(15), color: C.textMuted }}>
              🌙 {t("history.visuals.legendRest")}
            </span>
          </div>
          <BodyText muted style={{ margin: "8px 0 0", fontSize: ts(16) }}>
            {t("history.visuals.presenceNote")}
          </BodyText>
        </>
      )}
    </Panel>
  );
}

/* ── 5. Points over time ───────────────────────────────────────── */
export function PointsLine({ data, dateLocale }) {
  const { t, ts } = useI18n();
  const any = data.some((d) => d.earned > 0);
  const H = 140;
  const top = Math.max(1, ...data.map((d) => d.total));
  const x = (i) => 34 + (i / Math.max(1, data.length - 1)) * (W - 68);
  const y = (v) => 20 + (1 - v / top) * (H - 58);

  return (
    <Panel title={t("history.visuals.pointsTitle")}>
      {!any ? (
        <Empty>{t("history.visuals.pointsEmpty")}</Empty>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={data.map((d) => `${monthLabel(d.month, dateLocale)}: ${d.total}`).join("; ")}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            <polyline
              points={data.map((d, i) => `${x(i)},${y(d.total)}`).join(" ")}
              fill="none"
              stroke={C.olive}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {data.map((d, i) => (
              <g key={d.month}>
                <circle cx={x(i)} cy={y(d.total)} r="6" fill={C.olive} />
                <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="15" fontWeight="700" fill={C.textMain}>
                  {monthLabel(d.month, dateLocale)}
                </text>
              </g>
            ))}
          </svg>
          <BodyText style={{ margin: "8px 0 0", fontWeight: 600 }}>
            {t("history.visuals.pointsNote", { n: data[data.length - 1].total })}
          </BodyText>
        </>
      )}
    </Panel>
  );
}

/* ── 6. This month's modules, in words ─────────────────────────── */
export function ModuleSummaries({ summary, monthName }) {
  const { t, ts } = useI18n();
  const label = (module) => {
    const k = t(`settings.dailyLog.modules.${module}`);
    return k.startsWith("settings.") ? t(`history.visuals.module.${module}`) : k;
  };
  const statLine = (stat) => {
    if (!stat || stat.value == null) return null;
    switch (stat.kind) {
      case "hours":
        return t("history.visuals.statHours", { value: stat.value.toFixed(1) });
      case "glasses":
        return t("history.visuals.statGlasses", { value: stat.value.toFixed(1) });
      case "ticks":
        return t("history.visuals.statTicks", { n: stat.value });
      case "meals":
        return t("history.visuals.statMeals", { n: stat.value });
      case "mood":
        return t("history.visuals.statMood", { value: stat.value.toFixed(1) });
      default:
        return null;
    }
  };

  return (
    <>
      <SectionLabel>{t("history.visuals.modulesTitle", { month: monthName })}</SectionLabel>
      {summary.length === 0 ? (
        <BodyText muted>{t("history.visuals.modulesEmpty")}</BodyText>
      ) : (
        <Card>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {summary.map((m) => (
              <li
                key={m.module}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  flexWrap: "wrap",
                  minHeight: A11Y.minTapTargetPx,
                  borderBottom: `1px solid ${C.warmGray}`,
                  padding: "8px 0",
                }}
              >
                <span style={{ flex: 1, minWidth: 120, fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>
                  {label(m.module)}
                </span>
                <span style={{ fontSize: ts(A11Y.minBodyPx), color: C.green, fontWeight: 700 }}>
                  {m.days === 1
                    ? t("history.visuals.dayOne")
                    : t("history.visuals.days", { n: m.days })}
                </span>
                {statLine(m.stat) && (
                  <span style={{ fontSize: ts(16), color: C.textMuted, width: "100%" }}>
                    {statLine(m.stat)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
