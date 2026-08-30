/* ════════════════════════════════════════════════
   /app/auth/login — the whole screen, visible at once.

   PRODUCT_DECISIONS §1. What was here before showed an email field, a
   "Continue — we'll email you a sign-in link" button, and an "I have a
   password" link that RESHAPED THE SCREEN: tapping it grew a password
   field, changed the button's words, and moved "forgotten your
   password?" into existence. Three different screens wearing one
   name, and which one you were looking at depended on something you
   may not remember tapping.

   Now: email, password, Sign in, and three plain links under them.
   Nothing hidden behind a toggle, nothing reshapes on tap, and the
   page a person sees the second time is the page they saw the first.

   THE MAGIC LINK IS NOT GONE — it is demoted. "Use an email link
   instead" sends it and goes to the same check-email screen it always
   did, and Icons and Fam who never set a password still sign in with
   one tap after typing their address. It is a link rather than the
   primary button because a password is what most people expect to see
   on a sign-in page, and a screen that offers something else first
   makes them wonder whether they are in the right place.

   Sign-in never confirms which addresses have accounts: the link
   request lands on check-email either way, and a wrong password and an
   unknown address give the same sentence.
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /* Sign in with the password — the button. */
  const submit = async (e) => {
    e.preventDefault();
    setError("");
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

  /* Sign in by email link — the plain link under the button. It acts
     rather than revealing anything: the address is already typed above
     it, so there is nothing more to ask for and nothing to reshape. */
  const emailLink = async () => {
    setError("");
    if (!isValidEmail(email)) return setError(t("auth.common.errorEmail"));
    setBusy(true);
    try {
      await sendMagicLink(email, {}, { createUser: false });
    } catch {
      /* deliberate: the answer is the same either way */
    }
    setBusy(false);
    navigate("/app/auth/check-email", { state: { email: email.trim(), kind: "magic" } });
  };

  const linkRow = { textAlign: "center", marginTop: 14 };

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

          {/* Always here. It is not a reward for finding a toggle. */}
          <Field id="login-password" label={t("auth.common.passwordLabel")}>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          <Button busy={busy}>{t("auth.login.passwordCta")}</Button>
        </form>

        {/* The three plain links, in the order §1 sets them out. Each
            one goes somewhere; none of them changes this screen. */}
        <div style={linkRow}>
          <LinkButton onClick={emailLink} disabled={busy}>
            {t("auth.login.useLinkInstead")}
          </LinkButton>
        </div>
        <div style={linkRow}>
          <LinkButton onClick={() => navigate("/app/auth/reset")}>
            {t("auth.login.forgot")}
          </LinkButton>
        </div>
      </section>

      <p style={{ textAlign: "center", fontSize: ts(A11Y.minBodyPx), marginTop: 12 }}>
        {t("auth.login.newHere")}{" "}
        {/* A 24px-tall link, which is what an inline <Link> in a
            sentence gives you, is half of §0.2's floor. The padding
            makes the target 48px without taking the words out of the
            sentence they belong in. */}
        <Link
          to="/app/auth"
          style={{
            color: C.brown,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            minHeight: A11Y.minTapTargetPx,
            paddingInline: 6,
          }}
        >
          {t("auth.login.getStarted")}
        </Link>
      </p>
    </AuthScreen>
  );
}
