/* Today's log card — the heart of the Icon home.

   Modules are opt-in from Settings and everything except mood defaults
   OFF (lib/iconPrefs.js) — a module the Icon has not enabled simply
   does not exist on this card. Mood is always first because the
   character's tone depends on it. The medication checklist and the
   meals list are the Icon's own (defined in Settings), and custom
   trackers appear as entries after the built-in modules.

   All copy comes from locales/ (home.log.* and the shared
   settings.dailyLog.modules.* names); user-defined names (trackers,
   meds, meals) render verbatim in whatever language they were typed.

   Every control here is ≥48px tall and ≥18px text. Selection is always
   shown with a ✓ mark as well as colour. */

import { useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  MODULES,
  MOODS,
  SLEEP_HOURS,
  SLEEP_QUALITY,
  EXERCISE_TYPES,
  EXERCISE_MINUTES,
  WATER_GOAL_GLASSES,
} from "./homeMock.js";
import { useIconPrefs, trackerDueOn } from "../../lib/iconPrefs.js";

/* ─── Small shared pieces ─── */

function Chip({ selected, onClick, children, label }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      style={{
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        padding: "10px 16px",
        borderRadius: 14,
        border: `2px solid ${selected ? C.green : C.warmGray}`,
        background: selected ? C.green : C.white,
        color: selected ? C.cream : C.textMain,
        fontSize: 18,
        fontWeight: selected ? 700 : 500,
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {selected && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}

function ChipRow({ children, columns }) {
  return (
    <div
      style={
        columns
          ? {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))",
              gap: 8,
            }
          : { display: "flex", flexWrap: "wrap", gap: 8 }
      }
    >
      {children}
    </div>
  );
}

function EditorLabel({ children }) {
  return (
    <p style={{ fontSize: 18, fontWeight: 600, color: C.textMuted, margin: "18px 0 8px" }}>
      {children}
    </p>
  );
}

/* ─── Per-module editors ─── */

function MoodEditor({ value, onChange }) {
  const { t } = useI18n();
  const [voice, setVoice] = useState(null); // null | "recording" | "saved"
  const chosen = MOODS.find((m) => m.id === value.choice);
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
          gap: 8,
        }}
      >
        {MOODS.map((m) => {
          const selected = value.choice === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ ...value, choice: m.id })}
              style={{
                minHeight: 86,
                minWidth: 0,
                borderRadius: 16,
                border: `3px solid ${selected ? C.green : C.warmGray}`,
                background: selected ? "#eef3ea" : C.white,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "8px 2px",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 30, lineHeight: 1 }} aria-hidden="true">
                {m.face}
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: selected ? 700 : 500,
                  color: selected ? C.green : C.textMain,
                }}
              >
                {selected ? "✓ " : ""}
                {t(m.labelKey)}
              </span>
            </button>
          );
        })}
      </div>

      {chosen && (
        <div style={{ marginTop: 14 }}>
          <textarea
            value={value.note || ""}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            placeholder={t(chosen.phKey)}
            rows={3}
            aria-label={t("home.log.noteAria")}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: `2px solid ${C.warmGray}`,
              background: C.white,
              fontSize: 18,
              lineHeight: 1.55,
              fontFamily: "inherit",
              color: C.textMain,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setVoice(voice === "recording" ? "saved" : "recording")}
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 20px",
                borderRadius: 50,
                border: `2px solid ${voice === "recording" ? C.brown : C.green}`,
                background: voice === "recording" ? C.brown : C.white,
                color: voice === "recording" ? C.cream : C.green,
                fontSize: 18,
                fontWeight: 600,
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span aria-hidden="true">🎤</span>
              {voice === "recording" ? t("home.log.recording") : t("home.log.speakInstead")}
            </button>
            {voice === "saved" && (
              <span role="status" style={{ fontSize: 18, color: C.textMuted }}>
                {t("home.log.voiceKept")}
              </span>
            )}
            {voice !== "saved" && (
              <span style={{ fontSize: 18, color: C.textMuted }}>{t("home.log.upToTwoMinutes")}</span>
            )}
          </div>
          <p style={{ fontSize: 18, color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
            {t("home.log.moodPrivate")}
          </p>
        </div>
      )}
    </div>
  );
}

