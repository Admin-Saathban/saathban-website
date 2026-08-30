/* ════════════════════════════════════════════════
   Daily-log setup panel — ONE component for two doors:
     · the Icon's own Settings page (isOwn)
     · a Fam member's "Help set up {name}'s daily log" page, when the
       Icon granted can_configure_daily_log (migration 0033)

   Both write the same daily_log_prefs row through lib/iconPrefs.js;
   the database stamps who did it and tells the Icon. The Icon always
   has the last word — their own edit clears the "set up by" mark.

   Sections: modules (mood always on), medicines, the meal library
   (label + tag chips — protein/carbs/veg/fruit/dairy/sweet — never
   nutrition math), display units (water glasses/L/ml, weight kg/lbs),
   custom trackers. Every control ≥48px, every size through ts().
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import {
  OPTIONAL_MODULES,
  TRACKER_TYPES,
  MEAL_TAGS,
  useIconPrefs,
  useIconPrefsStatus,
  toggleModule,
  addMedication,
  removeMedication,
  addMealItem,
  removeMealItem,
  setUnit,
  addTracker,
  removeTracker,
} from "../../lib/iconPrefs.js";
import { WATER_UNITS, WEIGHT_UNITS } from "../../lib/units.js";
import { pushToast } from "../../lib/feedback.jsx";

export const TAG_EMOJI = {
  protein: "🥚",
  carbs: "🍞",
  veg: "🥬",
  fruit: "🍎",
  dairy: "🥛",
  sweet: "🍬",
};

/* ─── Primitives (48px floors; active state = border + ✓, never colour alone) ─── */

function ChoiceBtn({ active, onClick, children, style, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      style={{
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        padding: "8px 18px",
        borderRadius: 14,
        border: active ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: active ? C.white : "transparent",
        color: C.textMain,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ color: C.green, fontWeight: 700, visibility: active ? "visible" : "hidden" }}>
        ✓
      </span>
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder, label, ts, style, onEnter }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      placeholder={placeholder}
      aria-label={label || placeholder}
      style={{
        minHeight: A11Y.minTapTargetPx,
        boxSizing: "border-box",
        padding: "0 14px",
        borderRadius: 12,
        border: `1.5px solid ${C.warmGray}`,
        background: C.white,
        color: C.textMain,
        fontFamily: "inherit",
        fontSize: ts(A11Y.minBodyPx),
        width: "100%",
        ...style,
      }}
    />
  );
}

function ListRow({ children, onRemove, removeLabel, ts }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 12,
        border: `1.5px solid ${C.warmGray}`,
        background: C.white,
      }}
    >
      <span style={{ flex: 1, fontSize: ts(A11Y.minBodyPx), lineHeight: 1.5 }}>{children}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          minHeight: A11Y.minTapTargetPx,
          minWidth: A11Y.minTapTargetPx,
          padding: "0 14px",
          borderRadius: 10,
          border: `1.5px solid ${C.warmGray}`,
          background: "transparent",
          color: C.brown,
          fontFamily: "inherit",
          fontSize: ts(16),
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {removeLabel}
      </button>
    </div>
  );
}

function AddBtn({ onClick, disabled, children, ts }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: A11Y.minTapTargetPx,
        padding: "0 24px",
        borderRadius: 50,
        border: "none",
        background: C.green,
        color: C.cream,
        fontFamily: "inherit",
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SubHeading({ children, ts }) {
  return (
    <h3 style={{ fontSize: ts(19), fontWeight: 700, color: C.brown, margin: "26px 0 6px" }}>{children}</h3>
  );
}

function Hint({ children, ts }) {
  return (
    <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 12px", lineHeight: 1.6 }}>{children}</p>
  );
}

/* Tag chips — one row, multi-select, reused by the log card's inline add. */
export function TagChips({ value, onChange, ts, compact }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {MEAL_TAGS.map((tg) => {
        const on = value.includes(tg);
        return (
          <ChoiceBtn
            key={tg}
            active={on}
            onClick={() => onChange(on ? value.filter((x) => x !== tg) : [...value, tg])}
            style={{ fontSize: ts(compact ? 16 : A11Y.minBodyPx), padding: compact ? "4px 12px" : "8px 18px" }}
          >
            <span aria-hidden="true">{TAG_EMOJI[tg]}</span> {t(`settings.dailyLog.diet.tags.${tg}`)}
          </ChoiceBtn>
        );
      })}
    </div>
  );
}

