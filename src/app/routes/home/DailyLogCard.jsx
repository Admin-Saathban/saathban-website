/* Today's log card — the heart of the Icon home.

   Modules are opt-in from Settings and everything except mood defaults
   OFF (lib/iconPrefs.js → daily_log_prefs, 0033) — a module the Icon
   has not enabled simply does not exist on this card. Mood is always
   first because the character's tone depends on it. The medication
   checklist and the meal library are the Icon's own (or set up with
   help from their circle), and custom trackers appear after the
   built-in modules.

   Where several things are true at once the control is a checkbox
   chip, never a radio: moods ("content" AND "tired"), meal items per
   meal, medicines. Water and weight show in the person's chosen unit
   and are stored canonically (ml / kg). Mood and exercise notes can be
   spoken — a real recording, played back inline on any day.

   All copy comes from locales/ (home.log.* and the shared
   settings.dailyLog.* names); user-defined names (trackers, meds,
   meals) render verbatim in whatever language they were typed.

   Every control here is ≥48px tall and ≥18px text. Selection is always
   shown with a ✓ mark as well as colour. */

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Icon from "../../components/Icon.jsx";
import {
  MODULES,
  MOODS,
  SLEEP_HOURS,
  SLEEP_QUALITY,
  EXERCISE_TYPES,
  EXERCISE_MINUTES,
} from "./homeMock.js";
import { useIconPrefs, trackerDueOn, addMealItem } from "../../lib/iconPrefs.js";
import { WATER_GOAL_ML, waterToDisplay, waterStepMl, waterMlOf } from "../../lib/units.js";
import VoiceNote, { VoicePlayer } from "./VoiceNote.jsx";
import { TagChips, TAG_EMOJI } from "./LogSetupPanel.jsx";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];
const SLOT_ICON = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍵" };

/* ─── Small shared pieces ─── */

function Chip({ selected, onClick, children, label, role = "checkbox" }) {
  const { ts } = useI18n();
  const ariaProps = role === "checkbox" ? { role: "checkbox", "aria-checked": selected } : { "aria-pressed": selected };
  return (
    <button
      type="button"
      {...ariaProps}
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
        fontSize: ts(A11Y.minBodyPx),
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
          ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", gap: 8 }
          : { display: "flex", flexWrap: "wrap", gap: 8 }
      }
    >
      {children}
    </div>
  );
}

function EditorLabel({ children }) {
  const { ts } = useI18n();
  return (
    <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, color: C.textMuted, margin: "18px 0 8px" }}>{children}</p>
  );
}

function NoteArea({ value, onChange, placeholder, ariaLabel }) {
  const { ts } = useI18n();
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      aria-label={ariaLabel}
      style={{
        width: "100%",
        padding: "14px 16px",
        borderRadius: 14,
        border: `2px solid ${C.warmGray}`,
        background: C.white,
        fontSize: ts(A11Y.minBodyPx),
        lineHeight: 1.55,
        fontFamily: "inherit",
        color: C.textMain,
        resize: "vertical",
      }}
    />
  );
}

const counterBtn = (ts) => ({
  width: 64,
  height: 64,
  borderRadius: 20,
  border: `2px solid ${C.green}`,
  background: C.white,
  color: C.green,
  fontSize: ts(30),
  fontWeight: 700,
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});

/* Moods: the selected ids (new shape) or the single legacy choice. */
export function moodChoices(v) {
  if (Array.isArray(v?.choices) && v.choices.length) return v.choices;
  return v?.choice ? [v.choice] : [];
}
/* The lowest mood among the chosen — the character's tone and the
   welfare column both listen to the heaviest note of the day. */
export function lowestMoodId(v) {
  const ids = moodChoices(v);
  let best = null;
  for (const id of ids) {
    const i = MOODS.findIndex((m) => m.id === id);
    if (i === -1) continue;
    if (best === null || i > best) best = i;
  }
  return best === null ? null : MOODS[best].id;
}

/* ─── Per-module editors ─── */