function SleepEditor({ value, onChange }) {
  const { t } = useI18n();
  const [showTimes, setShowTimes] = useState(false);
  return (
    <div>
      <EditorLabel>{t("home.log.hoursQ")}</EditorLabel>
      <ChipRow>
        {SLEEP_HOURS.map((h) => (
          <Chip
            key={h}
            selected={value.hours === h}
            onClick={() => onChange({ ...value, hours: h })}
            label={t("home.log.hoursAria", { h })}
          >
            {h}
          </Chip>
        ))}
      </ChipRow>

      <EditorLabel>{t("home.log.feelQ")}</EditorLabel>
      <ChipRow columns={3}>
        {SLEEP_QUALITY.map((q) => (
          <Chip
            key={q.id}
            selected={value.quality === q.id}
            onClick={() => onChange({ ...value, quality: q.id })}
          >
            <span aria-hidden="true" style={{ fontSize: 24 }}>{q.face}</span> {t(q.labelKey)}
          </Chip>
        ))}
      </ChipRow>

      <button
        type="button"
        onClick={() => setShowTimes(!showTimes)}
        aria-expanded={showTimes}
        style={{
          minHeight: A11Y.minTapTargetPx,
          marginTop: 14,
          padding: "0 4px",
          background: "none",
          border: "none",
          color: C.green,
          fontSize: 18,
          fontWeight: 600,
          fontFamily: "inherit",
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        {showTimes ? t("home.log.hideTimes") : t("home.log.addTimes")}
      </button>

      {showTimes && (
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {[
            ["bed", t("home.log.wentToBed")],
            ["wake", t("home.log.wokeUp")],
          ].map(([key, label]) => (
            <label key={key} style={{ fontSize: 18, color: C.textMain, display: "flex", flexDirection: "column", gap: 6 }}>
              {label}
              <input
                type="time"
                value={value[key] || ""}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                style={{
                  minHeight: A11Y.minTapTargetPx,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: `2px solid ${C.warmGray}`,
                  fontSize: 18,
                  fontFamily: "inherit",
                  background: C.white,
                  color: C.textMain,
                }}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* An empty module is a door to Settings, never a dead end. */
function SettingsDoor({ children }) {
  const { t } = useI18n();
  return (
    <p style={{ fontSize: 18, color: C.textMuted, margin: "8px 0 4px", lineHeight: 1.55 }}>
      {children}{" "}
      <Link to="/app/settings" style={{ color: C.green, fontWeight: 600 }}>
        {t("home.log.openSettings")}
      </Link>
    </p>
  );
}

function MedicationEditor({ value, onChange, meds }) {
  const { t } = useI18n();
  const taken = value.taken || [];
  const toggle = (id) =>
    onChange({
      ...value,
      taken: taken.includes(id) ? taken.filter((x) => x !== id) : [...taken, id],
    });
  if (meds.length === 0) {
    return <SettingsDoor>{t("home.log.medsEmpty")}</SettingsDoor>;
  }
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {meds.map((med) => {
          const done = taken.includes(med.id);
          return (
            <button
              key={med.id}
              type="button"
              role="checkbox"
              aria-checked={done}
              onClick={() => toggle(med.id)}
              style={{
                minHeight: 60,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "10px 14px",
                borderRadius: 14,
                border: `2px solid ${done ? C.green : C.warmGray}`,
                background: done ? "#eef3ea" : C.white,
                fontFamily: "inherit",
                textAlign: "start",
                width: "100%",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  border: `2.5px solid ${done ? C.green : C.textMuted}`,
                  background: done ? C.green : C.white,
                  color: C.cream,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : ""}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 19, fontWeight: 600, color: C.textMain }}>
                  {med.name}
                </span>
                {(med.dose || med.time) && (
                  <span style={{ display: "block", fontSize: 18, color: C.textMuted }}>
                    {[med.dose, med.time].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 18, color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
        {t("home.log.medsNote")}
      </p>
    </div>
  );
}

function ExerciseEditor({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div>
      <EditorLabel>{t("home.log.moveQ")}</EditorLabel>
      <ChipRow>
        {EXERCISE_TYPES.map((et) => (
          <Chip
            key={et.id}
            selected={value.type === et.id}
            onClick={() => onChange({ ...value, type: et.id })}
          >
            <span aria-hidden="true">{et.icon}</span> {t(et.labelKey)}
          </Chip>
        ))}
      </ChipRow>
      <EditorLabel>{t("home.log.howLongQ")}</EditorLabel>
      <ChipRow>
        {EXERCISE_MINUTES.map((m) => (
          <Chip
            key={m}
            selected={value.minutes === m}
            onClick={() => onChange({ ...value, minutes: m })}
            label={t("home.log.minutesAria", { m })}
          >
            {t("home.log.minShort", { m })}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

function DietEditor({ value, onChange, items }) {
  const { t } = useI18n();
  const meals = value.meals || [];
  const toggle = (id) =>
    onChange({
      ...value,
      meals: meals.includes(id) ? meals.filter((m) => m !== id) : [...meals, id],
    });
  if (items.length === 0) {
    return <SettingsDoor>{t("home.log.dietEmpty")}</SettingsDoor>;
  }
  return (
    <div>
      <EditorLabel>{t("home.log.dietQ")}</EditorLabel>
      <ChipRow>
        {items.map((m) => (
          <Chip key={m.id} selected={meals.includes(m.id)} onClick={() => toggle(m.id)}>
            {m.label}
          </Chip>
        ))}
      </ChipRow>
      <p style={{ fontSize: 18, color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
        {t("home.log.dietNote")}
      </p>
    </div>
  );
}

/* ─── Custom tracker editors (Settings → "your own trackers") ─── */

function TrackerEditor({ tracker, value, onChange }) {
  const { t } = useI18n();
  if (tracker.type === "yesno") {
    const done = !!value.done;
    return (
      <ChipRow>
        <Chip selected={done} onClick={() => onChange({ ...value, done: !done })}>
          {t("home.log.trackerDone")}
        </Chip>
      </ChipRow>
    );
  }
  if (tracker.type === "count") {
    const count = value.count || 0;
    const set = (n) => onChange({ ...value, count: Math.max(0, Math.min(99, n)) });
    const btn = {
      width: 64,
      height: 64,
      borderRadius: 20,
      border: `2px solid ${C.green}`,
      background: C.white,
      color: C.green,
      fontSize: 30,
      fontWeight: 700,
      fontFamily: "inherit",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    };
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button type="button" onClick={() => set(count - 1)} aria-label={t("home.log.oneFewer")} style={btn}>
          −
        </button>
        <span role="status" style={{ fontSize: 34, fontWeight: 700, color: C.green, minWidth: 60, textAlign: "center" }}>
          {count}
        </span>
        <button type="button" onClick={() => set(count + 1)} aria-label={t("home.log.oneMore")} style={btn}>
          +
        </button>
      </div>
    );
  }
  // note
  return (
    <textarea
      value={value.note || ""}
      onChange={(e) => onChange({ ...value, note: e.target.value })}
      placeholder={t("home.log.trackerNotePh")}
      rows={3}
      aria-label={t("home.log.trackerNoteAria", { name: tracker.name })}
      style={{
        width: "100%",
        padding: "14px 16px",
        borderRadius: 14,
        border: `2px solid ${C.warmGray}`,
        background: C.white,
        fontSize: 18,
        lineHeight: 1.55,
        fontFamily: "inherit",
        color: C.textMain,
        resize: "vertical",
      }}
    />
  );
}

function WaterEditor({ value, onChange }) {
  const { t } = useI18n();
  const glasses = value.glasses || 0;
  const set = (n) => onChange({ ...value, glasses: Math.max(0, Math.min(15, n)) });
  const btn = {
    width: 64,
    height: 64,
    borderRadius: 20,
    border: `2px solid ${C.green}`,
    background: C.white,
    color: C.green,
    fontSize: 30,
    fontWeight: 700,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <button type="button" onClick={() => set(glasses - 1)} aria-label={t("home.log.glassFewer")} style={btn}>
        −
      </button>
      <div style={{ textAlign: "center", minWidth: 110 }} role="status">
        <span style={{ display: "block", fontSize: 34, fontWeight: 700, color: C.green }}>
          {glasses}
        </span>
        <span style={{ display: "block", fontSize: 18, color: C.textMuted }}>
          {t("home.log.ofGlasses", { n: WATER_GOAL_GLASSES })}
        </span>
      </div>
      <button type="button" onClick={() => set(glasses + 1)} aria-label={t("home.log.glassMore")} style={btn}>
        +
      </button>
    </div>
  );
}

/* ─── Entries: enabled modules + custom trackers due that day ─── */

const TRACKER_ICONS = { yesno: "☑️", count: "🔢", note: "📝" };

/* Everything the log card shows for a given day, in order: mood first,
   the other enabled modules, then custom trackers on their schedule.
   IconHome uses the same list for participation points, so a tracker
   counts exactly like a module — never scaled by content. Module
   display names resolve from settings.dailyLog.modules.* at render
   time; tracker names are the Icon's own words. */
export function dayEntries(prefs, date) {
  const mods = MODULES.filter((m) => prefs.enabledModules.includes(m.id)).map(
    (m) => ({ kind: "module", key: m.id, id: m.id, icon: m.icon })
  );
  const trackers = prefs.trackers
    .filter((tr) => trackerDueOn(tr, date))
    .map((tr) => ({
      kind: "tracker",
      key: `tracker:${tr.id}`,
      id: tr.id,
      name: tr.name,
      icon: TRACKER_ICONS[tr.type] || "☑️",
      tracker: tr,
    }));
  return [...mods, ...trackers];
}

export function isEntryDone(entry, log) {
  const v = log[entry.key];
  if (!v) return false;
  if (entry.kind === "tracker") {
    switch (entry.tracker.type) {
      case "yesno":
        return !!v.done;
      case "count":
        return (v.count || 0) > 0;
      case "note":
        return !!(v.note || "").trim();
      default:
        return false;
    }
  }
  switch (entry.id) {
    case "mood":
      return !!v.choice;
    case "sleep":
      return !!v.hours && !!v.quality;
    case "medication":
      return (v.taken || []).length > 0;
    case "exercise":
      return !!v.type && !!v.minutes;
    case "diet":
      return (v.meals || []).length > 0;
    case "water":
      return (v.glasses || 0) > 0;
    default:
      return false;
  }
}

// Kept for callers that only deal in built-in module ids.
export function isModuleDone(id, log) {
  return isEntryDone({ kind: "module", key: id, id }, log);
}

function summaryFor(entry, log, prefs, t) {
  const v = log[entry.key] || {};
  if (entry.kind === "tracker") {
    switch (entry.tracker.type) {
      case "yesno":
        return v.done ? t("home.log.sumDone") : null;
      case "count":
        return (v.count || 0) > 0 ? `${v.count}` : null;
      case "note":
        return (v.note || "").trim() ? t("home.log.sumNoted") : null;
      default:
        return null;
    }
  }
  switch (entry.id) {
    case "mood": {
      const m = MOODS.find((x) => x.id === v.choice);
      return m ? `${t(m.labelKey)} ${m.face}` : null;
    }
    case "sleep": {
      const q = SLEEP_QUALITY.find((x) => x.id === v.quality);
      return v.hours && q ? t("home.log.sumSleep", { h: v.hours, q: t(q.labelKey) }) : null;
    }
    case "medication": {
      const n = (v.taken || []).length;
      return n > 0 ? t("home.log.sumMeds", { n, total: prefs.medications.length }) : null;
    }
    case "exercise": {
      const et = EXERCISE_TYPES.find((x) => x.id === v.type);
      return et && v.minutes
        ? `${t(et.labelKey)} · ${t("home.log.minShort", { m: v.minutes })}`
        : null;
    }
    case "diet": {
      const n = (v.meals || []).length;
      return n > 0 ? t("home.log.sumDiet", { n }) : null;
    }
    case "water": {
      const n = v.glasses || 0;
      if (n <= 0) return null;
      return n === 1 ? t("home.log.sumGlassOne") : t("home.log.sumGlassMany", { n });
    }
    default:
      return null;
  }
}

/* ─── The card ─── */

export default function DailyLogCard({ log, onChange, editable, restDay, dayLabel, isToday, date }) {
  const { t, meta } = useI18n();
  const prefs = useIconPrefs();
  const entries = dayEntries(prefs, date);
  const moodDone = isModuleDone("mood", log);
  const [openId, setOpenId] = useState(moodDone ? null : "mood");

  const entryName = (entry) =>
    entry.kind === "module" ? t(`settings.dailyLog.modules.${entry.id}`) : entry.name;

  return (
    <section
      aria-label={isToday ? t("home.log.titleToday") : t("home.log.titleFor", { day: dayLabel })}
      style={{
        background: C.white,
        borderRadius: 22,
        border: `1.5px solid ${C.warmGray}`,
        boxShadow: "0 4px 20px rgba(87, 52, 37, 0.07)",
        padding: "22px 20px",
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <h2
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: 25,
            fontWeight: 700,
            color: C.brown,
            margin: 0,
          }}
        >
          {isToday ? t("home.log.titleToday") : t("home.log.titleFor", { day: dayLabel })}
        </h2>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "6px 0 0", lineHeight: 1.5 }}>
          {t("home.log.intro")}
        </p>
      </div>

      {restDay && (
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: C.green,
            background: "#eef3ea",
            border: `2px solid ${C.sage}`,
            borderRadius: 14,
            padding: "12px 16px",
            margin: "14px 0 4px",
          }}
        >
          {t("home.log.restBanner")}
        </p>
      )}

      {!editable && (
        <p style={{ fontSize: 18, color: C.textMuted, margin: "14px 0 4px", lineHeight: 1.5 }}>
          {t("home.log.settled")}
        </p>
      )}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((mod) => {
          const done = isEntryDone(mod, log);
          const open = openId === mod.key;
          const summary = summaryFor(mod, log, prefs, t);
          return (
            <div
              key={mod.key}
              style={{
                border: `2px solid ${open ? C.greenMuted : done ? C.sage : C.warmGray}`,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                aria-expanded={open}
                disabled={!editable}
                onClick={() => setOpenId(open ? null : mod.key)}
                style={{
                  width: "100%",
                  minHeight: 60,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: done ? "#f4f7f1" : C.white,
                  border: "none",
                  fontFamily: "inherit",
                  textAlign: "start",
                  cursor: editable ? "pointer" : "default",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 26 }}>{mod.icon}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 20, fontWeight: 700, color: C.textMain }}>
                    {entryName(mod)}
                  </span>
                  <span style={{ display: "block", fontSize: 18, color: done ? C.green : C.textMuted }}>
                    {done ? `✓ ${summary}` : editable ? t("home.log.tapToAdd") : "—"}
                  </span>
                </span>
                {editable && (
                  <span aria-hidden="true" style={{ fontSize: 18, color: C.textMuted, fontWeight: 700 }}>
                    {open ? "▲" : "▼"}
                  </span>
                )}
              </button>
              {open && editable && (
                <div style={{ padding: "6px 16px 18px", background: C.white }}>
                  <EntryEditor
                    entry={mod}
                    prefs={prefs}
                    value={log[mod.key] || {}}
                    onChange={(v) => onChange(mod.key, v)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 18, color: C.textMuted, margin: "16px 0 0", lineHeight: 1.5 }}>
        {t("home.log.chooseHere")}{" "}
        <Link to="/app/settings" style={{ color: C.green, fontWeight: 600 }}>
          {t("home.log.fromSettings")}
        </Link>
        .
      </p>
    </section>
  );
}

function EntryEditor({ entry, prefs, value, onChange }) {
  if (entry.kind === "tracker") {
    return <TrackerEditor tracker={entry.tracker} value={value} onChange={onChange} />;
  }
  switch (entry.id) {
    case "mood":
      return <MoodEditor value={value} onChange={onChange} />;
    case "sleep":
      return <SleepEditor value={value} onChange={onChange} />;
    case "medication":
      return <MedicationEditor value={value} onChange={onChange} meds={prefs.medications} />;
    case "exercise":
      return <ExerciseEditor value={value} onChange={onChange} />;
    case "diet":
      return <DietEditor value={value} onChange={onChange} items={prefs.dietItems} />;
    case "water":
      return <WaterEditor value={value} onChange={onChange} />;
    default:
      return null;
  }
}
