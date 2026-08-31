/* The seven steps of the Saath-Buddy application.

   Each step component receives:
     app     — the application object (snake_case keys = DB columns)
     setApp  — merge-patch updater
     refs    — the two references
     setRefs — updater
     errors  — { fieldKey: messageKey } for this step
   Review additionally gets goTo(stepIndex) for its Edit links.

   All copy resolves from locales/ under vetting.*; stored values
   (languages, relationships) stay English while their display is
   localized — see vettingData.js. */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  LANGUAGES,
  REFERENCE_RELATIONSHIPS,
  WEEKLY_HOURS_OPTIONS,
  COMMITMENT_OPTIONS,
  CODE_OF_CONDUCT,
  MOTIVATION_MIN_CHARS,
  formatCnic,
} from "./vettingData.js";
import { isAcceptedImage } from "./supabaseVetting.js";
import {
  TextField,
  TextAreaField,
  Field,
  FieldError,
  Chip,
  CheckRow,
  YesNo,
  UploadBox,
  StepIntro,
  inputStyle,
} from "./fields.jsx";

const sectionLabel = {
  fontSize: 19,
  fontWeight: 700,
  color: C.textMain,
  margin: "0 0 8px",
};

/* ─── 1. Identity ─── */

export function StepIdentity({ app, setApp, errors, files, setFiles }) {
  const { t } = useI18n();
  // Wrong-format picks (e.g. HEIC) are refused here, before upload —
  // the bucket only accepts jpeg/png/webp (migration 0008).
  const [typeErrors, setTypeErrors] = useState({});
  const pick = (kind) => (f) => {
    if (!isAcceptedImage(f)) {
      setTypeErrors((prev) => ({ ...prev, [kind]: "vetting.identity.badImageType" }));
      return;
    }
    setTypeErrors((prev) => ({ ...prev, [kind]: "" }));
    setFiles({ ...files, [kind]: f });
  };
  return (
    <>
      <StepIntro>{t("vetting.identity.intro")}</StepIntro>

      <TextField
        id="legal_name"
        label={t("vetting.identity.nameLabel")}
        hint={t("vetting.identity.nameHint")}
        error={errors.legal_name}
        value={app.legal_name}
        onChange={(e) => setApp({ legal_name: e.target.value })}
        autoComplete="name"
      />

      <TextField
        id="cnic_number"
        label={t("vetting.identity.cnicLabel")}
        hint={t("vetting.identity.cnicHint")}
        error={errors.cnic_number}
        value={app.cnic_number}
        onChange={(e) => setApp({ cnic_number: formatCnic(e.target.value) })}
        inputMode="numeric"
        placeholder="00000-0000000-0"
      />

      <TextField
        id="dob"
        label={t("vetting.identity.dobLabel")}
        hint={t("vetting.identity.dobHint")}
        error={errors.dob}
        type="date"
        value={app.dob}
        onChange={(e) => setApp({ dob: e.target.value })}
      />

      <TextField
        id="phone"
        label={t("vetting.identity.phoneLabel")}
        hint={t("vetting.identity.phoneHint")}
        error={errors.phone}
        value={app.phone}
        onChange={(e) => setApp({ phone: e.target.value })}
        inputMode="tel"
        autoComplete="tel"
        placeholder="03xx-xxxxxxx"
      />

      <UploadBox
        id="cnic_photo"
        label={t("vetting.identity.cnicPhotoLabel")}
        hint={t("vetting.identity.cnicPhotoHint")}
        error={typeErrors.cnic || errors.cnic_photo_path}
        fileName={files.cnic?.name}
        onFile={pick("cnic")}
      />

      <UploadBox
        id="selfie"
        label={t("vetting.identity.selfieLabel")}
        hint={t("vetting.identity.selfieHint")}
        error={typeErrors.selfie || errors.selfie_path}
        fileName={files.selfie?.name}
        capture="user"
        onFile={pick("selfie")}
      />
    </>
  );
}

/* ─── 2. Profile — languages carry the weight ─── */

