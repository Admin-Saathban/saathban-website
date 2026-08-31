/* ════════════════════════════════════════════════
   /app/auth/reset — password reset, both halves on one route.

   No session: ask for the email and send the recovery link (which
   redirects back here). The confirmation copy is identical whether or
   not the address has an account. With a session (the recovery link
   was just consumed): choose the new password.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
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
import { isValidEmail } from "../../lib/authFlow.js";
import supabase from "../../lib/supabase.js";

export default function ResetPassword() {
  const { t, ts } = useI18n();
  const navigate = useNavigate();

  const [hasSession, setHasSession] = useState(null); // null = still checking
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setHasSession(Boolean(data.session));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive && session) setHasSession(true);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const requestLink = async (e) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) return setError(t("auth.common.errorEmail"));
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/app/auth/reset`,
      });
    } catch {
      /* deliberate: identical outcome, no account enumeration */
    }
    setBusy(false);
    setSent(true);
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("auth.common.errorPassword"));
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      navigate("/app/auth/complete", { replace: true });
    } catch {
      setError(t("auth.common.errorGeneric"));
      setBusy(false);
    }
  };

  if (hasSession === null) return <AuthScreen> </AuthScreen>;

  return (
    <AuthScreen>
      {hasSession ? (
        <>
          <Title>{t("auth.reset.setTitle")}</Title>
          <form onSubmit={savePassword} noValidate>
            <ErrorText>{error}</ErrorText>
            <Field
              id="reset-password"
              label={t("auth.common.passwordLabel")}
              hint={t("auth.common.passwordHint")}
            >
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-describedby="reset-password-hint"
              />
            </Field>
            <Button busy={busy}>{t("auth.reset.setCta")}</Button>
          </form>
        </>
      ) : (
        <>
          <Title>{t("auth.reset.requestTitle")}</Title>
          <Intro>{t("auth.reset.requestHint")}</Intro>
          <form onSubmit={requestLink} noValidate>
            <ErrorText>{error}</ErrorText>
            <Field id="reset-email" label={t("auth.common.emailLabel")}>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </Field>
            <Button busy={busy}>{t("auth.reset.requestCta")}</Button>
          </form>
          <p
            aria-live="polite"
            style={{
              textAlign: "center",
              fontSize: ts(A11Y.minBodyPx),
              color: C.greenMuted,
              fontWeight: 600,
              minHeight: 28,
              marginTop: 14,
            }}
          >
            {sent ? t("auth.reset.requestSent") : ""}
          </p>
        </>
      )}
      <NotMeExit />
    </AuthScreen>
  );
}
