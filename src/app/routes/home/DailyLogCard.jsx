/* Today's log card — the heart of the Icon home.

   Modules are opt-in from Settings (mocked in homeMock.js); mood is
   always first because the character's tone depends on it. Each editor
   is built for the two-tap common case: sleep is hours + a face,
   medication is a tick-off checklist, movement is a type + a duration.

   Every control here is ≥48px tall and ≥18px text. Selection is always
   shown with a ✓ mark as well as colour. */

import { useState } from "react";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import {
  MODULES,
  MOODS,
  SLEEP_HOURS,
  SLEEP_QUALITY,
  MOCK_MEDS,
  EXERCISE_TYPES,
  EXERCISE_MINUTES,
  MEALS,
  WATER_GOAL_GLASSES,
} from "./homeMock.js";

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
        fontFamily: FONTS.sans,
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
                fontFamily: FONTS.sans,
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
                {m.label}
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
            placeholder={chosen.placeholder}
            rows={3}
            aria-label="A note about today, if you like"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: `2px solid ${C.warmGray}`,
              background: C.white,
              fontSize: 18,
              lineHeight: 1.55,
              fontFamily: FONTS.sans,
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
                fontFamily: FONTS.sans,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span aria-hidden="true">🎤</span>
              {voice === "recording" ? "Recording… tap to finish" : "Speak instead"}
            </button>
            {voice === "saved" && (
              <span role="status" style={{ fontSize: 18, color: C.textMuted }}>
                ✓ Voice note kept (0:12). Written copy is made automatically.
              </span>
            )}
            {voice !== "saved" && (
              <span style={{ fontSize: 18, color: C.textMuted }}>Up to 2 minutes</span>
            )}
          </div>
          <p style={{ fontSize: 18, color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
            Your mood and notes stay private unless you choose to share them.
          </p>
        </div>
      )}
    </div>
  );
}

