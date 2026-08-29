/* ════════════════════════════════════════════════
   /app/settings — demo settings page for the i18n foundation.

   Proves the three SPEC.md Language & accessibility requirements
   end to end:
     1. language toggle (English / اردو) via useI18n
     2. RTL flip — dir comes from the LanguageProvider wrapper, this
        file contains no left/right logic at all
     3. in-app text size control — every fontSize goes through ts()

   The real Settings screen (log modules, reminders, circle — SPEC.md
   §Settings) grows out of this file; the language and text size
   sections here are its permanent residents.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { LOCALES } from "../locales/index.js";
import { TEXT_SIZES, useI18n } from "../lib/i18n.jsx";
import { useSession } from "../lib/session.jsx";
import AppHeader from "../components/AppHeader.jsx";
import {
  OPTIONAL_MODULES,
  TRACKER_TYPES,
  useIconPrefs,
  toggleModule,
  addMedication,
  removeMedication,
  addDietItem,
  removeDietItem,
  addTracker,
  removeTracker,
} from "../lib/iconPrefs.js";

/* A choice button: 48px floor, and the active state is border weight +
   a check mark, never colour alone (SPEC.md accessibility). */
function ChoiceBtn({ active, onClick, children, lang, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      lang={lang}
      style={{
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        padding: "8px 20px",
        borderRadius: 14,
        border: active ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: active ? C.white : "transparent",
        color: C.textMain,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{ color: C.green, fontWeight: 700, visibility: active ? "visible" : "hidden" }}
      >
        ✓
      </span>
      {children}
    </button>
  );
}

/* Text input sized to the accessibility floors, following ts(). */
function TextInput({ value, onChange, placeholder, label, ts, style }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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

/* A removable row in one of the user-defined lists. */
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
    <h3 style={{ fontSize: ts(19), fontWeight: 700, color: C.brown, margin: "26px 0 6px" }}>
      {children}
    </h3>
  );
}

function Section({ title, hint, ts, children }) {
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
      <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.green, marginBottom: 6 }}>
        {title}
      </h2>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, marginBottom: 18 }}>{hint}</p>
      {children}
    </section>
  );
}

