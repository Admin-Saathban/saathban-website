/* ════════════════════════════════════════════════
   /app/auth/signup/icon — Saath-Icon signup (SPEC.md, Signup flow).

   Minimal by design: every extra field is a drop-off. Name, email,
   phone; city is optional and deliberately last (location is never
   the first thing shown). Personality and interest modules come
   after the account exists, never as a wall here.

   Magic link is the frictionless path — no password to remember.
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
import useFinishMode from "./useFinishMode.js";

export default function SignupIcon() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { finish, sessionEmail } = useFinishMode();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError(t("auth.common.errorName"));
    if (!finish && !isValidEmail(email)) return setError(t("auth.common.errorEmail"));

    setBusy(true);
    try {
      if (finish) {
        const r = await finishProfile("saath_icon", {
          full_name: fullName,
          phone,
          city,
        });
        navigate(r === "ok" ? "/app" : "/app/auth", { replace: true });
      } else {
        const { error: err } = await sendMagicLink(email, {
          pending_role: "saath_icon",
          full_name: fullName.trim(),
          phone,
          city,
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
          <Field
            id="icon-email"
            label={t("auth.common.emailLabel")}
            hint={t("auth.icon.emailHint")}
          >
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

        <Field id="icon-phone" label={t("auth.common.phoneLabel")}>
          <input
            id="icon-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
        </Field>

        <Field
          id="icon-city"
          label={t("auth.common.cityLabel")}
          optionalTag={t("auth.common.optional")}
          hint={t("auth.common.cityHint")}
        >
          <input
            id="icon-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
            aria-describedby="icon-city-hint"
          />
        </Field>

        <Button busy={busy}>{finish ? t("auth.common.finishCta") : t("auth.icon.cta")}</Button>
      </form>

      <NotMeExit />
    </AuthScreen>
  );
}
