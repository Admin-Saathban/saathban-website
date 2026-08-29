/* The seven steps of the Saath-Buddy application.

   Each step component receives:
     app     — the application object (snake_case keys = DB columns)
     setApp  — merge-patch updater
     refs    — the two references
     setRefs — updater
     errors  — { fieldKey: message } for this step
   Review additionally gets goTo(stepIndex) for its Edit links. */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import {
  LANGUAGES,
  REFERENCE_RELATIONSHIPS,
  WEEKLY_HOURS_OPTIONS,
  COMMITMENT_OPTIONS,
  CODE_OF_CONDUCT,
  MOTIVATION_MIN_CHARS,
  formatCnic,
} from "./vettingData.js";
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

export function StepIdentity({ app, setApp, errors }) {
  return (
    <>
      <StepIntro>
        You'll be trusted with people's company and their confidence, so we
        verify who everyone is. This stays between you and the review team.
      </StepIntro>

      <TextField
        id="legal_name"
        label="Full legal name"
        hint="Exactly as written on your CNIC."
        error={errors.legal_name}
        value={app.legal_name}
        onChange={(e) => setApp({ legal_name: e.target.value })}
        autoComplete="name"
      />

      <TextField
        id="cnic_number"
        label="CNIC number"
        hint="13 digits, for example 35202-1234567-1."
        error={errors.cnic_number}
        value={app.cnic_number}
        onChange={(e) => setApp({ cnic_number: formatCnic(e.target.value) })}
        inputMode="numeric"
        placeholder="00000-0000000-0"
      />

      <TextField
        id="dob"
        label="Date of birth"
        hint="You must be at least 18 to volunteer."
        error={errors.dob}
        type="date"
        value={app.dob}
        onChange={(e) => setApp({ dob: e.target.value })}
      />

      <TextField
        id="phone"
        label="Phone number"
        hint="We'll use this for your interview call."
        error={errors.phone}
        value={app.phone}
        onChange={(e) => setApp({ phone: e.target.value })}
        inputMode="tel"
        autoComplete="tel"
        placeholder="03xx-xxxxxxx"
      />

      <UploadBox
        id="cnic_photo"
        label="Photo of your CNIC (front)"
        hint="Clear and readable, all four corners visible."
        error={errors.cnic_photo_path}
        fileName={app.cnic_photo_name}
        onFile={(f) =>
          setApp({
            cnic_photo_path: `buddy-documents/pending/cnic-${f.name}`,
            cnic_photo_name: f.name,
          })
        }
      />

      <UploadBox
        id="selfie"
        label="A photo of you"
        hint="Taken now if possible, so we can match it to your CNIC."
        error={errors.selfie_path}
        fileName={app.selfie_name}
        capture="user"
        onFile={(f) =>
          setApp({
            selfie_path: `buddy-documents/pending/selfie-${f.name}`,
            selfie_name: f.name,
          })
        }
      />
    </>
  );
}

/* ─── 2. Profile — languages carry the weight ─── */