export default function AppSettings() {
  const { t, ts, lang, setLang, textSize, setTextSize, meta } = useI18n();
  const { profile } = useSession();

  return (
    <>
    <AppHeader />
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        padding: "24px 16px 64px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Back affordance comes from AppHeader now (its own back link
            was removed to avoid two identical links). */}
        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(34),
            fontWeight: 700,
            color: C.green,
            margin: "12px 0 28px",
          }}
        >
          {t("settings.title")}
        </h1>

        {/* ── My Circle (Icons only) — the circle's permanent home is
            Settings; it enters main navigation only once it has a
            member (SPEC.md §My Circle). Strings are local English for
            now — i18n lane: lift under settings.circle.*. */}
        {profile?.role === "saath_icon" && (
          <Section
            title="My Circle"
            hint="Choose who's kept in the loop, and exactly what each person may see."
            ts={ts}
          >
            <Link
              to="/app/circle"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: A11Y.minTapTargetPx,
                padding: "0 24px",
                borderRadius: 50,
                border: `2px solid ${C.green}`,
                color: C.green,
                background: C.white,
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              🏡 Open My Circle
            </Link>
          </Section>
        )}

        {/* ── Language ── */}
        <Section title={t("settings.language.title")} hint={t("settings.language.hint")} ts={ts}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.values(LOCALES).map(({ meta: m }) => (
              <ChoiceBtn
                key={m.code}
                active={lang === m.code}
                onClick={() => setLang(m.code)}
                lang={m.code}
                style={{
                  fontFamily: m.fonts.body,
                  fontSize: ts(A11Y.minBodyPx),
                  lineHeight: m.lineHeight,
                }}
              >
                {m.label}
              </ChoiceBtn>
            ))}
          </div>
        </Section>

        {/* ── Text size ── */}
        <Section title={t("settings.textSize.title")} hint={t("settings.textSize.hint")} ts={ts}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
            {TEXT_SIZES.map((s) => (
              <ChoiceBtn
                key={s.id}
                active={textSize === s.id}
                onClick={() => setTextSize(s.id)}
                style={{ fontSize: ts(A11Y.minBodyPx), flexDirection: "column", gap: 2 }}
              >
                {/* fixed px on purpose: each button previews its own step,
                    so it must not follow the currently applied scale */}
                <span aria-hidden="true" style={{ fontSize: A11Y.minBodyPx * s.scale, fontWeight: 700 }}>
                  Aa
                </span>
                <span>{t(s.labelKey)}</span>
              </ChoiceBtn>
            ))}
          </div>
        </Section>

        {/* ── Daily log: modules, medicines, meals, custom trackers ── */}
        <DailyLogSection t={t} ts={ts} lang={lang} />

        {/* ── Preview ── */}
        <Section title={t("settings.preview.title")} hint={t("settings.preview.hint")} ts={ts}>
          <div
            style={{
              background: C.cream,
              borderRadius: 16,
              padding: 20,
              borderInlineStart: `4px solid ${C.sage}`,
            }}
          >
            <h3
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(24),
                fontWeight: 700,
                color: C.brown,
                marginBottom: 8,
              }}
            >
              {t("settings.preview.heading")}
            </h3>
            <p style={{ fontSize: ts(A11Y.minBodyPx), marginBottom: 16 }}>
              {t("settings.preview.body")}
            </p>
            <button
              type="button"
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 28px",
                borderRadius: 50,
                border: "none",
                background: C.green,
                color: C.cream,
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {t("settings.preview.button")}
            </button>
          </div>

          {/* Fixed Urdu sample, independent of the toggle and of translation
              progress — proves Noto Nastaliq Urdu renders even while the
              ur.js strings are still [UR] placeholders. */}
          <p style={{ fontSize: ts(15), color: C.textMuted, margin: "20px 0 4px" }}>
            {t("settings.preview.scriptSampleLabel")}
          </p>
          <p
            dir="rtl"
            lang="ur"
            style={{
              fontFamily: LOCALES.ur.meta.fonts.body,
              lineHeight: LOCALES.ur.meta.lineHeight,
              fontSize: ts(20),
              color: C.textMain,
            }}
          >
            خوش آمدید — ساتھ بن میں آپ کا استقبال ہے
          </p>
        </Section>
      </div>
    </main>
    </>
  );
}

/* ════════ Daily log section ════════
   SPEC.md: log modules are opt-in per module; everything except mood
   defaults OFF. The medicine list, the meals list, and custom trackers
   are the Icon's own — defined here, shown on the home log card.
   All state lives in lib/iconPrefs.js (mock layer, localStorage). */

