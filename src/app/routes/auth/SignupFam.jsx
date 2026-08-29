/* ════════════════════════════════════════════════
   /app/auth/signup/fam — Saath-Fam signup (SPEC.md, Signup flow).

   Mostly adult children, often overseas — assume tech literacy and
   collect enough to match and cater well: country and city (timezone
   matters for call reminders), relationship, languages. Magic link,
   same as Icons. Joining an Icon's circle happens after signup via
   My Circle invites (build step 7).
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
import { useI18n } from "../../lib/i18n.jsx";
import { sendMagicLink, finishProfile, isValidEmail } from "../../lib/authFlow.js";
import { roleHomePath } from "../../lib/session.jsx";
import useFinishMode from "./useFinishMode.js";

export default function SignupFam() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { finish, sessionEmail } = useFinishMode();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [relationship, setRelationship] = useState("");
  const [languages, setLanguages] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError(t("auth.common.errorName"));
    if (!finish && !isValidEmail(email)) return setError(t("auth.common.errorEmail"));

    const fields = {
      full_name: fullName.trim(),
      phone,
      country,
      city,
      relationship,
      languages,
    };

    setBusy(true);
    try {
      if (finish) {
        const r = await finishProfile("family_member", fields);
        navigate(r.status === "ok" ? roleHomePath(r.role) : "/app/auth", { replace: true });
      } else {
        const { error: err } = await sendMagicLink(email, {
          pending_role: "family_member",
          ...fields,
        });
        if (err) throw err;
        navigate("/app/auth/check-email", { state: { email: email.trim(), kind: "magic" } });
      }
    } catch {
      setError(t("auth.common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <Title>{t("auth.fam.title")}</Title>
      <Intro>{t("auth.fam.intro")}</Intro>

      <form onSubmit={submit} noValidate>
        <ErrorText>{error}</ErrorText>

        <Field id="fam-name" label={t("auth.common.fullNameLabel")}>
          <input
            id="fam-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </Field>

        {finish ? (
          sessionEmail && <Intro>{t("auth.common.signedInAs", { email: sessionEmail })}</Intro>
        ) : (
          <Field id="fam-email" label={t("auth.common.emailLabel")}>
            <input
              id="fam-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </Field>
        )}

        <Field id="fam-phone" label={t("auth.common.phoneLabel")}>
          <input
            id="fam-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
        </Field>

        <Field id="fam-country" label={t("auth.common.countryLabel")}>
          <input
            id="fam-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            autoComplete="country-name"
          />
        </Field>

        <Field id="fam-city" label={t("auth.common.cityLabel")}>
          <input
            id="fam-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
          />
        </Field>

        <Field
          id="fam-relationship"
          label={t("auth.common.relationshipLabel")}
          hint={t("auth.common.relationshipHint")}
        >
          <input
            id="fam-relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            aria-describedby="fam-relationship-hint"
          />
        </Field>

        <Field
          id="fam-languages"
          label={t("auth.common.languagesLabel")}
          hint={t("auth.common.languagesHint")}
        >
          <input
            id="fam-languages"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            aria-describedby="fam-languages-hint"
          />
        </Field>

        <Button busy={busy}>{finish ? t("auth.common.finishCta") : t("auth.fam.cta")}</Button>
      </form>

      <NotMeExit />
    </AuthScreen>
  );
}
