/* ════════════════════════════════════════════════
   AppHeader — the small persistent bar for signed-in areas.

   Desktop: mark → role home, dir-aware "Back to home" on inner pages,
   then bell · My profile · Settings · Sign out.

   Phone (≤640px): collapses to essentials — mark, icon-only back
   arrow, bell, and a menu button opening a large-tap-target panel
   with My profile / Settings / Sign out. Nothing overlaps at any
   width; every control keeps the 48px floor. RTL flips free via
   flexbox + logical properties.
   ════════════════════════════════════════════════ */

import { useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const home = profile ? roleHomePath(profile.role) : "/app";
  // Every inner page gets a way back without hunting for the logo:
  // shown whenever this isn't the role's own home. Admin pages under
  // the admin shell keep their sidebar instead.
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
    whiteSpace: "nowrap",
  };

  const backArrow = meta.dir === "rtl" ? "→" : "←";

  const menuLinks = [
    { to: "/app/profile", label: t("hub.profile") },
    { to: "/app/settings", label: t("settings.title") },
  ];

  return (
    <header
      className="sb-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: C.bg,
        borderBottom: `1px solid ${C.warmGray}`,
        padding: "6px 12px",
      }}
    >
      <style>{`
        /* !important: these classes must beat the elements' inline
           display values from the shared control style. */
        .sb-header .sbh-desktop { display: inline-flex !important; }
        .sb-header .sbh-mobile { display: none !important; }
        .sb-header .sbh-back-label { display: inline; }
        @media (max-width: 640px) {
          .sb-header .sbh-desktop { display: none !important; }
          .sb-header .sbh-mobile { display: inline-flex !important; }
          .sb-header .sbh-menu { display: flex !important; }
          .sb-header .sbh-back-label { display: none; }
        }
      `}</style>

      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <Link
            to={home}
            onClick={() => setMenuOpen(false)}
            style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, flexShrink: 0 }}
          >
            <img
              src="/logo-extended.png"
              alt="Saathban"
              style={{ height: 30, width: "auto", display: "block" }}
            />
          </Link>
          {showBack && (
            <Link
              to={home}
              onClick={() => setMenuOpen(false)}
              aria-label={t("common.backToHome")}
              style={{ ...controlStyle, paddingInline: 8 }}
            >
              <span aria-hidden="true">{backArrow}</span>
              <span className="sbh-back-label" style={{ marginInlineStart: 6 }}>
                {t("common.backToHome")}
              </span>
            </Link>
          )}
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <NotificationsBell />
          {/* Desktop: the links inline. */}
          {menuLinks.map((l) => (
            <Link key={l.to} to={l.to} className="sbh-desktop" style={controlStyle}>
              {l.label}
            </Link>
          ))}
          <button type="button" onClick={signOut} className="sbh-desktop" style={controlStyle}>
            {t("auth.welcome.signOut")}
          </button>
          {/* Phone: one menu button. */}
          <button
            type="button"
            className="sbh-mobile"
            aria-expanded={menuOpen}
            aria-label={t("settings.title")}
            onClick={() => setMenuOpen((o) => !o)}
            style={{ ...controlStyle, fontSize: ts(24), minWidth: A11Y.minTapTargetPx, paddingInline: 8 }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </nav>
      </div>

      {/* Phone menu panel: full-width, large targets, closes on tap. */}
      {menuOpen && (
        <nav
          className="sbh-mobile sbh-menu"
          style={{
            flexDirection: "column",
            maxWidth: 960,
            margin: "6px auto 0",
            borderTop: `1px solid ${C.warmGray}`,
            paddingTop: 6,
            width: "100%",
          }}
        >
          {menuLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              style={{ ...controlStyle, justifyContent: "flex-start", minHeight: 52 }}
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
            style={{ ...controlStyle, justifyContent: "flex-start", minHeight: 52 }}
          >
            {t("auth.welcome.signOut")}
          </button>
        </nav>
      )}
    </header>
  );
}
