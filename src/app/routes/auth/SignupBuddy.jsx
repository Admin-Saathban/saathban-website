/* ════════════════════════════════════════════════
   /app/auth/signup/buddy — Saath-Buddy account creation.

   Deliberately only the account here: the long vetting application
   (identity, references, declarations — SPEC.md, Saath-Buddy vetting)
   is its own flow once signed in, built alongside the admin review
   queue (build step 8). The intro copy sets that expectation.

   Email + password (SPEC.md, Auth). Supabase sends a confirmation
   email; the link lands on /app/auth/complete like the magic links.
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
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { useI18n } from "../../lib/i18n.jsx";
import { signUpWithPassword, finishProfile, isValidEmail } from "../../lib/authFlow.js";
import { consumePostLoginPath } from "../../lib/session.jsx";
import useFinishMode from "./useFinishMode.js";

export default function SignupBuddy() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { finish, sessionEmail } = useFinishMode();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError(t("auth.common.errorName"));
    if (!finish) {
      if (!isValidEmail(email)) return setError(t("auth.common.errorEmail"));
      if (password.length < 8) return setError(t("auth.common.errorPassword"));
    }

    setBusy(true);
    try {
      if (finish) {
        const r = await finishProfile("saath_buddy", { full_name: fullName });
        navigate(r.status === "ok" ? consumePostLoginPath(r.role) : "/app/auth", { replace: true });
      } else {
        const { data, error: err } = await signUpWithPassword(email, password, {
          pending_role: "saath_buddy",
          full_name: fullName.trim(),
        });
        if (err) throw err;
        if (data.session) {
          // Email confirmation disabled on the project — already signed in.
          navigate("/app/auth/complete", { replace: true });
        } else {
          navigate("/app/auth/check-email", {
            state: { email: email.trim(), kind: "confirm" },
          });
        }
      }
    } catch {
      setError(t("auth.common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <Title>{t("auth.buddy.title")}</Title>
      <Intro>{t("auth.buddy.intro", { buddy: ROLE_DISPLAY.saath_buddy })}</Intro>

      <form onSubmit={submit} noValidate>
        <ErrorText>{error}</ErrorText>

        <Field id="buddy-name" label={t("auth.common.fullNameLabel")}>
          <input
            id="buddy-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </Field>

        {finish ? (
          sessionEmail && <Intro>{t("auth.common.signedInAs", { email: sessionEmail })}</Intro>
        ) : (
          <>
            <Field id="buddy-email" label={t("auth.common.emailLabel")}>
              <input
                id="buddy-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </Field>

            <Field
              id="buddy-password"
              label={t("auth.common.passwordLabel")}
              hint={t("auth.common.passwordHint")}
            >
              <input
                id="buddy-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-describedby="buddy-password-hint"
              />
            </Field>
          </>
        )}

        <Button busy={busy}>{finish ? t("auth.common.finishCta") : t("auth.buddy.cta")}</Button>
      </form>

      <NotMeExit />
    </AuthScreen>
  );
}
