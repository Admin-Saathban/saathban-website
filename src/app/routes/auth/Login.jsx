/* ════════════════════════════════════════════════
   /app/auth/login — sign in, both methods on one screen.

   Email link for Saath-Icons and Saath-Fam (the frictionless path);
   password for Saath-Buddies. The link request always lands on the
   check-email screen with the same message whether or not the address
   has an account — sign-in must never confirm which emails exist.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import {
  AuthScreen,
  Title,
  Field,
  Button,
  ErrorText,
  LinkButton,
} from "../../components/ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { sendMagicLink, isValidEmail } from "../../lib/authFlow.js";
import { rememberPostLoginPath } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";

const sectionStyle = {
  background: C.white,
  border: `2px solid ${C.warmGray}`,
  borderRadius: 18,
  padding: "24px 22px",
  marginBottom: 20,
};

export default function Login() {
  const { t, meta, ts } = useI18n();
  const navigate = useNavigate();
  const { state } = useLocation();

  // RequireAuth passes the page that bounced the person here; stash it
  // so the Complete screen can send them back after sign-in — the
  // stash survives the magic-link email round-trip, router state
  // doesn't.
  useEffect(() => {
    if (state?.from) rememberPostLoginPath(state.from);
  }, [state]);

  const [magicEmail, setMagicEmail] = useState("");
  const [magicError, setMagicError] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);

  const [pwEmail, setPwEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const h2Style = {
    fontFamily: meta.fonts.heading,
    fontSize: ts(22),
    fontWeight: 700,
    color: C.green,
    margin: "0 0 4px",
  };
  const hintStyle = {
    fontSize: ts(A11Y.minBodyPx),
    color: C.textMuted,
    margin: "0 0 18px",
  };

  const submitMagic = async (e) => {
    e.preventDefault();
    setMagicError("");
    if (!isValidEmail(magicEmail)) return setMagicError(t("auth.common.errorEmail"));
    setMagicBusy(true);
    // Whatever happens server-side, the answer is the same "check your
    // email" screen — never a hint about whether the account exists.
    try {
      await sendMagicLink(magicEmail, {}, { createUser: false });
    } catch {
      /* deliberate: same outcome */
    }
    setMagicBusy(false);
    navigate("/app/auth/check-email", {
      state: { email: magicEmail.trim(), kind: "magic" },
    });
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (!isValidEmail(pwEmail) || !password) {
      return setPwError(t("auth.login.badCredentials"));
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: pwEmail.trim(),
        password,
      });
      if (error) {
        setPwError(t("auth.login.badCredentials"));
      } else {
        navigate("/app/auth/complete", { replace: true });
      }
    } catch {
      setPwError(t("auth.common.errorGeneric"));
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <AuthScreen>
      <Title>{t("auth.login.title")}</Title>

      <section style={{ ...sectionStyle, marginTop: 20 }}>
        <h2 style={h2Style}>{t("auth.login.magicTitle")}</h2>
        <p style={hintStyle}>{t("auth.login.magicHint")}</p>
        <form onSubmit={submitMagic} noValidate>
          <ErrorText>{magicError}</ErrorText>
          <Field id="login-magic-email" label={t("auth.common.emailLabel")}>
            <input
              id="login-magic-email"
              type="email"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </Field>
          <Button busy={magicBusy}>{t("auth.login.magicCta")}</Button>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>{t("auth.login.passwordTitle")}</h2>
        <p style={hintStyle}>
          {t("auth.login.passwordHint")}
        </p>
        <form onSubmit={submitPassword} noValidate>
          <ErrorText>{pwError}</ErrorText>
          <Field id="login-pw-email" label={t("auth.common.emailLabel")}>
            <input
              id="login-pw-email"
              type="email"
              value={pwEmail}
              onChange={(e) => setPwEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </Field>
          <Field id="login-pw-password" label={t("auth.common.passwordLabel")}>
            <input
              id="login-pw-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button busy={pwBusy}>{t("auth.login.passwordCta")}</Button>
        </form>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <LinkButton onClick={() => navigate("/app/auth/reset")}>
            {t("auth.login.forgot")}
          </LinkButton>
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