export function StepProfile({ app, setApp, errors }) {
  const [custom, setCustom] = useState("");
  const toggleLang = (lang) =>
    setApp({
      languages: app.languages.includes(lang)
        ? app.languages.filter((l) => l !== lang)
        : [...app.languages, lang],
    });
  const addCustom = () => {
    const v = custom.trim();
    if (v && !app.languages.includes(v)) setApp({ languages: [...app.languages, v] });
    setCustom("");
  };

  return (
    <>
      <StepIntro>
        Matching starts from two things: where you are, and — above everything
        else — the languages you're comfortable talking in.
      </StepIntro>

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
          Languages you speak comfortably
        </p>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
          The single most important thing on this whole form — a shared language
          is what makes a match work. Choose every one that applies.
        </p>
        <div
          role="group"
          aria-labelledby="languages-label"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {LANGUAGES.map((lang) => (
            <Chip
              key={lang}
              selected={app.languages.includes(lang)}
              onClick={() => toggleLang(lang)}
            >
              {lang}
            </Chip>
          ))}
          {app.languages
            .filter((l) => !LANGUAGES.includes(l))
            .map((lang) => (
              <Chip key={lang} selected onClick={() => toggleLang(lang)}>
                {lang}
              </Chip>
            ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            aria-label="Another language"
            placeholder="Another language…"
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
              fontFamily: FONTS.sans,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
        <FieldError id="languages-error">{errors.languages}</FieldError>
      </div>

      <TextField
        id="city"
        label="City"
        error={errors.city}
        value={app.city}
        onChange={(e) => setApp({ city: e.target.value })}
        autoComplete="address-level2"
      />

      <TextField
        id="reachable_areas"
        label="Areas you can easily reach"
        hint="Neighbourhoods or towns you could visit without difficulty. Optional."
        error={errors.reachable_areas}
        value={app.reachable_areas}
        onChange={(e) => setApp({ reachable_areas: e.target.value })}
        placeholder="e.g. Gulberg, Model Town, DHA"
      />

      <TextField
        id="occupation"
        label="Occupation or institution"
        hint="What you do, or where you study. Optional."
        error={errors.occupation}
        value={app.occupation}
        onChange={(e) => setApp({ occupation: e.target.value })}
      />
    </>
  );
}

/* ─── 3. Motivation — one open box, free-form ─── */

export function StepMotivation({ app, setApp, errors }) {
  const count = app.motivation.trim().length;
  return (
    <>
      <StepIntro>
        In your own words: why do you want to spend time with seniors? There
        are no right answers and no boxes to tick — this is the first thing our
        team reads, before anything else on your application.
      </StepIntro>
      <TextAreaField
        id="motivation"
        label="Your reason, in your own words"
        error={errors.motivation}
        rows={8}
        value={app.motivation}
        onChange={(e) => setApp({ motivation: e.target.value })}
        placeholder="Take your time. A few honest sentences say more than a polished page."
        counter={
          count < MOTIVATION_MIN_CHARS
            ? `${count} characters — a little more, please`
            : `${count} characters`
        }
      />
    </>
  );
}

/* ─── 4. Experience and availability ─── */

export function StepExperience({ app, setApp, errors }) {
  return (
    <>
      <StepIntro>
        Experience helps but isn't required — warmth and reliability matter
        more. Be realistic about time: a steady two hours every week beats an
        ambitious ten that fades.
      </StepIntro>

      <TextAreaField
        id="experience"
        label="Any experience with seniors or caregiving"
        hint="Family, work, volunteering — anything counts. Optional."
        error={errors.experience}
        rows={5}
        value={app.experience}
        onChange={(e) => setApp({ experience: e.target.value })}
      />

      <div style={{ marginBottom: 26 }}>
        <p id="weekly-hours-label" style={sectionLabel}>
          Hours you can give in a typical week
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
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <p id="commitment-label" style={sectionLabel}>
          How long you can see yourself doing this
        </p>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
          Companionship takes time to grow — we ask so nobody is left waiting
          for a visit that stops coming.
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
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── 5. Two references, actually called ─── */

export function StepReferences({ refs, setRefs, errors }) {
  const update = (i, patch) =>
    setRefs(refs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <>
      <StepIntro>
        Two people who know you well — not family members. We will genuinely
        phone both of them, so please let them know to expect a call from
        Saathban.
      </StepIntro>

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
              fontFamily: FONTS.serif,
              fontSize: 21,
              fontWeight: 700,
              color: C.brown,
              padding: "0 8px",
            }}
          >
            {i === 0 ? "First reference" : "Second reference"}
          </legend>

          <TextField
            id={`ref${i}_name`}
            label="Their name"
            error={errors[`ref${i}_name`]}
            value={r.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />

          <Field
            id={`ref${i}_relationship`}
            label="How you know them"
            hint="Family members can't be references."
            error={errors[`ref${i}_relationship`]}
          >
            <select
              id={`ref${i}_relationship`}
              aria-invalid={!!errors[`ref${i}_relationship`]}
              value={r.relationship}
              onChange={(e) => update(i, { relationship: e.target.value })}
              style={{ ...inputStyle(!!errors[`ref${i}_relationship`]), appearance: "auto" }}
            >
              <option value="">Choose one…</option>
              {REFERENCE_RELATIONSHIPS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </Field>

          <TextField
            id={`ref${i}_phone`}
            label="Phone number they answer"
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
      <StepIntro>
        Last part before you check everything over. These are direct questions,
        answered honestly — honesty here matters more to us than a spotless
        answer.
      </StepIntro>

      <div style={{ marginBottom: 26 }}>
        <p id="criminal-label" style={sectionLabel}>
          Have you ever been convicted of a criminal offence?
        </p>
        <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
          A record does not automatically end your application — but an
          undisclosed one does.
        </p>
        <YesNo
          id="declared_criminal_record"
          value={app.declared_criminal_record}
          onChange={(v) => setApp({ declared_criminal_record: v })}
          error={errors.declared_criminal_record}
          yesLabel="Yes"
          noLabel="No"
        />
        {app.declared_criminal_record === true && (
          <TextAreaField
            id="criminal_record_details"
            label="Tell us about it, in your own words"
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
        I consent to Saathban requesting a police character certificate for me.
      </CheckRow>

      <div style={{ marginBottom: 4 }}>
        <p id="coc-label" style={sectionLabel}>
          The Saath-Buddy code of conduct
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
            <div key={rule.title} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 19, fontWeight: 700, color: C.green, margin: "0 0 4px" }}>
                {i + 1}. {rule.title}
              </p>
              <p style={{ fontSize: 18, lineHeight: 1.6, color: C.textMain, margin: 0 }}>
                {rule.text}
              </p>
            </div>
          ))}
          <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 14px" }}>
            — end of the code of conduct —
          </p>
        </div>
        {!readToEnd && (
          <p style={{ fontSize: 18, color: C.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>
            Please read to the end — the box below unlocks when you get there.
          </p>
        )}
        <CheckRow
          id="accepted_code_of_conduct"
          checked={app.accepted_code_of_conduct}
          onChange={(v) => setApp({ accepted_code_of_conduct: v })}
          disabled={!readToEnd}
          error={errors.accepted_code_of_conduct}
        >
          I have read the code of conduct and I agree to every part of it.
        </CheckRow>
      </div>
    </>
  );
}

/* ─── 7. Review ─── */

function ReviewBlock({ title, stepIndex, goTo, rows }) {
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
            fontFamily: FONTS.serif,
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
          aria-label={`Edit ${title}`}
          style={{
            minHeight: A11Y.minTapTargetPx,
            padding: "0 16px",
            borderRadius: 50,
            border: `2px solid ${C.green}`,
            background: C.white,
            color: C.green,
            fontSize: 18,
            fontWeight: 700,
            fontFamily: FONTS.sans,
            cursor: "pointer",
          }}
        >
          Edit
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

export function StepReview({ app, refs, goTo }) {
  const hours = WEEKLY_HOURS_OPTIONS.find((o) => o.value === app.weekly_hours);
  const months = COMMITMENT_OPTIONS.find((o) => o.value === app.commitment_months);
  return (
    <>
      <StepIntro>
        One look over everything before it goes to the review team. Anything
        can still be changed.
      </StepIntro>

      <ReviewBlock
        title="Who you are"
        stepIndex={0}
        goTo={goTo}
        rows={[
          ["Name", app.legal_name],
          ["CNIC", app.cnic_number],
          ["Date of birth", app.dob],
          ["Phone", app.phone],
          ["CNIC photo", app.cnic_photo_name],
          ["Your photo", app.selfie_name],
        ]}
      />
      <ReviewBlock
        title="Where and how you can help"
        stepIndex={1}
        goTo={goTo}
        rows={[
          ["Languages", app.languages.join(", ")],
          ["City", app.city],
          ["Reachable areas", app.reachable_areas],
          ["Occupation", app.occupation],
        ]}
      />
      <ReviewBlock
        title="Why you want to do this"
        stepIndex={2}
        goTo={goTo}
        rows={[["In your words", app.motivation]]}
      />
      <ReviewBlock
        title="Experience and time"
        stepIndex={3}
        goTo={goTo}
        rows={[
          ["Experience", app.experience || "None yet — that's fine"],
          ["Weekly hours", hours ? hours.label : ""],
          ["Commitment", months ? months.label : ""],
        ]}
      />
      <ReviewBlock
        title="References"
        stepIndex={4}
        goTo={goTo}
        rows={refs.map((r, i) => [
          i === 0 ? "First" : "Second",
          `${r.name} (${r.relationship}) — ${r.phone}`,
        ])}
      />
      <ReviewBlock
        title="Declarations"
        stepIndex={5}
        goTo={goTo}
        rows={[
          [
            "Criminal record",
            app.declared_criminal_record === true ? "Disclosed" : "None declared",
          ],
          ["Character certificate", app.consented_character_certificate ? "Consented" : ""],
          ["Code of conduct", app.accepted_code_of_conduct ? "Accepted" : ""],
        ]}
      />
    </>
  );
}