export function StepProfile({ app, setApp, errors }) {
  const { t } = useI18n();
  const [custom, setCustom] = useState("");
  const toggleLang = (value) =>
    setApp({
      languages: app.languages.includes(value)
        ? app.languages.filter((l) => l !== value)
        : [...app.languages, value],
    });
  const addCustom = () => {
    const v = custom.trim();
    if (v && !app.languages.includes(v)) setApp({ languages: [...app.languages, v] });
    setCustom("");
  };

  return (
    <>
      <StepIntro>{t("vetting.profile.intro")}</StepIntro>

      {/* Languages first, deliberately: the most important matching field. */}
      <div
        style={{
          border: `2px solid ${errors.languages ? C.brown : C.sage}`,
          background: "#f4f7f1",
          borderRadius: 16,
          padding: "18px 16px",
          marginBottom: 26,
        }}
      >
        <p id="languages-label" style={{ ...sectionLabel, color: C.green }}>
          {t("vetting.profile.langLabel")}
        </p>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
          {t("vetting.profile.langHint")}
        </p>
        <div
          role="group"
          aria-labelledby="languages-label"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {LANGUAGES.map((lang) => (
            <Chip
              key={lang.value}
              selected={app.languages.includes(lang.value)}
              onClick={() => toggleLang(lang.value)}
            >
              {t(lang.key)}
            </Chip>
          ))}
          {app.languages
            .filter((l) => !LANGUAGES.some((x) => x.value === l))
            .map((lang) => (
              <Chip key={lang} selected onClick={() => toggleLang(lang)}>
                {lang}
              </Chip>
            ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            aria-label={t("vetting.profile.anotherLang")}
            placeholder={t("vetting.profile.anotherLang")}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            style={{ ...inputStyle(false), flex: 1, minHeight: A11Y.minTapTargetPx }}
          />
          <button
            type="button"
            onClick={addCustom}
            style={{
              minHeight: A11Y.minTapTargetPx,
              padding: "0 20px",
              borderRadius: 14,
              border: `2px solid ${C.green}`,
              background: C.white,
              color: C.green,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {t("vetting.profile.addCta")}
          </button>
        </div>
        <FieldError id="languages-error">{errors.languages}</FieldError>
      </div>

      <TextField
        id="city"
        label={t("vetting.profile.cityLabel")}
        error={errors.city}
        value={app.city}
        onChange={(e) => setApp({ city: e.target.value })}
        autoComplete="address-level2"
      />

      <TextField
        id="reachable_areas"
        label={t("vetting.profile.areasLabel")}
        hint={t("vetting.profile.areasHint")}
        error={errors.reachable_areas}
        value={app.reachable_areas}
        onChange={(e) => setApp({ reachable_areas: e.target.value })}
        placeholder={t("vetting.profile.areasPh")}
      />

      <TextField
        id="occupation"
        label={t("vetting.profile.occLabel")}
        hint={t("vetting.profile.occHint")}
        error={errors.occupation}
        value={app.occupation}
        onChange={(e) => setApp({ occupation: e.target.value })}
      />
    </>
  );
}

/* ─── 3. Motivation — one open box, free-form ─── */

export function StepMotivation({ app, setApp, errors }) {
  const { t } = useI18n();
  const count = app.motivation.trim().length;
  return (
    <>
      <StepIntro>{t("vetting.motivation.intro")}</StepIntro>
      <TextAreaField
        id="motivation"
        label={t("vetting.motivation.label")}
        error={errors.motivation}
        rows={8}
        value={app.motivation}
        onChange={(e) => setApp({ motivation: e.target.value })}
        placeholder={t("vetting.motivation.ph")}
        counter={
          count < MOTIVATION_MIN_CHARS
            ? t("vetting.motivation.countMore", { n: count })
            : t("vetting.motivation.count", { n: count })
        }
      />
    </>
  );
}

/* ─── 4. Experience and availability ─── */

export function StepExperience({ app, setApp, errors }) {
  const { t } = useI18n();
  return (
    <>
      <StepIntro>{t("vetting.experience.intro")}</StepIntro>

      <TextAreaField
        id="experience"
        label={t("vetting.experience.expLabel")}
        hint={t("vetting.experience.expHint")}
        error={errors.experience}
        rows={5}
        value={app.experience}
        onChange={(e) => setApp({ experience: e.target.value })}
      />

      <div style={{ marginBottom: 26 }}>
        <p id="weekly-hours-label" style={sectionLabel}>
          {t("vetting.experience.hoursLabel")}
        </p>
        <div
          role="group"
          aria-labelledby="weekly-hours-label"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {WEEKLY_HOURS_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={app.weekly_hours === o.value}
              onClick={() =>
                setApp({ weekly_hours: app.weekly_hours === o.value ? null : o.value })
              }
            >
              {t(o.labelKey)}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <p id="commitment-label" style={sectionLabel}>
          {t("vetting.experience.commitLabel")}
        </p>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
          {t("vetting.experience.commitHint")}
        </p>
        <div
          role="group"
          aria-labelledby="commitment-label"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {COMMITMENT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={app.commitment_months === o.value}
              onClick={() =>
                setApp({
                  commitment_months: app.commitment_months === o.value ? null : o.value,
                })
              }
            >
              {t(o.labelKey)}
            </Chip>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── 5. Two references, actually called ─── */

export function StepReferences({ refs, setRefs, errors }) {
  const { t, meta } = useI18n();
  const update = (i, patch) =>
    setRefs(refs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <>
      <StepIntro>{t("vetting.references.intro")}</StepIntro>

      {refs.map((r, i) => (
        <fieldset
          key={i}
          style={{
            border: `2px solid ${C.warmGray}`,
            borderRadius: 16,
            padding: "18px 16px 8px",
            margin: "0 0 22px",
            background: C.white,
          }}
        >
          <legend
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: 21,
              fontWeight: 700,
              color: C.brown,
              padding: "0 8px",
            }}
          >
            {i === 0 ? t("vetting.references.first") : t("vetting.references.second")}
          </legend>

          <TextField
            id={`ref${i}_name`}
            label={t("vetting.references.nameLabel")}
            error={errors[`ref${i}_name`]}
            value={r.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />

          <Field
            id={`ref${i}_relationship`}
            label={t("vetting.references.relLabel")}
            hint={t("vetting.references.relHint")}
            error={errors[`ref${i}_relationship`]}
          >
            <select
              id={`ref${i}_relationship`}
              aria-invalid={!!errors[`ref${i}_relationship`]}
              value={r.relationship}
              onChange={(e) => update(i, { relationship: e.target.value })}
              style={{ ...inputStyle(!!errors[`ref${i}_relationship`]), appearance: "auto" }}
            >
              <option value="">{t("vetting.references.chooseOne")}</option>
              {REFERENCE_RELATIONSHIPS.map((rel) => (
                <option key={rel.value} value={rel.value}>
                  {t(rel.key)}
                </option>
              ))}
            </select>
          </Field>

          <TextField
            id={`ref${i}_phone`}
            label={t("vetting.references.phoneLabel")}
            error={errors[`ref${i}_phone`]}
            value={r.phone}
            onChange={(e) => update(i, { phone: e.target.value })}
            inputMode="tel"
            placeholder="03xx-xxxxxxx"
          />
        </fieldset>
      ))}
    </>
  );
}

/* ─── 6. Declarations + scrollable code of conduct ─── */

export function StepDeclarations({ app, setApp, errors }) {
  const { t } = useI18n();
  // The accept checkbox unlocks only after the code of conduct has been
  // scrolled to the end (or already accepted in a saved draft).
  const [readToEnd, setReadToEnd] = useState(app.accepted_code_of_conduct);
  const scrollerRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setReadToEnd(true);
  }, []);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setReadToEnd(true);
  };

  return (
    <>
      <StepIntro>{t("vetting.declarations.intro")}</StepIntro>

      <div style={{ marginBottom: 26 }}>
        <p id="criminal-label" style={sectionLabel}>
          {t("vetting.declarations.criminalQ")}
        </p>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
          {t("vetting.declarations.criminalHint")}
        </p>
        <YesNo
          id="declared_criminal_record"
          value={app.declared_criminal_record}
          onChange={(v) => setApp({ declared_criminal_record: v })}
          error={errors.declared_criminal_record}
          yesLabel={t("vetting.declarations.yes")}
          noLabel={t("vetting.declarations.no")}
        />
        {app.declared_criminal_record === true && (
          <TextAreaField
            id="criminal_record_details"
            label={t("vetting.declarations.criminalDetails")}
            rows={4}
            value={app.criminal_record_details}
            onChange={(e) => setApp({ criminal_record_details: e.target.value })}
          />
        )}
      </div>

      <CheckRow
        id="consented_character_certificate"
        checked={app.consented_character_certificate}
        onChange={(v) => setApp({ consented_character_certificate: v })}
        error={errors.consented_character_certificate}
      >
        {t("vetting.declarations.certConsent")}
      </CheckRow>

      <div style={{ marginBottom: 4 }}>
        <p id="coc-label" style={sectionLabel}>
          {t("vetting.declarations.cocLabel")}
        </p>
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          tabIndex={0}
          role="region"
          aria-labelledby="coc-label"
          style={{
            maxHeight: 300,
            overflowY: "auto",
            border: `2px solid ${C.warmGray}`,
            borderRadius: 16,
            background: C.white,
            padding: "18px 18px 4px",
            marginBottom: 10,
          }}
        >
          {CODE_OF_CONDUCT.map((rule, i) => (
            <div key={rule.titleKey} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 19, fontWeight: 700, color: C.green, margin: "0 0 4px" }}>
                {i + 1}. {t(rule.titleKey)}
              </p>
              <p style={{ fontSize: 18, lineHeight: 1.6, color: C.textMain, margin: 0 }}>
                {t(rule.textKey)}
              </p>
            </div>
          ))}
          <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 14px" }}>
            {t("vetting.declarations.cocEnd")}
          </p>
        </div>
        {!readToEnd && (
          <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
            {t("vetting.declarations.readToEnd")}
          </p>
        )}
        <CheckRow
          id="accepted_code_of_conduct"
          checked={app.accepted_code_of_conduct}
          onChange={(v) => setApp({ accepted_code_of_conduct: v })}
          disabled={!readToEnd}
          error={errors.accepted_code_of_conduct}
        >
          {t("vetting.declarations.cocAccept")}
        </CheckRow>
      </div>
    </>
  );
}

/* ─── 7. Review ─── */

function ReviewBlock({ title, stepIndex, goTo, rows }) {
  const { t, meta } = useI18n();
  return (
    <div
      style={{
        border: `2px solid ${C.warmGray}`,
        borderRadius: 16,
        background: C.white,
        padding: "16px 16px 6px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h3
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: 21,
            fontWeight: 700,
            color: C.brown,
            margin: 0,
            flex: 1,
          }}
        >
          {title}
        </h3>
        <button
          type="button"
          onClick={() => goTo(stepIndex)}
          aria-label={t("vetting.review.editAria", { title })}
          style={{
            minHeight: A11Y.minTapTargetPx,
            padding: "0 16px",
            borderRadius: 50,
            border: `2px solid ${C.green}`,
            background: C.white,
            color: C.green,
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {t("vetting.review.edit")}
        </button>
      </div>
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <p key={k} style={{ fontSize: 18, lineHeight: 1.55, margin: "0 0 10px" }}>
            <span style={{ color: C.textMuted }}>{k}: </span>
            <span style={{ color: C.textMain, fontWeight: 600, overflowWrap: "anywhere" }}>{v}</span>
          </p>
        ))}
    </div>
  );
}

export function StepReview({ app, refs, goTo, files }) {
  const { t } = useI18n();
  const hours = WEEKLY_HOURS_OPTIONS.find((o) => o.value === app.weekly_hours);
  const months = COMMITMENT_OPTIONS.find((o) => o.value === app.commitment_months);
  const relDisplay = (value) => {
    const rel = REFERENCE_RELATIONSHIPS.find((x) => x.value === value);
    return rel ? t(rel.key) : value;
  };
  return (
    <>
      <StepIntro>{t("vetting.review.intro")}</StepIntro>

      <ReviewBlock
        title={t("vetting.steps.identity")}
        stepIndex={0}
        goTo={goTo}
        rows={[
          [t("vetting.review.rName"), app.legal_name],
          [t("vetting.review.rCnic"), app.cnic_number],
          [t("vetting.review.rDob"), app.dob],
          [t("vetting.review.rPhone"), app.phone],
          [t("vetting.review.rCnicPhoto"), files.cnic?.name],
          [t("vetting.review.rYourPhoto"), files.selfie?.name],
        ]}
      />
      <ReviewBlock
        title={t("vetting.steps.profile")}
        stepIndex={1}
        goTo={goTo}
        rows={[
          [t("vetting.review.rLanguages"), app.languages.join(", ")],
          [t("vetting.review.rCity"), app.city],
          [t("vetting.review.rAreas"), app.reachable_areas],
          [t("vetting.review.rOccupation"), app.occupation],
        ]}
      />
      <ReviewBlock
        title={t("vetting.steps.motivation")}
        stepIndex={2}
        goTo={goTo}
        rows={[[t("vetting.review.rInWords"), app.motivation]]}
      />
      <ReviewBlock
        title={t("vetting.steps.experience")}
        stepIndex={3}
        goTo={goTo}
        rows={[
          [t("vetting.review.rExperience"), app.experience || t("vetting.review.noneYet")],
          [t("vetting.review.rHours"), hours ? t(hours.labelKey) : ""],
          [t("vetting.review.rCommit"), months ? t(months.labelKey) : ""],
        ]}
      />
      <ReviewBlock
        title={t("vetting.steps.references")}
        stepIndex={4}
        goTo={goTo}
        rows={refs.map((r, i) => [
          i === 0 ? t("vetting.review.rFirst") : t("vetting.review.rSecond"),
          `${r.name} (${relDisplay(r.relationship)}) — ${r.phone}`,
        ])}
      />
      <ReviewBlock
        title={t("vetting.steps.declarations")}
        stepIndex={5}
        goTo={goTo}
        rows={[
          [
            t("vetting.review.rCriminal"),
            app.declared_criminal_record === true
              ? t("vetting.review.disclosed")
              : t("vetting.review.noneDeclared"),
          ],
          [
            t("vetting.review.rCert"),
            app.consented_character_certificate ? t("vetting.review.consented") : "",
          ],
          [
            t("vetting.review.rCoc"),
            app.accepted_code_of_conduct ? t("vetting.review.accepted") : "",
          ],
        ]}
      />
    </>
  );
}