function DailyLogSection({ t, ts, lang }) {
  const prefs = useIconPrefs();

  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medTime, setMedTime] = useState("");
  const [dietLabel, setDietLabel] = useState("");
  const [trName, setTrName] = useState("");
  const [trType, setTrType] = useState("yesno");
  const [trDaily, setTrDaily] = useState(true);
  const [trDays, setTrDays] = useState([]);

  // Weekday names come from Intl in the active language — no keys needed,
  // and Urdu day names arrive for free. Sunday-first, matching getDay().
  const dayNames = Array.from({ length: 7 }, (_, d) =>
    new Intl.DateTimeFormat(lang, { weekday: "short" }).format(new Date(2023, 0, 1 + d))
  );

  const medOn = prefs.enabledModules.includes("medication");
  const dietOn = prefs.enabledModules.includes("diet");

  const submitTracker = () => {
    addTracker({
      name: trName,
      type: trType,
      schedule: trDaily ? { kind: "daily" } : { kind: "days", days: trDays },
    });
    setTrName("");
    setTrType("yesno");
    setTrDaily(true);
    setTrDays([]);
  };

  const scheduleSummary = (tr) =>
    tr.schedule.kind === "daily"
      ? t("settings.dailyLog.trackers.everyDay")
      : tr.schedule.days.map((d) => dayNames[d]).join(" · ");

  return (
    <Section title={t("settings.dailyLog.title")} hint={t("settings.dailyLog.hint")} ts={ts}>
      {/* Module toggles — mood shown as always-on, never a choice. */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ChoiceBtn active onClick={() => {}} style={{ fontSize: ts(A11Y.minBodyPx), opacity: 0.85, cursor: "default" }}>
          {t("settings.dailyLog.modules.mood")}
        </ChoiceBtn>
        {OPTIONAL_MODULES.map((id) => (
          <ChoiceBtn
            key={id}
            active={prefs.enabledModules.includes(id)}
            onClick={() => toggleModule(id)}
            style={{ fontSize: ts(A11Y.minBodyPx) }}
          >
            {t(`settings.dailyLog.modules.${id}`)}
          </ChoiceBtn>
        ))}
      </div>
      <p style={{ fontSize: ts(16), color: C.textMuted, margin: "10px 0 0", lineHeight: 1.6 }}>
        {t("settings.dailyLog.moodAlways")}
      </p>

      {/* ── Medicines (only when the module is on) ── */}
      {medOn && (
        <>
          <SubHeading ts={ts}>{t("settings.dailyLog.meds.title")}</SubHeading>
          <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 12px", lineHeight: 1.6 }}>
            {t("settings.dailyLog.meds.hint")}
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {prefs.medications.map((m) => (
              <ListRow key={m.id} onRemove={() => removeMedication(m.id)} removeLabel={t("common.remove")} ts={ts}>
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
                  addMedication({ name: medName, dose: medDose, time: medTime });
                  setMedName("");
                  setMedDose("");
                  setMedTime("");
                }}
              >
                {t("settings.dailyLog.meds.addCta")}
              </AddBtn>
            </div>
          </div>
        </>
      )}

      {/* ── Meals (only when the module is on) ── */}
      {dietOn && (
        <>
          <SubHeading ts={ts}>{t("settings.dailyLog.diet.title")}</SubHeading>
          <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 12px", lineHeight: 1.6 }}>
            {t("settings.dailyLog.diet.hint")}
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {prefs.dietItems.map((d) => (
              <ListRow key={d.id} onRemove={() => removeDietItem(d.id)} removeLabel={t("common.remove")} ts={ts}>
                {d.label}
              </ListRow>
            ))}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <TextInput
                value={dietLabel}
                onChange={setDietLabel}
                placeholder={t("settings.dailyLog.diet.addPlaceholder")}
                ts={ts}
                style={{ flex: 1, minWidth: 200, width: "auto" }}
              />
              <AddBtn
                ts={ts}
                disabled={!dietLabel.trim()}
                onClick={() => {
                  addDietItem(dietLabel);
                  setDietLabel("");
                }}
              >
                {t("settings.dailyLog.diet.addCta")}
              </AddBtn>
            </div>
          </div>
        </>
      )}

      {/* ── Custom trackers ── */}
      <SubHeading ts={ts}>{t("settings.dailyLog.trackers.title")}</SubHeading>
      <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 12px", lineHeight: 1.6 }}>
        {t("settings.dailyLog.trackers.hint")}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {prefs.trackers.map((tr) => (
          <ListRow key={tr.id} onRemove={() => removeTracker(tr.id)} removeLabel={t("common.remove")} ts={ts}>
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
                onClick={() =>
                  setTrDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
                }
                style={{ fontSize: ts(16), padding: "6px 12px" }}
              >
                {name}
              </ChoiceBtn>
            ))}
          </div>
        )}

        <div>
          <AddBtn
            ts={ts}
            disabled={!trName.trim() || (!trDaily && trDays.length === 0)}
            onClick={submitTracker}
          >
            {t("settings.dailyLog.trackers.addCta")}
          </AddBtn>
        </div>
      </div>
    </Section>
  );
}
