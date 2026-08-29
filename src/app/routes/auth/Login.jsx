/* ════════════════════════════════════════════════
   /app/auth/login — one card, one choice.

   The default and frictionless path is the email sign-in link (Icons and
   Fam never need a password). A quiet "I have a password" toggle reveals
   the password field and turns the button into Sign in — for Buddies and
   admins, and anyone who set one. The link request always lands on the
   check-email screen with the same message whether or not the address has
   an account — sign-in must never confirm which emails exist. Reset stays
   reachable from the password state.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { AuthScreen, Title, Field, Button, ErrorText, LinkButton } from "../../components/ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { sendMagicLink, isValidEmail } from "../../lib/authFlow.js";
import { rememberPostLoginPath } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";

export default function Login() {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const { state } = useLocation();

  // RequireAuth passes the page that bounced the person here; stash it so
  // the Complete screen can send them back after sign-in. The stash
  // survives the magic-link email round-trip; router state doesn't.
  useEffect(() => {
    if (state?.from) rememberPostLoginPath(state.from);
  }, [state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("magic"); // 'magic' | 'password'
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "magic") {
      if (!isValidEmail(email)) return setError(t("auth.common.errorEmail"));
      setBusy(true);
      // Whatever happens server-side, the answer is the same "check your
      // email" screen — never a hint about whether the account exists.
      try {
        await sendMagicLink(email, {}, { createUser: false });
      } catch {
        /* deliberate: same outcome */
      }
      setBusy(false);
      navigate("/app/auth/check-email", { state: { email: email.trim(), kind: "magic" } });
      return;
    }

    // Password mode.
    if (!isValidEmail(email) || !password) return setError(t("auth.login.badCredentials"));
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) setError(t("auth.login.badCredentials"));
      else navigate("/app/auth/complete", { replace: true });
    } catch {
      setError(t("auth.common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <Title>{t("auth.login.title")}</Title>

      <section
        style={{
          background: C.white,
          border: `2px solid ${C.warmGray}`,
          borderRadius: 18,
          padding: "24px 22px",
          marginTop: 20,
          marginBottom: 20,
        }}
      >
        <form onSubmit={submit} noValidate>
          <ErrorText>{error}</ErrorText>

          <Field id="login-email" label={t("auth.common.emailLabel")}>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </Field>

          {mode === "password" && (
            <Field id="login-password" label={t("auth.common.passwordLabel")}>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </Field>
          )}

          <Button busy={busy}>
            {mode === "magic" ? t("auth.login.continueCta") : t("auth.login.passwordCta")}
          </Button>
        </form>

        {/* The single quiet toggle. */}
        <div style={{ textAlign: "center", marginTop: 14 }}>
          {mode === "magic" ? (
            <LinkButton onClick={() => { setMode("password"); setError(""); }}>
              {t("auth.login.havePassword")}
            </LinkButton>
          ) : (
            <>
              <LinkButton onClick={() => { setMode("magic"); setPassword(""); setError(""); }}>
                {t("auth.login.useLinkInstead")}
              </LinkButton>
              <div style={{ marginTop: 6 }}>
                <LinkButton onClick={() => navigate("/app/auth/reset")}>
                  {t("auth.login.forgot")}
                </LinkButton>
              </div>
            </>
          )}
        </div>
      </section>

      <p style={{ textAlign: "center", fontSize: ts(A11Y.minBodyPx), marginTop: 12 }}>
        {t("auth.login.newHere")}{" "}
        <Link to="/app/auth" style={{ color: C.brown, fontWeight: 600 }}>
          {t("auth.login.getStarted")}
        </Link>
      </p>
    </AuthScreen>
  );
}
