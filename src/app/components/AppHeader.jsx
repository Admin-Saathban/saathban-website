/* ════════════════════════════════════════════════
   AppHeader — the small persistent bar for signed-in areas.

   Saathban mark → the signed-in role's own home (roleHomePath),
   Settings link, Sign out. Needs <AuthProvider> above it, which
   already wraps the whole /app route table.

   Integration is one import + one element at the top of a page —
   see HEADER_WIRING.md at the repo root. Flex + logical spacing only,
   so the RTL flip under Urdu is free; both controls keep the 48px
   tap-target floor and scale with the in-app text size.
   ════════════════════════════════════════════════ */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { roleHomePath, useSession } from "../lib/session.jsx";
import supabase from "../lib/supabase.js";
import NotificationsBell from "../routes/notifications/NotificationsBell.jsx";

export default function AppHeader() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const home = profile ? roleHomePath(profile.role) : "/app";
  // Every inner page gets a way back without hunting for the logo:
  // shown whenever this isn't the role's own home (/app/home/log,
  // /app/notifications, /app/milestones…). Admin pages under the
  // admin shell keep their sidebar instead.
  const showBack =
    Boolean(profile) &&
    pathname !== home &&
    !(profile.role === "admin" && pathname.startsWith("/app/admin"));

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* already signed out — fine */
    }
    navigate("/app/auth", { replace: true });
  };

  const controlStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: A11Y.minTapTargetPx,
    padding: "0 12px",
    border: "none",
    background: "none",
    color: C.brown,
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 600,
    fontFamily: "inherit",
    textDecoration: "none",
    cursor: "pointer",
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: C.bg,
        borderBottom: `1px solid ${C.warmGray}`,
        padding: "6px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Link
            to={home}
            style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx }}
          >
            <img
              src="/logo-extended.png"
              alt="Saathban"
              style={{ height: 34, width: "auto", display: "block" }}
            />
          </Link>
          {showBack && (
            <Link to={home} style={{ ...controlStyle, whiteSpace: "nowrap" }}>
              <span aria-hidden="true" style={{ marginInlineEnd: 6 }}>
                {meta.dir === "rtl" ? "→" : "←"}
              </span>
              {t("common.backToHome")}
            </Link>
          )}
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NotificationsBell />
          <Link to="/app/profile" style={controlStyle}>
            {t("hub.profile")}
          </Link>
          <Link to="/app/settings" style={controlStyle}>
            {t("settings.title")}
          </Link>
          <button type="button" onClick={signOut} style={controlStyle}>
            {t("auth.welcome.signOut")}
          </button>
        </nav>
      </div>
    </header>
  );
}
