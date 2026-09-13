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
import { Link, useNavigate } from "react-router-dom";
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
import { useIconPrefs, trackerDueOn, addMealCategory, addMovementOption, listItemName } from "../../lib/iconPrefs.js";
import { WATER_GOAL_ML, waterToDisplay, waterStepMl, waterMlOf } from "../../lib/units.js";
import VoiceNote, { VoicePlayer } from "./VoiceNote.jsx";
import { useMyStreaks, streakFor, itemValueFromLog } from "../streaks/streaksData.js";
import { CreateStreakSheet, SendStreakSheet } from "../streaks/StreakSheets.jsx";
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];
/* Drawn icons, matching the rest of the log (were emoji). */
const SLOT_ICON = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snack" };

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
function SettingsDoor({ children, noLinks }) {
  const { t, ts } = useI18n();
  return (
    <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "8px 0 4px", lineHeight: 1.55 }}>
      {children}
      {/* The focused streak window shows ONE item and may not open a way
          into anything else, so there the door is words only. */}
      {!noLinks && (
        <>
          {" "}
          <Link to="/app/settings" style={{ color: C.green, fontWeight: 600 }}>
            {t("home.log.openSettings")}
          </Link>
        </>
      )}
    </p>
  );
}

function MedicationEditor({ value, onChange, meds, noLinks }) {
  const { t, ts } = useI18n();
  const taken = value.taken || [];
  const toggle = (id) => onChange({ ...value, taken: taken.includes(id) ? taken.filter((x) => x !== id) : [...taken, id] });
  if (meds.length === 0) return <SettingsDoor noLinks={noLinks}>{t("home.log.medsEmpty")}</SettingsDoor>;
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

/* ════════════════════════════════════════════════
   MOVEMENT AND MEALS — the person's own lists (2026-09-13)

   Owner: movement is customised from Settings exactly as meals are, and
   the meal log asks ONE category at a time — did you have it, and if
   so, roughly how many portions of fibre, protein and carbs, any of
   which may be left blank. No counts exactly as Yes.

   THE RECORD KEEPS WHAT WAS ENTERED. Every answer stores the name (or,
   for an untouched default, the key its name is translated from)
   beside it, so renaming or removing a meal or an activity later can
   never rewrite a day that has already been lived. The database refuses
   a meal or movement entry that carries no name (0119), so this holds
   for every build of the app, not only this one.

   PORTIONS ARE A RECORD, NOT A PRESCRIPTION. 0 upwards with no ceiling, no targets, no
   totals, no colour that could read as pass or fail. Somebody who eats
   a lot of rice is never judged by their own log.
   ════════════════════════════════════════════════ */

const MEAL_OWN_ICONS = ["breakfast", "lunch", "dinner"];
const mealIcon = (id) => (MEAL_OWN_ICONS.includes(id) ? id : "diet");
const mealName = (cat, t) => listItemName(cat, t, "home.log.slots");
const movementName = (opt, t) => listItemName(opt, t, "home.exercise");

/* A name as the DAY recorded it: a default's key shown in the reader's
   language, the person's own words verbatim. */
function recordedName(rec, t, ns) {
  if (!rec) return "";
  if (rec.key) {
    const s = t(ns + "." + rec.key);
    if (s && s !== ns + "." + rec.key) return s;
  }
  return rec.name || "";
}

const PORTION_KINDS = ["fibre", "protein", "carbs"];
/* No PORTION_MAX. There was one, at 5, and a ceiling on a count of what
   somebody ate silently tells them their honest answer is out of range. */

function portionsLine(a, t) {
  return PORTION_KINDS.filter((k) => a && a[k] != null)
    .map((k) => t("home.log.portions." + k) + " " + a[k])
    .join(" · ");
}

function answerLine(a, t) {
  if (!a || typeof a.had !== "boolean") return t("home.log.notYet");
  if (!a.had) return t("home.log.mealNo");
  return [t("home.log.mealYes"), portionsLine(a, t)].filter(Boolean).join(" · ");
}

/* Meals are done when every category on the list has a Yes or a No.
   Older days that ticked foods count as they always did. */
function mealsDone(entry, v) {
  const answers = v && v.answers && typeof v.answers === "object" ? v.answers : null;
  if (answers) {
    const cats = entry.categories || [];
    return cats.length > 0 && cats.every((c) => typeof (answers[c.id] || {}).had === "boolean");
  }
  return dietItemIds(v).length > 0;
}

/* "2 of 3" on the closed row until the last meal is answered. */
function progressFor(entry, log, t) {
  if (entry.kind !== "module" || entry.id !== "diet") return null;
  const v = log[entry.key];
  const answers = v && v.answers;
  const cats = entry.categories || [];
  if (!answers || !cats.length) return null;
  const n = cats.filter((c) => typeof (answers[c.id] || {}).had === "boolean").length;
  return n > 0 ? t("home.log.mealsProgress", { n, total: cats.length }) : null;
}

/* Add to your own list from inside the log, so an empty list is never a
   dead end. It is the same list Settings edits. */
function InlineAdd({ placeholder, cta, onAdd }) {
  const { ts } = useI18n();
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ flex: "1 1 200px", minWidth: 0, minHeight: A11Y.minTapTargetPx, padding: "0 14px", borderRadius: 12, border: "2px solid " + C.warmGray, fontSize: ts(A11Y.minBodyPx), fontFamily: "inherit", background: C.white, color: C.textMain }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        style={{ minHeight: A11Y.minTapTargetPx, padding: "0 20px", borderRadius: 50, border: "none", background: C.green, color: C.cream, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, fontFamily: "inherit", opacity: text.trim() ? 1 : 0.5 }}
      >
        {cta}
      </button>
    </div>
  );
}