function SleepEditor({ value, onChange }) {
  const [showTimes, setShowTimes] = useState(false);
  return (
    <div>
      <EditorLabel>How many hours?</EditorLabel>
      <ChipRow>
        {SLEEP_HOURS.map((h) => (
          <Chip
            key={h}
            selected={value.hours === h}
            onClick={() => onChange({ ...value, hours: h })}
            label={`${h} hours`}
          >
            {h}
          </Chip>
        ))}
      </ChipRow>

      <EditorLabel>How did it feel?</EditorLabel>
      <ChipRow columns={3}>
        {SLEEP_QUALITY.map((q) => (
          <Chip
            key={q.id}
            selected={value.quality === q.id}
            onClick={() => onChange({ ...value, quality: q.id })}
          >
            <span aria-hidden="true" style={{ fontSize: 24 }}>{q.face}</span> {q.label}
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
          fontFamily: FONTS.sans,
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        {showTimes ? "Hide bed and wake times" : "Add bed and wake times (optional)"}
      </button>

      {showTimes && (
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {[
            ["bed", "Went to bed"],
            ["wake", "Woke up"],
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
                  fontFamily: FONTS.sans,
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

function MedicationEditor({ value, onChange }) {
  const taken = value.taken || [];
  const toggle = (id) =>
    onChange({
      ...value,
      taken: taken.includes(id) ? taken.filter((t) => t !== id) : [...taken, id],
    });
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MOCK_MEDS.map((med) => {
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
                fontFamily: FONTS.sans,
                textAlign: "left",
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
                <span style={{ display: "block", fontSize: 18, color: C.textMuted }}>
                  {med.dose} · {med.time}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 18, color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
        Reminders can nudge you, but this list is the reliable record — please
        don't depend on the reminder alone.
      </p>
    </div>
  );
}

function ExerciseEditor({ value, onChange }) {
  return (
    <div>
      <EditorLabel>What did you do?</EditorLabel>
      <ChipRow>
        {EXERCISE_TYPES.map((t) => (
          <Chip
            key={t.id}
            selected={value.type === t.id}
            onClick={() => onChange({ ...value, type: t.id })}
          >
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </Chip>
        ))}
      </ChipRow>
      <EditorLabel>For about how long?</EditorLabel>
      <ChipRow>
        {EXERCISE_MINUTES.map((m) => (
          <Chip
            key={m}
            selected={value.minutes === m}
            onClick={() => onChange({ ...value, minutes: m })}
            label={`${m} minutes`}
          >
            {m} min
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

function DietEditor({ value, onChange }) {
  const meals = value.meals || [];
  const toggle = (id) =>
    onChange({
      ...value,
      meals: meals.includes(id) ? meals.filter((m) => m !== id) : [...meals, id],
    });
  return (
    <div>
      <EditorLabel>What have you eaten today?</EditorLabel>
      <ChipRow>
        {MEALS.map((m) => (
          <Chip key={m.id} selected={meals.includes(m.id)} onClick={() => toggle(m.id)}>
            <span aria-hidden="true">{m.icon}</span> {m.label}
          </Chip>
        ))}
      </ChipRow>
      <p style={{ fontSize: 18, color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
        Just a record for you — never a diet plan.
      </p>
    </div>
  );
}

function WaterEditor({ value, onChange }) {
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
    fontFamily: FONTS.sans,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <button type="button" onClick={() => set(glasses - 1)} aria-label="One glass fewer" style={btn}>
        −
      </button>
      <div style={{ textAlign: "center", minWidth: 110 }} role="status">
        <span style={{ display: "block", fontSize: 34, fontWeight: 700, color: C.green }}>
          {glasses}
        </span>
        <span style={{ display: "block", fontSize: 18, color: C.textMuted }}>
          of {WATER_GOAL_GLASSES} glasses
        </span>
      </div>
      <button type="button" onClick={() => set(glasses + 1)} aria-label="One glass more" style={btn}>
        +
      </button>
    </div>
  );
}

/* ─── Module registry glue ─── */

const EDITORS = {
  mood: MoodEditor,
  sleep: SleepEditor,
  medication: MedicationEditor,
  exercise: ExerciseEditor,
  diet: DietEditor,
  water: WaterEditor,
};

export function isModuleDone(id, log) {
  const v = log[id];
  if (!v) return false;
  switch (id) {
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

function summaryFor(id, log) {
  const v = log[id] || {};
  switch (id) {
    case "mood": {
      const m = MOODS.find((x) => x.id === v.choice);
      return m ? `${m.label} ${m.face}` : null;
    }
    case "sleep": {
      const q = SLEEP_QUALITY.find((x) => x.id === v.quality);
      return v.hours && q ? `${v.hours} hours · ${q.label}` : null;
    }
    case "medication": {
      const n = (v.taken || []).length;
      return n > 0 ? `${n} of ${MOCK_MEDS.length} ticked` : null;
    }
    case "exercise": {
      const t = EXERCISE_TYPES.find((x) => x.id === v.type);
      return t && v.minutes ? `${t.label} · ${v.minutes} min` : null;
    }
    case "diet": {
      const n = (v.meals || []).length;
      return n > 0 ? `${n} logged` : null;
    }
    case "water": {
      const n = v.glasses || 0;
      return n > 0 ? `${n} glasses` : null;
    }
    default:
      return null;
  }
}

/* ─── The card ─── */

export default function DailyLogCard({ log, onChange, editable, restDay, enabledModules, dayLabel }) {
  const modules = MODULES.filter((m) => enabledModules.includes(m.id));
  const moodDone = isModuleDone("mood", log);
  const [openId, setOpenId] = useState(moodDone ? null : "mood");

  return (
    <section
      aria-label={`Log for ${dayLabel}`}
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
            fontFamily: FONTS.serif,
            fontSize: 25,
            fontWeight: 700,
            color: C.brown,
            margin: 0,
          }}
        >
          {dayLabel === "today" ? "Today's log" : `Log for ${dayLabel}`}
        </h2>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "6px 0 0", lineHeight: 1.5 }}>
          Only what you choose to keep. Honest days and busy days count exactly the same.
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
          ☾ Rest day. Nothing is expected — log anything you like, or nothing at all.
        </p>
      )}

      {!editable && (
        <p style={{ fontSize: 18, color: C.textMuted, margin: "14px 0 4px", lineHeight: 1.5 }}>
          This day is settled and kept safe. Logs can be added for up to two days back.
        </p>
      )}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {modules.map((mod) => {
          const done = isModuleDone(mod.id, log);
          const open = openId === mod.id;
          const summary = summaryFor(mod.id, log);
          const Editor = EDITORS[mod.id];
          return (
            <div
              key={mod.id}
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
                onClick={() => setOpenId(open ? null : mod.id)}
                style={{
                  width: "100%",
                  minHeight: 60,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: done ? "#f4f7f1" : C.white,
                  border: "none",
                  fontFamily: FONTS.sans,
                  textAlign: "left",
                  cursor: editable ? "pointer" : "default",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 26 }}>{mod.icon}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 20, fontWeight: 700, color: C.textMain }}>
                    {mod.name}
                  </span>
                  <span style={{ display: "block", fontSize: 18, color: done ? C.green : C.textMuted }}>
                    {done ? `✓ ${summary}` : editable ? "Tap to add" : "—"}
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
                  <Editor
                    value={log[mod.id] || {}}
                    onChange={(v) => onChange(mod.id, v)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 18, color: C.textMuted, margin: "16px 0 0", lineHeight: 1.5 }}>
        Choose which of these appear here from Settings.
      </p>
    </section>
  );
}