/* "Set up by {name}" — resolved to a first name through safe_profiles. */
function SetupByLine({ configuredBy, ts }) {
  const { t } = useI18n();
  const [name, setName] = useState(null);
  useEffect(() => {
    let alive = true;
    setName(null);
    if (!configuredBy) return undefined;
    supabase
      .from("safe_profiles")
      .select("full_name")
      .eq("id", configuredBy)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setName((data?.full_name || "").split(" ")[0] || t("fam.setup.someone"));
      });
    return () => {
      alive = false;
    };
  }, [configuredBy, t]);
  if (!configuredBy || !name) return null;
  return (
    <p
      style={{
        fontSize: ts(17),
        color: C.brown,
        background: C.cream,
        border: `1.5px solid ${C.warmGray}`,
        borderRadius: 12,
        padding: "10px 14px",
        margin: "0 0 16px",
        lineHeight: 1.5,
      }}
    >
      🛠️ {t("settings.dailyLog.setupBy", { name })}
    </p>
  );
}

export default function LogSetupPanel({ iconId, isOwn = true, personName }) {
  const { t, ts, lang } = useI18n();
  const prefs = useIconPrefs(iconId, { isOwn });
  const status = useIconPrefsStatus(iconId);

  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medTime, setMedTime] = useState("");
  const [mealLabel, setMealLabel] = useState("");
  const [mealTags, setMealTags] = useState([]);
  const [trName, setTrName] = useState("");
  const [trType, setTrType] = useState("yesno");
  const [trDaily, setTrDaily] = useState(true);
  const [trDays, setTrDays] = useState([]);

  const dayNames = Array.from({ length: 7 }, (_, d) =>
    new Intl.DateTimeFormat(lang, { weekday: "short" }).format(new Date(2023, 0, 1 + d))
  );

  const medOn = prefs.enabledModules.includes("medication");
  const dietOn = prefs.enabledModules.includes("diet");
  const waterOn = prefs.enabledModules.includes("water");

  /* Prefs write straight through to the server row; the line
     confirms it landed (and, on a helper's screen, that the Icon was
     told). */
  /* §11: a settings panel's result is the settings, which are on
     the screen and have just moved. The exception is saving on
     SOMEONE ELSE'S behalf — a Fam member setting up their Icon's
     modules — where the result lands on a screen the person cannot
     see, so that one still says what happened and for whom. */
  const saved = () => {
    if (!isOwn) pushToast(t("feedback.logSetupSaved"), { key: "prefs" });
  };

  const submitMeal = () => {
    if (!mealLabel.trim()) return;
    addMealItem(iconId, { label: mealLabel, tags: mealTags });
    setMealLabel("");
    setMealTags([]);
    saved();
  };

  const submitTracker = () => {
    addTracker(iconId, {
      name: trName,
      type: trType,
      schedule: trDaily ? { kind: "daily" } : { kind: "days", days: trDays },
    });
    setTrName("");
    setTrType("yesno");
    setTrDaily(true);
    setTrDays([]);
    saved();
  };

  const scheduleSummary = (tr) =>
    tr.schedule.kind === "daily"
      ? t("settings.dailyLog.trackers.everyDay")
      : tr.schedule.days.map((d) => dayNames[d]).join(" · ");

  const title = isOwn
    ? t("settings.dailyLog.title")
    : t("settings.dailyLog.helpingTitle", { name: personName || "" });
  const hint = isOwn ? t("settings.dailyLog.hint") : t("settings.dailyLog.helpingHint", { name: personName || "" });

  return (
    <section
      style={{
        background: C.white,
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        border: `1px solid ${C.warmGray}`,
      }}
    >
      <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.green, marginBottom: 6 }}>{title}</h2>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, marginBottom: 18 }}>{hint}</p>

      {status === "local" && (
        <p role="status" style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 12px" }}>
          {t("settings.dailyLog.offlineNote")}
        </p>
      )}
      {isOwn && <SetupByLine configuredBy={prefs.configuredBy} ts={ts} />}

      {/* Module toggles — mood shown as always-on, never a choice. */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ChoiceBtn active onClick={() => {}} style={{ fontSize: ts(A11Y.minBodyPx), opacity: 0.85, cursor: "default" }}>
          {t("settings.dailyLog.modules.mood")}
        </ChoiceBtn>
        {OPTIONAL_MODULES.map((id) => (
          <ChoiceBtn
            key={id}
            active={prefs.enabledModules.includes(id)}
            onClick={() => {
              toggleModule(iconId, id);
              saved();
            }}
            style={{ fontSize: ts(A11Y.minBodyPx) }}
          >
            {t(`settings.dailyLog.modules.${id}`)}
          </ChoiceBtn>
        ))}
      </div>
      <p style={{ fontSize: ts(16), color: C.textMuted, margin: "10px 0 0", lineHeight: 1.6 }}>
        {t("settings.dailyLog.moodAlways")}
      </p>

      {/* ── Medicines ── */}
      {medOn && (
        <>
          <SubHeading ts={ts}>{t("settings.dailyLog.meds.title")}</SubHeading>
          <Hint ts={ts}>{t("settings.dailyLog.meds.hint")}</Hint>
          <div style={{ display: "grid", gap: 10 }}>
            {prefs.medications.map((m) => (
              <ListRow key={m.id} onRemove={() => removeMedication(iconId, m.id)} removeLabel={t("common.remove")} ts={ts}>
                <strong>{m.name}</strong>
                {(m.dose || m.time) && (
                  <span style={{ color: C.textMuted }}>
                    {" — "}
                    {[m.dose, m.time].filter(Boolean).join(" · ")}
                  </span>
                )}
              </ListRow>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <TextInput value={medName} onChange={setMedName} placeholder={t("settings.dailyLog.meds.namePlaceholder")} ts={ts} />
              <TextInput value={medDose} onChange={setMedDose} placeholder={t("settings.dailyLog.meds.dosePlaceholder")} ts={ts} />
              <TextInput value={medTime} onChange={setMedTime} placeholder={t("settings.dailyLog.meds.timePlaceholder")} ts={ts} />
            </div>
            <div>
              <AddBtn
                ts={ts}
                disabled={!medName.trim()}
                onClick={() => {
                  addMedication(iconId, { name: medName, dose: medDose, time: medTime });
                  setMedName("");
                  setMedDose("");
                  setMedTime("");
                  saved();
                }}
              >
                {t("settings.dailyLog.meds.addCta")}
              </AddBtn>
            </div>
          </div>
        </>
      )}

      {/* ── Meal library (label + tags) ── */}
      {dietOn && (
        <>
          <SubHeading ts={ts}>{t("settings.dailyLog.diet.title")}</SubHeading>
          <Hint ts={ts}>{t("settings.dailyLog.diet.hint")}</Hint>
          <div style={{ display: "grid", gap: 10 }}>
            {prefs.mealItems.map((d) => (
              <ListRow key={d.id} onRemove={() => removeMealItem(iconId, d.id)} removeLabel={t("common.remove")} ts={ts}>
                <strong>{d.label}</strong>
                {d.tags?.length > 0 && (
                  <span style={{ color: C.textMuted }}>
                    {" — "}
                    {d.tags.map((tg) => `${TAG_EMOJI[tg]} ${t(`settings.dailyLog.diet.tags.${tg}`)}`).join(" · ")}
                  </span>
                )}
              </ListRow>
            ))}
            <TextInput
              value={mealLabel}
              onChange={setMealLabel}
              onEnter={submitMeal}
              placeholder={t("settings.dailyLog.diet.addPlaceholder")}
              ts={ts}
            />
            <Hint ts={ts}>{t("settings.dailyLog.diet.tagsHint")}</Hint>
            <TagChips value={mealTags} onChange={setMealTags} ts={ts} />
            <div>
              <AddBtn ts={ts} disabled={!mealLabel.trim()} onClick={submitMeal}>
                {t("settings.dailyLog.diet.addCta")}
              </AddBtn>
            </div>
          </div>
        </>
      )}

      {/* ── Units ── */}
      <SubHeading ts={ts}>{t("settings.dailyLog.units.title")}</SubHeading>
      <Hint ts={ts}>{t("settings.dailyLog.units.hint")}</Hint>
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, margin: "0 0 8px" }}>
            💧 {t("settings.dailyLog.units.water")}
            {!waterOn && (
              <span style={{ color: C.textMuted, fontWeight: 400 }}> · {t("settings.dailyLog.units.moduleOff")}</span>
            )}
          </p>
          <div role="group" aria-label={t("settings.dailyLog.units.water")} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {WATER_UNITS.map((u) => (
              <ChoiceBtn key={u} active={prefs.units.water === u} onClick={() => { setUnit(iconId, "water", u); saved(); }} style={{ fontSize: ts(A11Y.minBodyPx) }}>
                {t(`settings.dailyLog.units.${u}`)}
              </ChoiceBtn>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, margin: "0 0 8px" }}>
            ⚖️ {t("settings.dailyLog.units.weight")}
          </p>
          <div role="group" aria-label={t("settings.dailyLog.units.weight")} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {WEIGHT_UNITS.map((u) => (
              <ChoiceBtn key={u} active={prefs.units.weight === u} onClick={() => { setUnit(iconId, "weight", u); saved(); }} style={{ fontSize: ts(A11Y.minBodyPx) }}>
                {t(`settings.dailyLog.units.${u}`)}
              </ChoiceBtn>
            ))}
          </div>
        </div>
      </div>

      {/* ── Custom trackers ── */}
      <SubHeading ts={ts}>{t("settings.dailyLog.trackers.title")}</SubHeading>
      <Hint ts={ts}>{t("settings.dailyLog.trackers.hint")}</Hint>
      <div style={{ display: "grid", gap: 10 }}>
        {prefs.trackers.map((tr) => (
          <ListRow key={tr.id} onRemove={() => removeTracker(iconId, tr.id)} removeLabel={t("common.remove")} ts={ts}>
            <strong>{tr.name}</strong>
            <span style={{ color: C.textMuted }}>
              {" — "}
              {t(`settings.dailyLog.trackers.types.${tr.type}`)} · {scheduleSummary(tr)}
            </span>
          </ListRow>
        ))}
        <TextInput value={trName} onChange={setTrName} placeholder={t("settings.dailyLog.trackers.namePlaceholder")} ts={ts} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {TRACKER_TYPES.map((ty) => (
            <ChoiceBtn key={ty} active={trType === ty} onClick={() => setTrType(ty)} style={{ fontSize: ts(A11Y.minBodyPx) }}>
              {t(`settings.dailyLog.trackers.types.${ty}`)}
            </ChoiceBtn>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <ChoiceBtn active={trDaily} onClick={() => setTrDaily(true)} style={{ fontSize: ts(A11Y.minBodyPx) }}>
            {t("settings.dailyLog.trackers.everyDay")}
          </ChoiceBtn>
          <ChoiceBtn active={!trDaily} onClick={() => setTrDaily(false)} style={{ fontSize: ts(A11Y.minBodyPx) }}>
            {t("settings.dailyLog.trackers.someDays")}
          </ChoiceBtn>
        </div>
        {!trDaily && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dayNames.map((name, d) => (
              <ChoiceBtn
                key={d}
                active={trDays.includes(d)}
                onClick={() => setTrDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}
                style={{ fontSize: ts(16), padding: "6px 12px" }}
              >
                {name}
              </ChoiceBtn>
            ))}
          </div>
        )}
        <div>
          <AddBtn ts={ts} disabled={!trName.trim() || (!trDaily && trDays.length === 0)} onClick={submitTracker}>
            {t("settings.dailyLog.trackers.addCta")}
          </AddBtn>
        </div>
      </div>
    </section>
  );
}