function MovementEditor({ value, onChange, options, iconId, dateIso }) {
  const { t, ts } = useI18n();
  const chosenId = (value.activity && value.activity.id) || value.type || null;
  const choose = (opt) =>
    onChange({
      ...value,
      type: opt.id,
      activity: { id: opt.id, key: opt.key || null, name: movementName(opt, t) },
    });
  const orphan = !!chosenId && !options.some((o) => o.id === chosenId);
  return (
    <div>
      <EditorLabel>{t("home.log.moveQ")}</EditorLabel>
      {options.length === 0 && !orphan ? (
        <>
          <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "4px 0 0", lineHeight: 1.55 }}>{t("home.log.movementEmpty")}</p>
          <InlineAdd
            placeholder={t("home.log.addMovementPh")}
            cta={t("home.log.addToList")}
            onAdd={(name) => { const o = addMovementOption(iconId, name); if (o) choose(o); }}
          />
        </>
      ) : (
        <ChipRow>
          {options.map((opt) => (
            <Chip key={opt.id} role="radio" selected={chosenId === opt.id} onClick={() => choose(opt)}>
              <Icon name="exercise" size={20} /> {movementName(opt, t)}
            </Chip>
          ))}
          {/* Chosen on this day and no longer on the list: still shown, by
              the name the day recorded. */}
          {orphan && (
            <Chip role="radio" selected onClick={() => {}}>
              <Icon name="exercise" size={20} /> {recordedName(value.activity || { key: value.type }, t, "home.exercise")}
            </Chip>
          )}
        </ChipRow>
      )}
      {/* How long is asked AFTER the activity and is optional: the activity
          is the answer. Tapping the chosen time again clears it. */}
      {chosenId && (
        <>
          <EditorLabel>{t("home.log.howLongQ")}</EditorLabel>
          <ChipRow>
            {EXERCISE_MINUTES.map((m) => (
              <Chip key={m} role="radio" selected={value.minutes === m} onClick={() => onChange({ ...value, minutes: value.minutes === m ? null : m })} label={t("home.log.minutesAria", { m })}>
                {t("home.log.minShort", { m })}
              </Chip>
            ))}
          </ChipRow>
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
        </>
      )}
    </div>
  );
}

/* A portion count that starts BLANK. Blank and 0 are different answers:
   "didn't say" is not "none". Down from blank is 0, down from 0 is blank
   again, and up has no ceiling: a count is a record of what was eaten,
   never a range it has to fit. Neutral ink — nothing reads as too much
   or too little at any number. */
function PortionCounter({ kind, value, onChange }) {
  const { t, ts } = useI18n();
  const label = t("home.log.portions." + kind);
  const blank = value == null;
  const down = () => onChange(blank ? 0 : value === 0 ? null : value - 1);
  const up = () => onChange(blank ? 1 : value + 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, color: C.textMain }}>{label}</span>
      <button type="button" onClick={down} aria-label={t("home.log.portionFewer", { what: label })} style={{ ...counterBtn(ts), width: 52, height: 52 }}>−</button>
      <span
        role="status"
        aria-label={blank ? t("home.log.portionBlankAria", { what: label }) : t("home.log.portionAria", { what: label, n: value })}
        /* Wide enough that two digits do not push the buttons; tabular figures
           so 9 to 10 does not shift the row. */
        style={{ minWidth: 56, textAlign: "center", fontSize: ts(28), fontWeight: 700, color: C.textMain, fontVariantNumeric: "tabular-nums" }}
      >
        {blank ? "—" : value}
      </span>
      <button type="button" onClick={up} aria-label={t("home.log.portionMore", { what: label })} style={{ ...counterBtn(ts), width: 52, height: 52 }}>+</button>
    </div>
  );
}