function MoodEditor({ value, onChange, iconId, dateIso }) {
  const { t, ts } = useI18n();
  const chosen = moodChoices(value);
  const lowest = MOODS.find((m) => m.id === lowestMoodId(value));
  const toggle = (id) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    onChange({ ...value, choices: next, choice: lowestMoodId({ choices: next }) });
  };
  return (
    <div>
      <p style={{ fontSize: ts(17), color: C.textMuted, margin: "0 0 8px" }}>{t("home.log.moodMulti")}</p>
      <div role="group" aria-label={t("home.log.moodMulti")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8 }}>
        {MOODS.map((m) => {
          const selected = chosen.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggle(m.id)}
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
              <span style={{ fontSize: ts(30), lineHeight: 1 }} aria-hidden="true">{m.face}</span>
              <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: selected ? 700 : 500, color: selected ? C.green : C.textMain }}>
                {selected ? "✓ " : ""}
                {t(m.labelKey)}
              </span>
            </button>
          );
        })}
      </div>

      {chosen.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <NoteArea
            value={value.note}
            onChange={(note) => onChange({ ...value, note })}
            placeholder={t((lowest || MOODS[1]).phKey)}
            ariaLabel={t("home.log.noteAria")}
          />
          <VoiceNote
            iconId={iconId}
            dateIso={dateIso}
            moduleKey="mood"
            value={value.voice || null}
            onChange={(voice) => onChange({ ...value, voice })}
          />
          <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
            {t("home.log.moodPrivate")}
          </p>
        </div>
      )}
    </div>
  );
}

function SleepEditor({ value, onChange }) {
  const { t, ts } = useI18n();
  const [showTimes, setShowTimes] = useState(false);
  return (
    <div>
      <EditorLabel>{t("home.log.hoursQ")}</EditorLabel>
      <ChipRow>
        {SLEEP_HOURS.map((h) => (
          <Chip key={h} role="radio" selected={value.hours === h} onClick={() => onChange({ ...value, hours: h })} label={t("home.log.hoursAria", { h })}>
            {h}
          </Chip>
        ))}
      </ChipRow>
      <EditorLabel>{t("home.log.feelQ")}</EditorLabel>
      <ChipRow columns={3}>
        {SLEEP_QUALITY.map((q) => (
          <Chip key={q.id} role="radio" selected={value.quality === q.id} onClick={() => onChange({ ...value, quality: q.id })}>
            <span aria-hidden="true" style={{ fontSize: ts(24) }}>{q.face}</span> {t(q.labelKey)}
          </Chip>
        ))}
      </ChipRow>
      <button
        type="button"
        onClick={() => setShowTimes(!showTimes)}
        aria-expanded={showTimes}
        style={{ minHeight: A11Y.minTapTargetPx, marginTop: 14, padding: "0 4px", background: "none", border: "none", color: C.green, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, fontFamily: "inherit", textDecoration: "underline", cursor: "pointer" }}
      >
        {showTimes ? t("home.log.hideTimes") : t("home.log.addTimes")}
      </button>
      {showTimes && (
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {[["bed", t("home.log.wentToBed")], ["wake", t("home.log.wokeUp")]].map(([key, label]) => (
            <label key={key} style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, display: "flex", flexDirection: "column", gap: 6 }}>
              {label}
              <input
                type="time"
                value={value[key] || ""}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                style={{ minHeight: A11Y.minTapTargetPx, padding: "0 12px", borderRadius: 12, border: `2px solid ${C.warmGray}`, fontSize: ts(A11Y.minBodyPx), fontFamily: "inherit", background: C.white, color: C.textMain }}
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
  const { t, ts } = useI18n();
  return (
    <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "8px 0 4px", lineHeight: 1.55 }}>
      {children}{" "}
      <Link to="/app/settings" style={{ color: C.green, fontWeight: 600 }}>
        {t("home.log.openSettings")}
      </Link>
    </p>
  );
}

function MedicationEditor({ value, onChange, meds }) {
  const { t, ts } = useI18n();
  const taken = value.taken || [];
  const toggle = (id) => onChange({ ...value, taken: taken.includes(id) ? taken.filter((x) => x !== id) : [...taken, id] });
  if (meds.length === 0) return <SettingsDoor>{t("home.log.medsEmpty")}</SettingsDoor>;
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
              style={{ minHeight: 60, display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: 14, border: `2px solid ${done ? C.green : C.warmGray}`, background: done ? "#eef3ea" : C.white, fontFamily: "inherit", textAlign: "start", width: "100%" }}
            >
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 9, border: `2.5px solid ${done ? C.green : C.textMuted}`, background: done ? C.green : C.white, color: C.cream, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: ts(20), fontWeight: 700, flexShrink: 0 }}>
                {done ? "✓" : ""}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: ts(17), fontWeight: 600, color: C.textMain }}>{med.name}</span>
                {(med.dose || med.time) && (
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>{[med.dose, med.time].filter(Boolean).join(" · ")}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>{t("home.log.medsNote")}</p>
    </div>
  );
}

