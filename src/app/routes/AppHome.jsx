/* /app — the front door. Two doors only: sign in, or join.

   Anyone already signed in with a profile is taken straight to their
   role's home — this is what makes the installed PWA (start_url /app)
   open into the app rather than a landing page. There is no admin
   presence here or anywhere in public auth: admins use the normal
   login form and land at /app/admin by role. */

import { Link, Navigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { roleHomePath, useSession, AccountLoadError } from "../lib/session.jsx";

/* All strings live in locales/ (appHome.* plus two reused auth keys). */

export default function AppHome() {
  const { t, ts, meta } = useI18n();
  const { session, profile, profileStatus, loading } = useSession();

  // Signed in with a profile → straight home. A failed profile fetch
  // is NOT "no profile" — hold with the retry state. Only a definitive
  // absence goes to the finish-mode forms. Signed out → the doors.
  if (loading) {
    return <main style={{ minHeight: "100vh", background: C.bg }} aria-busy="true" />;
  }
  if (session && profile) return <Navigate to={roleHomePath(profile.role)} replace />;
  if (session && profileStatus === "error") return <AccountLoadError />;
  if (session) return <Navigate to="/app/auth?finish=1" replace />;

  const door = (primary) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    padding: "0 36px",
    borderRadius: 50,
    background: primary ? C.green : C.white,
    border: `2px solid ${C.green}`,
    color: primary ? C.cream : C.green,
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 600,
    textDecoration: "none",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <img
          src="/logo-extended.png"
          alt="Saathban"
          style={{ height: 56, width: "auto", marginBottom: 28 }}
        />

        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: "calc(clamp(1.8rem, 4vw, 2.6rem) * var(--sb-text-scale, 1))",
            fontWeight: 700,
            color: C.green,
            lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          {t("appHome.tagline")}
        </h1>

        <p
          style={{
            fontSize: ts(A11Y.minBodyPx),
            color: C.textMuted,
            marginBottom: 32,
          }}
        >
          {t("appHome.welcome")}
        </p>

        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          <Link to="/app/auth/login" style={door(true)}>
            {t("auth.roleSelect.signIn")}
          </Link>
          <Link to="/app/auth" style={door(false)}>
            {t("appHome.join")}
          </Link>
        </div>

        <a href="/" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
          {t("auth.roleSelect.backToSite")}
        </a>
      </div>
    </main>
  );
}