function MealEditor({ value, onChange, categories, iconId }) {
  const { t, ts } = useI18n();
  const answers = value.answers && typeof value.answers === "object" ? value.answers : {};
  const answered = (cat) => typeof (answers[cat.id] || {}).had === "boolean";
  const [currentId, setCurrentId] = useState(() => {
    const first = categories.find((c) => !answered(c));
    return first ? first.id : null;
  });
  const doneCount = categories.filter(answered).length;

  /* Every save carries the meal's name as shown now, so the day keeps it
     whatever happens to the list afterwards. */
  const save = (cat, patch) => {
    const prev = answers[cat.id] || {};
    onChange({ ...value, answers: { ...answers, [cat.id]: { ...prev, key: cat.key || null, name: mealName(cat, t), ...patch } } });
  };
  const nextAfter = (catId) => {
    const i = categories.findIndex((c) => c.id === catId);
    const later = categories.slice(i + 1).find((c) => !answered(c));
    const earlier = categories.slice(0, Math.max(i, 0)).find((c) => !answered(c) && c.id !== catId);
    const n = later || earlier;
    return n ? n.id : null;
  };

  if (categories.length === 0) {
    return (
      <div>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "4px 0 0", lineHeight: 1.55 }}>{t("home.log.mealsEmpty")}</p>
        <InlineAdd
          placeholder={t("home.log.addMealPh")}
          cta={t("home.log.addToList")}
          onAdd={(name) => { const c = addMealCategory(iconId, name); if (c) setCurrentId(c.id); }}
        />
      </div>
    );
  }

  const orphans = Object.keys(answers).filter((id) => !categories.some((c) => c.id === id) && typeof (answers[id] || {}).had === "boolean");

  return (
    <div>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "4px 0 10px" }}>
        {t("home.log.mealsProgress", { n: doneCount, total: categories.length })}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {categories.map((cat) => {
          const a = answers[cat.id];
          const isCurrent = currentId === cat.id;
          return (
            <div key={cat.id} style={{ border: "2px solid " + (isCurrent ? C.greenMuted : C.warmGray), borderRadius: 14, background: C.white }}>
              <button
                type="button"
                aria-expanded={isCurrent}
                onClick={() => setCurrentId(isCurrent ? null : cat.id)}
                style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", background: "none", border: "none", fontFamily: "inherit", textAlign: "start", cursor: "pointer" }}
              >
                <Icon name={mealIcon(cat.id)} size={22} style={{ color: C.green }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>{mealName(cat, t)}</span>
                  <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>{answerLine(a, t)}</span>
                </span>
              </button>
              {isCurrent && (
                <div style={{ padding: "0 14px 14px" }}>
                  <p style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "4px 0 10px", lineHeight: 1.4 }}>
                    {t("home.log.mealQ", { name: mealName(cat, t) })}
                  </p>
                  <div role="radiogroup" aria-label={t("home.log.mealQ", { name: mealName(cat, t) })} style={{ display: "flex", gap: 10 }}>
                    <Chip role="radio" selected={!!a && a.had === true} onClick={() => save(cat, { had: true })}>
                      {t("home.log.yes")}
                    </Chip>
                    <Chip role="radio" selected={!!a && a.had === false} onClick={() => { save(cat, { had: false, fibre: null, protein: null, carbs: null }); setCurrentId(nextAfter(cat.id)); }}>
                      {t("home.log.no")}
                    </Chip>
                  </div>
                  {a && a.had === true && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 4px", lineHeight: 1.5 }}>{t("home.log.portionsHint")}</p>
                      {PORTION_KINDS.map((kind) => (
                        <PortionCounter key={kind} kind={kind} value={a[kind] == null ? null : a[kind]} onChange={(n) => save(cat, { [kind]: n })} />
                      ))}
                      <button
                        type="button"
                        onClick={() => setCurrentId(nextAfter(cat.id))}
                        style={{ minHeight: A11Y.minTapTargetPx, marginTop: 10, padding: "0 22px", borderRadius: 50, border: "none", background: C.green, color: C.cream, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, fontFamily: "inherit" }}
                      >
                        {nextAfter(cat.id) ? t("home.log.nextMeal") : t("home.log.mealsFinish")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* Answered on this day for a meal since taken off the list: kept,
            by the name the day recorded. */}
        {orphans.map((id) => (
          <p key={id} style={{ fontSize: ts(16), color: C.textMuted, margin: "2px 4px" }}>
            {recordedName(answers[id], t, "home.log.slots")}: {answerLine(answers[id], t)}
          </p>
        ))}
      </div>
      {doneCount === categories.length && (
        <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.green, fontWeight: 700, margin: "12px 0 0" }}>
          {t("home.log.mealsDoneLine")}
        </p>
      )}
      <p style={{ fontSize: ts(16), color: C.textMuted, margin: "10px 0 0", lineHeight: 1.5 }}>{t("home.log.mealsNote")}</p>
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
  const mods = MODULES.filter((m) => prefs.enabledModules.includes(m.id)).map((m) => ({ kind: "module", key: m.id, id: m.id, icon: m.icon, categories: m.id === "diet" ? prefs.mealCategories : undefined }));
  const trackers = (prefs.trackers || [])
    .filter((tr) => trackerDueOn(tr, date))
    .map((tr) => ({ kind: "tracker", key: `tracker:${tr.id}`, id: tr.id, name: tr.name, icon: TRACKER_ICONS[tr.type] || "☑️", tracker: tr }));
  return [...mods, ...trackers];
}

const dietItemIds = (v) => {
  if (v?.entries) return Object.values(v.entries).flat();
  return v?.meals || [];
};

/* One entry by its key, built exactly as the card builds it — for the
   focused streak window, which edits a single item and nothing else. */
export function entryForKey(prefs, key) {
  if (String(key).startsWith("tracker:")) {
    const id = String(key).slice("tracker:".length);
    const tr = (prefs.trackers || []).find((x) => x.id === id);
    return tr ? { kind: "tracker", key, id, name: tr.name, icon: TRACKER_ICONS[tr.type] || "☑️", tracker: tr } : null;
  }
  const m = MODULES.find((x) => x.id === key);
  if (!m) return null;
  return { kind: "module", key, id: key, icon: m.icon, categories: key === "diet" ? prefs.mealCategories : undefined };
}

export function SingleItemEditor({ iconId, itemKey, value, onChange, dateIso }) {
  const prefs = useIconPrefs(iconId);
  const entry = entryForKey(prefs, itemKey);
  if (!entry) return null;
  return <EntryEditor entry={entry} prefs={prefs} iconId={iconId} dateIso={dateIso} value={value || {}} onChange={onChange} noLinks />;
}

/* ── THE STREAK CONTROL ON A ROW (streaks mock, screen 1) ──
   A filled pill with the run when a streak exists, a dashed "+ streak"
   when none does. Never created for anyone: the dashed pill only opens
   the question. The pill is drawn small, as the mock has it, inside a
   48px target. */
function StreakControl({ streak, name, onPress }) {
  const { t, ts } = useI18n();
  const has = !!streak;
  return (
    <button
      type="button"
      data-streak-pill={has ? "on" : "new"}
      onClick={onPress}
      aria-label={has ? t("streaks.pillAria", { item: name, n: streak.run }) : t("streaks.pillNewAria", { item: name })}
      style={{ minHeight: 48, minWidth: 48, paddingInline: "4px 12px", background: "transparent", border: "none", display: "inline-flex", alignItems: "center", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 14,
          padding: "5px 11px",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          whiteSpace: "nowrap",
          ...(has
            ? { background: C.green, color: C.white, border: `1.5px solid ${C.green}` }
            : { background: "transparent", color: C.green, border: `1.5px dashed ${C.green}` }),
        }}
      >
        {has ? <>🔥 {streak.run}</> : t("streaks.pillNew")}
      </span>
    </button>
  );
}

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
    /* An activity is an answer. How long is extra, and asked as
       optional: requiring both meant somebody who chose "A walk" saw
       "Tap to add" with nothing saying what was still missing. */
    case "exercise": return !!(v.activity || v.type);
    case "diet": return mealsDone(entry, v);
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
      const rec = v.activity || (v.type ? { key: v.type, name: null } : null);
      const name = recordedName(rec, t, "home.exercise");
      if (!name) return null;
      return [name, v.minutes ? t("home.log.minShort", { m: v.minutes }) : null].filter(Boolean).join(" · ");
    }
    case "diet": {
      if (v.answers && typeof v.answers === "object") {
        const cats = entry.categories || [];
        const ids = [...cats.map((c) => c.id), ...Object.keys(v.answers).filter((id) => !cats.some((c) => c.id === id))];
        const parts = ids
          .filter((id) => typeof (v.answers[id] || {}).had === "boolean")
          .map((id) => recordedName(v.answers[id], t, "home.log.slots") + ": " + (v.answers[id].had ? t("home.log.mealYes") : t("home.log.mealNo")));
        return parts.length ? parts.join(" · ") : null;
      }
      const byId = Object.fromEntries((prefs.mealItems || []).map((m) => [m.id, m.label]));
      if (v.entries) {
        const parts = MEAL_SLOTS.filter((s) => (v.entries[s] || []).length).map(
          (s) => t("home.log.slots." + s) + ": " + v.entries[s].map((id) => (v.labels && v.labels[id]) || byId[id] || t("home.log.itemGone")).join(", ")
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
  if (entry.id === "diet") {
    const answerIds = v.answers && typeof v.answers === "object"
      ? Object.keys(v.answers).filter((id) => typeof (v.answers[id] || {}).had === "boolean")
      : [];
    const byId = Object.fromEntries((prefs.mealItems || []).map((m) => [m.id, m]));
    const slots = v.entries ? MEAL_SLOTS.filter((s) => (v.entries[s] || []).length) : [];
    if (!answerIds.length && !slots.length) return null;
    const line = { fontSize: ts(A11Y.minBodyPx), margin: "4px 0 0", lineHeight: 1.55, display: "flex", alignItems: "center", gap: 8 };
    return (
      <div style={{ padding: "0 16px 14px" }}>
        {answerIds.map((id) => (
          <p key={"a-" + id} style={line}>
            <Icon name={mealIcon(id)} size={18} style={{ color: C.green }} />
            <span><strong>{recordedName(v.answers[id], t, "home.log.slots")}</strong>: {answerLine(v.answers[id], t)}</span>
          </p>
        ))}
        {/* Days logged before the meal flow: foods by the names they kept. */}
        {slots.map((s) => (
          <p key={"s-" + s} style={line}>
            <Icon name={SLOT_ICON[s]} size={18} style={{ color: C.green }} />
            <span><strong>{t("home.log.slots." + s)}</strong>: {v.entries[s].map((id) => (v.labels && v.labels[id]) || (byId[id] && byId[id].label) || t("home.log.itemGone")).join(", ")}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

/* ─── The card ─── */

/* ── THE LOG HAS ITS OWN SURFACE ──────────────────────────────────

   Owner: the card blends into the feed — same white as every post, so
   his eye skips it. It is not another post; it is the one thing on the
   page that is his and is today's, so it stops sharing their surface.

   His colour, and it holds up: on #E3EEF7 the near-black heading is
   14.19:1, the teal 5.44:1 and the muted intro line 4.81:1 — all clear
   of the 4.5 the body text needs. Nothing on the card changes colour.

   ONE MEASURED SURPRISE, because it runs the other way to intuition.
   Against the sage ground (#EFF3EE) this blue separates LESS by
   lightness than the white it replaces — 1.050 against 1.121 — so what
   makes it read as a different kind of thing is HUE, not brightness,
   helped by an edge that is now doing real work: #A9C7E0 is 1.57
   against the ground where the old warm grey hairline was far quieter.

   A deeper sky (#D9E7F5) would match white's lightness separation
   exactly while staying blue, but it lands the intro line on 4.51 —
   AA by a hundredth, with no headroom for a text-size change. Recorded
   for the owner to choose by eye; not taken unilaterally, because
   "passes by 0.01" is a thing that stops passing later.

   The card is drawn in ONE place — IconHome renders it and nothing
   else does; IconHub imports only its helpers — so this is Home-only
   by construction rather than by a flag. Both states share this
   section, so finishing the day cannot make it jump colour. ── */
const LOG_SURFACE = "#E3EEF7";
const LOG_EDGE = "#A9C7E0";

export default function DailyLogCard({ iconId, log, onChange, editable, restDay, dayLabel, isToday, date, flushLogs }) {
  const { t, ts, meta } = useI18n();
  const prefs = useIconPrefs(iconId);
  const navigate = useNavigate();
  /* Streaks are about today, so the controls appear on today's log only. */
  const showStreaks = !!isToday && !!editable && !!iconId;
  const { rows: streakRows } = useMyStreaks(showStreaks ? iconId : null);
  const [streakSheet, setStreakSheet] = useState({ mode: null, entry: null });
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

     THIS MOMENT IS ABOUT THE DAY BEING WRITTEN DOWN, and nothing is
     counted or awarded for it. */
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

  const pressStreak = (entry) => {
    const s = streakFor(streakRows, entry.key);
    if (!s) return setStreakSheet({ mode: "create", entry });
    /* A missed day is asked about before anything is sent — never settled
       for the person, never skipped past. */
    if (s.missed_day) return navigate(`/app/streaks/${s.id}/missed`);
    return setStreakSheet({ mode: "send", entry });
  };
  const closeStreakSheet = () => setStreakSheet((s) => ({ mode: null, entry: s.entry }));
  const logNow = (key) => {
    closeStreakSheet();
    setOpenIds((ids) => (ids.includes(key) ? ids : [...ids, key]));
    window.setTimeout(() => {
      const el = document.querySelector(`[data-entry="${key}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  };

  return (
    <section
      aria-label={isToday ? t("home.log.titleToday") : t("home.log.titleFor", { day: dayLabel })}
      style={{ background: LOG_SURFACE, borderRadius: 22, border: `1.5px solid ${LOG_EDGE}`, boxShadow: "0 4px 20px rgba(87, 52, 37, 0.07)", padding: "22px 20px", marginBottom: 20 }}
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
            <div key={mod.key} data-entry={mod.key} style={{ border: `2px solid ${open ? C.greenMuted : done ? C.sage : C.warmGray}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", background: done ? "#f4f7f1" : C.white }}>
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
                style={{ flex: 1, minWidth: 0, minHeight: 60, display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", paddingInlineEnd: showStreaks ? 4 : 16, background: "transparent", border: "none", fontFamily: "inherit", textAlign: "start", cursor: editable ? "pointer" : "default" }}
              >
                <Icon name={mod.icon} size={24} style={{ color: C.green }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>{entryName(mod)}</span>
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: done ? C.green : C.textMuted, overflowWrap: "anywhere" }}>
                    {done ? "✓ " + (summary || t("home.log.sumDone")) : progressFor(mod, log, t) || (editable ? t("home.log.tapToAdd") : "—")}
                  </span>
                </span>
                {editable && (
                  <span aria-hidden="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, fontWeight: 700 }}>{open ? "▲" : "▼"}</span>
                )}
              </button>
              {showStreaks && streakRows !== null && (
                <StreakControl streak={streakFor(streakRows, mod.key)} name={entryName(mod)} onPress={() => pressStreak(mod)} />
              )}
              </div>
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

      {showStreaks && streakSheet.entry && (
        <>
          <CreateStreakSheet
            open={streakSheet.mode === "create"}
            onClose={closeStreakSheet}
            entry={streakSheet.entry}
            itemName={entryName(streakSheet.entry)}
          />
          {streakFor(streakRows, streakSheet.entry.key) && (
            <SendStreakSheet
              open={streakSheet.mode === "send"}
              onClose={closeStreakSheet}
              streak={streakFor(streakRows, streakSheet.entry.key)}
              itemName={entryName(streakSheet.entry)}
              localValue={itemValueFromLog(streakSheet.entry.key, log)}
              flushLogs={flushLogs}
              onLogNow={() => logNow(streakSheet.entry.key)}
              tracker={streakSheet.entry.tracker}
            />
          )}
        </>
      )}
    </section>
  );
}

function EntryEditor({ entry, prefs, iconId, dateIso, value, onChange, noLinks }) {
  if (entry.kind === "tracker") return <TrackerEditor tracker={entry.tracker} value={value} onChange={onChange} />;
  switch (entry.id) {
    case "mood": return <MoodEditor value={value} onChange={onChange} iconId={iconId} dateIso={dateIso} />;
    case "sleep": return <SleepEditor value={value} onChange={onChange} />;
    case "medication": return <MedicationEditor value={value} onChange={onChange} meds={prefs.medications} noLinks={noLinks} />;
    case "exercise": return <MovementEditor value={value} onChange={onChange} options={prefs.movementOptions} iconId={iconId} dateIso={dateIso} />;
    case "diet": return <MealEditor value={value} onChange={onChange} categories={prefs.mealCategories} iconId={iconId} />;
    case "water": return <WaterEditor value={value} onChange={onChange} unit={prefs.units?.water || "glasses"} />;
    default: return null;
  }
}