function ExerciseEditor({ value, onChange, iconId, dateIso }) {
  const { t } = useI18n();
  return (
    <div>
      <EditorLabel>{t("home.log.moveQ")}</EditorLabel>
      <ChipRow>
        {EXERCISE_TYPES.map((et) => (
          <Chip key={et.id} role="radio" selected={value.type === et.id} onClick={() => onChange({ ...value, type: et.id })}>
            <span aria-hidden="true">{et.icon}</span> {t(et.labelKey)}
          </Chip>
        ))}
      </ChipRow>
      <EditorLabel>{t("home.log.howLongQ")}</EditorLabel>
      <ChipRow>
        {EXERCISE_MINUTES.map((m) => (
          <Chip key={m} role="radio" selected={value.minutes === m} onClick={() => onChange({ ...value, minutes: m })} label={t("home.log.minutesAria", { m })}>
            {t("home.log.minShort", { m })}
          </Chip>
        ))}
      </ChipRow>
      {value.type && value.minutes && (
        <div style={{ marginTop: 14 }}>
          <NoteArea
            value={value.note}
            onChange={(note) => onChange({ ...value, note })}
            placeholder={t("home.log.exerciseNotePh")}
            ariaLabel={t("home.log.exerciseNoteAria")}
          />
          <VoiceNote
            iconId={iconId}
            dateIso={dateIso}
            moduleKey="exercise"
            value={value.voice || null}
            onChange={(voice) => onChange({ ...value, voice })}
          />
        </div>
      )}
    </div>
  );
}

/* Meals: one row per slot (breakfast/lunch/dinner/snack), many items
   per slot from the person's own library, with an inline "add a new
   item" that lands in the library AND today's slot in one tap. */
