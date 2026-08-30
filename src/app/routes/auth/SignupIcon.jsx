/* ════════════════════════════════════════════════
   /app/auth/signup/icon — Saath-Icon signup (PRODUCT_DECISIONS §2).

   EXACTLY FOUR THINGS: name, email, date of birth, city + area. Phone
   is gone — §2 names the four and §8 puts a phone number on the list a
   profile must never hold.

   THE BIRTHDAY IS ASKED WARMLY AND THE AGE CHECK IS SILENT. "When's
   your birthday? So we can celebrate with you." That is the whole
   reason given, and it is a true one: the app does celebrate. The 50+
   check happens underneath and is never mentioned, because §2 is
   explicit that nobody is told they are being verified. There is no
   "you must be 50 to continue" anywhere on this screen — that sentence
   turns a welcome into a border crossing.

   BELOW 50 IS NEVER A REJECTION. It is a redirect with both doors
   open, on the same screen, keeping everything they have already
   typed. Nobody is sent back to the start for being young, and the
   word "sorry" does not appear: they are not a failed Icon, they are a
   welcome Fam or Buddy. Icon status is the honoured one; younger
   people are welcome AROUND Icons, never as Icons.

   ONE PATH ONLY. No branch for "alone" vs "helped by family" vs "at an
   event" — §2 is explicit, and every branch is another way for the
   assisted-signup case to drift from the solo one.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AuthScreen,
  Title,
  Intro,
  Field,
  Button,
  ErrorText,
  NotMeExit,
} from "../../components/ui.jsx";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { sendMagicLink, finishProfile, isValidEmail } from "../../lib/authFlow.js";
import { consumePostLoginPath } from "../../lib/session.jsx";
import useFinishMode from "./useFinishMode.js";

export const ICON_MIN_AGE = 50;

/* Whole years, today. Derived every time it is needed and never
   stored: an age column freezes a number that changes every year, and
   its first symptom is somebody who has been 49 for three years. */
export function ageOn(dobString, on = new Date()) {
  if (!dobString) return null;
  const dob = new Date(`${dobString}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  let years = on.getFullYear() - dob.getFullYear();
  const monthDelta = on.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < dob.getDate())) years -= 1;
  return years;
}

/* A date that could not be a living person's birthday is a typo, not a
   young person — say so plainly rather than sending them to the Fam
   door for mistyping a year. */
function dobProblem(dobString, t) {
  if (!dobString) return t("auth.icon.errorDobMissing");
  const age = ageOn(dobString);
  if (age == null || age < 0 || age > 120) return t("auth.icon.errorDobUnreal");
  return null;
}

export default function SignupIcon() {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const { finish, sessionEmail } = useFinishMode();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /* Set only when a valid birthday turns out to be under 50. Not an
     error — a different set of doors, shown in place. */
  const [tooYoung, setTooYoung] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setTooYoung(false);

    if (!fullName.trim()) return setError(t("auth.common.errorName"));
    if (!finish && !isValidEmail(email)) return setError(t("auth.common.errorEmail"));
    const dobIssue = dobProblem(dob, t);
    if (dobIssue) return setError(dobIssue);
    if (!city.trim()) return setError(t("auth.icon.errorCity"));

    /* The quiet part. Nothing above mentioned an age; nothing below
       tells them they were checked. */
    if (ageOn(dob) < ICON_MIN_AGE) {
      setTooYoung(true);
      return;
    }

    setBusy(true);
    try {
      const details = {
        full_name: fullName.trim(),
        date_of_birth: dob,
        city: city.trim(),
        area: area.trim() || null,
      };
      if (finish) {
        const r = await finishProfile("saath_icon", details);
        navigate(r.status === "ok" ? consumePostLoginPath(r.role) : "/app/auth", { replace: true });
      } else {
        const { error: err } = await sendMagicLink(email, { pending_role: "saath_icon", ...details });
        if (err) throw err;
        navigate("/app/auth/check-email", { state: { email: email.trim(), kind: "magic" } });
      }
    } catch {
      setError(t("auth.common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  /* Carry what they typed to whichever door they choose. Retyping a
     name and a city is how a redirect becomes a rejection in practice
     even when the words are kind. */
  const carry = { state: { fullName, email, dob, city, area } };

  return (
    <AuthScreen>
      <Title>{t("auth.icon.title")}</Title>
      <Intro>{t("auth.icon.intro")}</Intro>

      <form onSubmit={submit} noValidate>
        <ErrorText>{error}</ErrorText>

        <Field id="icon-name" label={t("auth.common.fullNameLabel")}>
          <input
            id="icon-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </Field>

        {finish ? (
          sessionEmail && <Intro>{t("auth.common.signedInAs", { email: sessionEmail })}</Intro>
        ) : (
          <Field id="icon-email" label={t("auth.common.emailLabel")} hint={t("auth.icon.emailHint")}>
            <input
              id="icon-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              aria-describedby="icon-email-hint"
            />
          </Field>
        )}

        {/* The birthday. The label IS the reason, and the reason is
            true — nothing here hints at a check. */}
        <Field id="icon-dob" label={t("auth.icon.dobLabel")} hint={t("auth.icon.dobHint")}>
          <input
            id="icon-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            autoComplete="bday"
            max={new Date().toISOString().slice(0, 10)}
            aria-describedby="icon-dob-hint"
          />
        </Field>

        <Field id="icon-city" label={t("auth.common.cityLabel")} hint={t("auth.common.cityHint")}>
          <input
            id="icon-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
            aria-describedby="icon-city-hint"
          />
        </Field>

        {/* Area is prompted but optional — it is what makes a park or
            an event nearby actually nearby, so it is asked for with a
            reason rather than left off. */}
        <Field
          id="icon-area"
          label={t("auth.icon.areaLabel")}
          optionalTag={t("auth.common.optional")}
          hint={t("auth.icon.areaHint")}
        >
          <input
            id="icon-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            autoComplete="address-level3"
            aria-describedby="icon-area-hint"
          />
        </Field>

        {tooYoung ? (
          /* Not an error box, not a red border, not the word sorry.
             Two doors, both open, and everything they typed comes
             with them. */
          <section
            role="status"
            style={{
              border: `2px solid ${C.sage}`,
              background: C.white,
              borderRadius: 18,
              padding: "18px 16px",
              marginBottom: 18,
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: ts(20), fontWeight: 700, color: C.green }}>
              {t("auth.icon.welcomeTitle")}
            </p>
            <p style={{ margin: "0 0 14px", fontSize: ts(A11Y.minBodyPx), lineHeight: 1.55, color: C.textMain }}>
              {t("auth.icon.welcomeBody")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => navigate("/app/auth/signup/fam", carry)}
                style={doorStyle(ts, true)}
              >
                {t("auth.icon.doorFam")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/app/auth/signup/buddy", carry)}
                style={doorStyle(ts, false)}
              >
                {t("auth.icon.doorBuddy")}
              </button>
            </div>
          </section>
        ) : (
          <Button busy={busy}>{finish ? t("auth.common.finishCta") : t("auth.icon.cta")}</Button>
        )}
      </form>

      <NotMeExit />
    </AuthScreen>
  );
}

function doorStyle(ts, primary) {
  return {
    width: "100%",
    minHeight: 60,
    borderRadius: 50,
    border: primary ? "none" : `2px solid ${C.warmGray}`,
    background: primary ? C.green : C.white,
    color: primary ? C.cream : C.textMain,
    fontSize: ts(19),
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  };
}