function DietEditor({ value, onChange, items, iconId }) {
  const { t, ts } = useI18n();
  const entries = value.entries || {};
  const [slot, setSlot] = useState(MEAL_SLOTS[0]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [tags, setTags] = useState([]);

  const chosen = entries[slot] || [];
  const toggleItem = (id) =>
    onChange({
      ...value,
      entries: { ...entries, [slot]: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] },
    });

  const submitNew = () => {
    const item = addMealItem(iconId, { label, tags });
    if (!item) return;
    onChange({ ...value, entries: { ...entries, [slot]: [...chosen, item.id] } });
    setLabel("");
    setTags([]);
    setAdding(false);
  };

  return (
    <div>
      <EditorLabel>{t("home.log.dietQ")}</EditorLabel>
      <div role="tablist" aria-label={t("home.log.slotLabel")} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {MEAL_SLOTS.map((s) => {
          const n = (entries[s] || []).length;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={slot === s}
              onClick={() => setSlot(s)}
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "8px 14px",
                borderRadius: 50,
                border: `2px solid ${slot === s ? C.green : C.warmGray}`,
                background: slot === s ? C.green : C.white,
                color: slot === s ? C.cream : C.textMain,
                fontSize: ts(17),
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              <span aria-hidden="true">{SLOT_ICON[s]}</span> {t(`home.log.slots.${s}`)}
              {n > 0 ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>

      {items.length === 0 && !adding ? (
        <SettingsDoor>{t("home.log.dietEmpty")}</SettingsDoor>
      ) : (
        <div style={{ marginTop: 12 }}>
          <ChipRow>
            {items.map((m) => (
              <Chip key={m.id} selected={chosen.includes(m.id)} onClick={() => toggleItem(m.id)}>
                {m.label}
                {m.tags?.length > 0 && (
                  <span aria-hidden="true" style={{ fontSize: ts(14), opacity: 0.85 }}>
                    {m.tags.map((tg) => TAG_EMOJI[tg]).join("")}
                  </span>
                )}
              </Chip>
            ))}
          </ChipRow>
        </div>
      )}

      {adding ? (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: `2px dashed ${C.sage}`, background: "#f8faf5" }}>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNew(); } }}
            placeholder={t("home.log.newItemPh")}
            aria-label={t("home.log.newItemPh")}
            style={{ width: "100%", boxSizing: "border-box", minHeight: A11Y.minTapTargetPx, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.warmGray}`, fontSize: ts(A11Y.minBodyPx), fontFamily: "inherit", background: C.white, color: C.textMain, marginBottom: 10 }}
          />
          <TagChips value={tags} onChange={setTags} ts={ts} compact />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" onClick={submitNew} disabled={!label.trim()} style={{ minHeight: A11Y.minTapTargetPx, padding: "0 20px", borderRadius: 50, border: "none", background: C.green, color: C.cream, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, fontFamily: "inherit", opacity: label.trim() ? 1 : 0.5 }}>
              ✓ {t("home.log.newItemAdd")}
            </button>
            <button type="button" onClick={() => { setAdding(false); setLabel(""); setTags([]); }} style={{ minHeight: A11Y.minTapTargetPx, padding: "0 16px", borderRadius: 50, border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMuted, fontSize: ts(A11Y.minBodyPx), fontFamily: "inherit" }}>
              {t("home.log.newItemCancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ minHeight: A11Y.minTapTargetPx, marginTop: 10, padding: "0 16px", borderRadius: 50, border: `2px solid ${C.green}`, background: C.white, color: C.green, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, fontFamily: "inherit" }}
        >
          ＋ {t("home.log.newItemCta")}
        </button>
      )}
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>{t("home.log.dietNote")}</p>
    </div>
  );
}

/* ─── Custom tracker editors (Settings → "your own trackers") ─── */

function TrackerEditor({ tracker, value, onChange }) {
  const { t, ts } = useI18n();
  if (tracker.type === "yesno") {
    const done = !!value.done;
    return (
      <ChipRow>
        <Chip selected={done} onClick={() => onChange({ ...value, done: !done })}>{t("home.log.trackerDone")}</Chip>
      </ChipRow>
    );
  }
  if (tracker.type === "count") {
    const count = value.count || 0;
    const set = (n) => onChange({ ...value, count: Math.max(0, Math.min(99, n)) });
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button type="button" onClick={() => set(count - 1)} aria-label={t("home.log.oneFewer")} style={counterBtn(ts)}>−</button>
        <span role="status" style={{ fontSize: ts(34), fontWeight: 700, color: C.green, minWidth: 60, textAlign: "center" }}>{count}</span>
        <button type="button" onClick={() => set(count + 1)} aria-label={t("home.log.oneMore")} style={counterBtn(ts)}>+</button>
      </div>
    );
  }
  return (
    <NoteArea
      value={value.note}
      onChange={(note) => onChange({ ...value, note })}
      placeholder={t("home.log.trackerNotePh")}
      ariaLabel={t("home.log.trackerNoteAria", { name: tracker.name })}
    />
  );
}

/* Water — canonical ml, shown in the chosen unit. */
function WaterEditor({ value, onChange, unit }) {
  const { t, ts } = useI18n();
  const ml = waterMlOf(value);
  const step = waterStepMl(unit);
  const set = (next) => onChange({ ...value, ml: Math.max(0, Math.min(6000, next)), glasses: undefined });
  const shown = waterToDisplay(ml, unit);
  const goal = waterToDisplay(WATER_GOAL_ML, unit);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <button type="button" onClick={() => set(ml - step)} aria-label={t("home.log.waterFewer")} style={counterBtn(ts)}>−</button>
      <div style={{ textAlign: "center", minWidth: 120 }} role="status">
        <span style={{ display: "block", fontSize: ts(34), fontWeight: 700, color: C.green }}>
          {shown} <span style={{ fontSize: ts(20) }}>{t(`home.log.units.${unit}`)}</span>
        </span>
        <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
          {t("home.log.ofGoal", { n: goal, unit: t(`home.log.units.${unit}`) })}
        </span>
      </div>
      <button type="button" onClick={() => set(ml + step)} aria-label={t("home.log.waterMore")} style={counterBtn(ts)}>+</button>
    </div>
  );
}

/* ─── Entries: enabled modules + custom trackers due that day ─── */

const TRACKER_ICONS = { yesno: "☑️", count: "🔢", note: "📝" };

export function dayEntries(prefs, date) {
  const mods = MODULES.filter((m) => prefs.enabledModules.includes(m.id)).map((m) => ({ kind: "module", key: m.id, id: m.id, icon: m.icon }));
  const trackers = (prefs.trackers || [])
    .filter((tr) => trackerDueOn(tr, date))
    .map((tr) => ({ kind: "tracker", key: `tracker:${tr.id}`, id: tr.id, name: tr.name, icon: TRACKER_ICONS[tr.type] || "☑️", tracker: tr }));
  return [...mods, ...trackers];
}

const dietItemIds = (v) => {
  if (v?.entries) return Object.values(v.entries).flat();
  return v?.meals || [];
};

export function isEntryDone(entry, log) {
  const v = log[entry.key];
  if (!v) return false;
  if (entry.kind === "tracker") {
    switch (entry.tracker.type) {
      case "yesno": return !!v.done;
      case "count": return (v.count || 0) > 0;
      case "note": return !!(v.note || "").trim();
      default: return false;
    }
  }
  switch (entry.id) {
    case "mood": return moodChoices(v).length > 0;
    case "sleep": return !!v.hours && !!v.quality;
    case "medication": return (v.taken || []).length > 0;
    case "exercise": return !!v.type && !!v.minutes;
    case "diet": return dietItemIds(v).length > 0;
    case "water": return waterMlOf(v) > 0;
    default: return false;
  }
}

export function isModuleDone(id, log) {
  return isEntryDone({ kind: "module", key: id, id }, log);
}

function summaryFor(entry, log, prefs, t) {
  const v = log[entry.key] || {};
  if (entry.kind === "tracker") {
    switch (entry.tracker.type) {
      case "yesno": return v.done ? t("home.log.sumDone") : null;
      case "count": return (v.count || 0) > 0 ? `${v.count}` : null;
      case "note": return (v.note || "").trim() ? t("home.log.sumNoted") : null;
      default: return null;
    }
  }
  switch (entry.id) {
    case "mood": {
      const ms = moodChoices(v).map((id) => MOODS.find((x) => x.id === id)).filter(Boolean);
      if (!ms.length) return null;
      return ms.map((m) => `${t(m.labelKey)} ${m.face}`).join(" + ") + (v.voice?.path ? " 🎙️" : "");
    }
    case "sleep": {
      const q = SLEEP_QUALITY.find((x) => x.id === v.quality);
      return v.hours && q ? t("home.log.sumSleep", { h: v.hours, q: t(q.labelKey) }) : null;
    }
    case "medication": {
      // Count only ticks for medicines still on the list — a removed
      // medicine must never produce "3 of 1 ticked".
      const known = new Set((prefs.medications || []).map((m) => m.id));
      const ticks = (v.taken || []).length;
      const n = (v.taken || []).filter((id) => known.has(id)).length;
      if (n > 0) return t("home.log.sumMeds", { n, total: prefs.medications.length });
      // Ticked, but every one of those medicines has since been removed
      // from the list: the day still counts, it just has nothing to name.
      return ticks > 0 ? t("home.log.sumDone") : null;
    }
    case "exercise": {
      const et = EXERCISE_TYPES.find((x) => x.id === v.type);
      return et && v.minutes ? `${t(et.labelKey)} · ${t("home.log.minShort", { m: v.minutes })}${v.voice?.path ? " 🎙️" : ""}` : null;
    }
    case "diet": {
      const byId = Object.fromEntries((prefs.mealItems || []).map((m) => [m.id, m.label]));
      if (v.entries) {
        const parts = MEAL_SLOTS.filter((s) => (v.entries[s] || []).length).map(
          (s) => `${t(`home.log.slots.${s}`)}: ${v.entries[s].map((id) => byId[id] || "…").join(", ")}`
        );
        return parts.length ? parts.join(" · ") : null;
      }
      const n = (v.meals || []).length;
      return n > 0 ? t("home.log.sumDiet", { n }) : null;
    }
    case "water": {
      const ml = waterMlOf(v);
      if (ml <= 0) return null;
      const unit = prefs.units?.water || "glasses";
      return `${waterToDisplay(ml, unit)} ${t(`home.log.units.${unit}`)}`;
    }
    default: return null;
  }
}

/* What a closed row still shows: the note, the recording, the meals
   eaten. Read-only — the day view is a record, not a form. */
function EntryDetail({ entry, value, prefs }) {
  const { t, ts } = useI18n();
  if (entry.kind !== "module") return null;
  const v = value || {};
  const note = (v.note || "").trim();
  if (entry.id === "mood" || entry.id === "exercise") {
    if (!note && !v.voice?.path) return null;
    return (
      <div style={{ padding: "0 16px 14px" }}>
        {note && <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, margin: "4px 0 0", lineHeight: 1.55 }}>“{note}”</p>}
        <VoicePlayer voice={v.voice} compact />
      </div>
    );
  }
  if (entry.id === "diet" && v.entries) {
    const byId = Object.fromEntries((prefs.mealItems || []).map((m) => [m.id, m]));
    const slots = MEAL_SLOTS.filter((s) => (v.entries[s] || []).length);
    if (!slots.length) return null;
    return (
      <div style={{ padding: "0 16px 14px" }}>
        {slots.map((s) => (
          <p key={s} style={{ fontSize: ts(A11Y.minBodyPx), margin: "4px 0 0", lineHeight: 1.55 }}>
            <span aria-hidden="true">{SLOT_ICON[s]}</span> <strong>{t(`home.log.slots.${s}`)}</strong>:{" "}
            {v.entries[s].map((id) => byId[id]?.label || "…").join(", ")}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

/* ─── The card ─── */

export default function DailyLogCard({ iconId, log, onChange, editable, restDay, dayLabel, isToday, date }) {
  const { t, ts, meta } = useI18n();
  const prefs = useIconPrefs(iconId);
  const entries = dayEntries(prefs, date);
  const moodDone = isModuleDone("mood", log);
  /* ── NOTHING CLOSES ITSELF WHEN YOU OPEN SOMETHING ELSE ──

     This was one-open-at-a-time, and that is the whole jump. Opening a
     lower entry closed the one above it and took its height out of the
     page, so everything below rose. Measured on the deployed build:
     tapping Movement while Mood was open moved Movement 360px up, out
     from under the finger.

     I first fixed it by measuring the tapped row and scrolling to
     compensate. That is correct and it is not enough: near the top of
     the page there is nowhere to scroll TO. It needed 360px of upward
     scroll with 260px available, so it clamped and left exactly 100px
     of jump — which the check caught, and which no amount of tuning
     removes, because the page has run out of room rather than the
     arithmetic being wrong.

     So the collapse goes. An entry opens and closes on its own tap and
     nothing else moves. Whatever is above stays exactly where it is,
     which means the answer to "the screen must not move" is that there
     is no longer anything to move.

     It also happens to suit a log: filling one in, you can see what you
     already answered instead of it folding away behind you. The
     compensation below stays for the one case that still shifts —
     closing an entry you are looking at. */
  const [openIds, setOpenIds] = useState(() => (moodDone ? [] : ["mood"]));
  const toggleOpen = (key) =>
    setOpenIds((ids) => (ids.includes(key) ? ids.filter((k) => k !== key) : [...ids, key]));

  /* ── THE ROW YOU TAPPED STAYS WHERE YOU TAPPED IT ──

     One entry is open at a time, so opening a lower one CLOSES the one
     above and takes its height out of the page. Everything below rises.

     Measured on the deployed build, tapping Movement while Mood was
     open: Movement went from 779 to 419 — it moved 360px up, out from
     under the finger, in the frame after the tap. Sleep went from 697
     to 337. scrollY did not change, so Chrome's scroll anchoring did
     not compensate; that is not something to rely on and it did not
     fire here.

     What a person sees is the screen leaping upward as they tap, and
     whatever they meant to read is somewhere else. On a screen built
     for people who may already find small targets hard, the content
     moving under the finger is close to the worst thing an interface
     can do.

     So the tapped button is measured before the change and the page is
     scrolled by exactly the amount it moved. In a LAYOUT effect, which
     runs after the DOM changes and before the browser paints — so the
     correction is never seen, the row simply does not move. The button
     element itself is the anchor: React keeps the same DOM node across
     this re-render, so there is no ref map to maintain. */
  /* ── FINISHING FEELS LIKE FINISHING ──

     Completing the day said nothing at all. The last entry closed like
     any other and the screen simply sat there, so the one moment worth
     marking passed in silence — and `logDoneChip` had been sitting in
     both locale files with no consumer anywhere in the app.

     Two things, and neither interrupts. A line that appears IN PLACE at
     the moment the last entry is answered, and a quiet standing state
     that says the day is done whenever the card is opened again. No
     modal: a person who has just finished should not have to dismiss
     something to prove it.

     It fires on the TRANSITION, not on the state, so it does not
     reappear every time an already-finished log is opened. And it
     leaves on its own after a few seconds rather than needing a tap.

     POINTS ARE NOT MENTIONED HERE. Whatever the scoring turns out to
     be, this moment is about the day being written down. */
  const allDone = entries.length > 0 && entries.every((m) => isEntryDone(m, log));
  const wasDone = useRef(allDone);
  const [justFinished, setJustFinished] = useState(false);
  useEffect(() => {
    if (allDone && !wasDone.current) {
      setJustFinished(true);
      const t = window.setTimeout(() => setJustFinished(false), 6000);
      wasDone.current = allDone;
      return () => window.clearTimeout(t);
    }
    wasDone.current = allDone;
    return undefined;
  }, [allDone]);

  const pinned = useRef(null);
  useLayoutEffect(() => {
    const a = pinned.current;
    pinned.current = null;
    if (!a || !a.el.isConnected) return;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
  }, [openIds]);
  const dateIso = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";

  const entryName = (entry) => (entry.kind === "module" ? t(`settings.dailyLog.modules.${entry.id}`) : entry.name);

  return (
    <section
      aria-label={isToday ? t("home.log.titleToday") : t("home.log.titleFor", { day: dayLabel })}
      style={{ background: C.white, borderRadius: 22, border: `1.5px solid ${C.warmGray}`, boxShadow: "0 4px 20px rgba(87, 52, 37, 0.07)", padding: "22px 20px", marginBottom: 20 }}
    >
      <div style={{ marginBottom: 6 }}>
        <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(25), fontWeight: 700, color: C.brown, margin: 0 }}>
          {isToday ? t("home.log.titleToday") : t("home.log.titleFor", { day: dayLabel })}
        </h2>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "6px 0 0", lineHeight: 1.5 }}>{t("home.log.intro")}</p>
      </div>

      {restDay && (
        <p style={{ fontSize: ts(A11Y.minBodyPx), lineHeight: 1.55, color: C.green, background: "#eef3ea", border: `2px solid ${C.sage}`, borderRadius: 14, padding: "12px 16px", margin: "14px 0 4px" }}>
          {t("home.log.restBanner")}
        </p>
      )}

      {!editable && (
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "14px 0 4px", lineHeight: 1.5 }}>{t("home.log.settled")}</p>
      )}

      {allDone && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: justFinished ? "14px 16px" : "10px 16px",
            borderRadius: 16,
            background: C.selected,
            borderInlineStart: `4px solid ${C.green}`,
          }}
        >
          <p style={{ margin: 0, fontSize: ts(justFinished ? 20 : A11Y.minBodyPx), fontWeight: 700, color: C.green, lineHeight: 1.35 }}>
            {justFinished ? t("home.log.justDone") : t("home.log.allDoneChip")}
          </p>
          {justFinished && (
            <p style={{ margin: "6px 0 0", fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.5 }}>
              {t("home.log.justDoneSub")}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((mod) => {
          const done = isEntryDone(mod, log);
          const open = openIds.includes(mod.key);
          const summary = summaryFor(mod, log, prefs, t);
          return (
            <div key={mod.key} style={{ border: `2px solid ${open ? C.greenMuted : done ? C.sage : C.warmGray}`, borderRadius: 16, overflow: "hidden" }}>
              <button
                type="button"
                aria-expanded={open}
                disabled={!editable}
                onClick={(ev) => {
                  pinned.current = {
                    el: ev.currentTarget,
                    top: ev.currentTarget.getBoundingClientRect().top,
                  };
                  toggleOpen(mod.key);
                }}
                style={{ width: "100%", minHeight: 60, display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: done ? "#f4f7f1" : C.white, border: "none", fontFamily: "inherit", textAlign: "start", cursor: editable ? "pointer" : "default" }}
              >
                <Icon name={mod.icon} size={24} style={{ color: C.green }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>{entryName(mod)}</span>
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: done ? C.green : C.textMuted, overflowWrap: "anywhere" }}>
                    {done ? `✓ ${summary || t("home.log.sumDone")}` : editable ? t("home.log.tapToAdd") : "—"}
                  </span>
                </span>
                {editable && (
                  <span aria-hidden="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, fontWeight: 700 }}>{open ? "▲" : "▼"}</span>
                )}
              </button>
              {/* The day view reads as a record: whenever a row is
                  closed, what was written or spoken stays visible —
                  on today, on a backfill day, and on settled days. */}
              {done && !open && <EntryDetail entry={mod} value={log[mod.key]} prefs={prefs} />}
              {open && editable && (
                <div style={{ padding: "6px 16px 18px", background: C.white }}>
                  <EntryEditor entry={mod} prefs={prefs} iconId={iconId} dateIso={dateIso} value={log[mod.key] || {}} onChange={(v) => onChange(mod.key, v)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "16px 0 0", lineHeight: 1.5 }}>
        {t("home.log.chooseHere")}{" "}
        <Link to="/app/settings" style={{ color: C.green, fontWeight: 600 }}>{t("home.log.fromSettings")}</Link>.
      </p>
    </section>
  );
}

function EntryEditor({ entry, prefs, iconId, dateIso, value, onChange }) {
  if (entry.kind === "tracker") return <TrackerEditor tracker={entry.tracker} value={value} onChange={onChange} />;
  switch (entry.id) {
    case "mood": return <MoodEditor value={value} onChange={onChange} iconId={iconId} dateIso={dateIso} />;
    case "sleep": return <SleepEditor value={value} onChange={onChange} />;
    case "medication": return <MedicationEditor value={value} onChange={onChange} meds={prefs.medications} />;
    case "exercise": return <ExerciseEditor value={value} onChange={onChange} iconId={iconId} dateIso={dateIso} />;
    case "diet": return <DietEditor value={value} onChange={onChange} items={prefs.mealItems} iconId={iconId} />;
    case "water": return <WaterEditor value={value} onChange={onChange} unit={prefs.units?.water || "glasses"} />;
    default: return null;
  }
}
