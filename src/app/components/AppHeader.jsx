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
import Logo from "./Logo.jsx";

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

/* Everywhere an Icon goes, now that the home screen is the day's own
     business rather than a grid of doors. These used to be ten cards
     below the log; the home screen empties as the day completes, and
     what fills the space is the community rather than navigation.

     ICON ONLY. Every other role keeps the navigation it has — a Buddy
     has no My Circle and no My Journey, and moving a Fam member's
     doors around is not what was asked for. The routes themselves are
     role-gated in AppRoot regardless; this is about not offering
     somebody a door that would bounce them.

     Community is deliberately absent: its feed is ON the home screen,
     with its own way through to the whole of it. A menu entry for the
     thing already filling the screen is a door to the room you are
     standing in.

     Milestones is absent too — it is My Journey's now (see AppRoot's
     redirect), and two entries for one place is how a person decides
     they have missed something. */
  const ICON_PLACES = [
    { to: "/app/games", emoji: "🎲", key: "hub.games" },
    { to: "/app/events", emoji: "🎪", key: "hub.events" },
    { to: "/app/groups", emoji: "🧑‍🤝‍🧑", key: "hub.groups" },
    { to: "/app/skills", emoji: "🌱", key: "hub.skills" },
    { to: "/app/history", emoji: "📖", key: "hub.history" },
    { to: "/app/outdoor", emoji: "🌳", key: "hub.outdoor" },
    { to: "/app/people", emoji: "🫶", key: "hub.people" },
    { to: "/app/circle", emoji: "🤝", key: "hub.circle" },
  ];

  /* The places go in the MENU only — never inline in the header bar,
     where eight more links would crush the mark and the bell at any
     width. The two chrome links keep the inline desktop behaviour
     they had. */
  const placeLinks =
    profile?.role === "saath_icon"
      ? ICON_PLACES.map((p) => ({ to: p.to, label: `${p.emoji} ${t(p.key)}` }))
      : [];

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
        /* An Icon's places live behind the menu button at EVERY width,
           so the button and its panel cannot be phone-only. */
        .sb-header .sbh-always { display: inline-flex !important; }
        .sb-header .sbh-panel { display: flex !important; }
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
            <Logo height={26} />
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

        {/* Just the bell. Navigation lives in the bottom bar and in
            More — one menu, not two (TONIGHT.md §3). */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <NotificationsBell />
        </nav>
      </div>

    </header>
  );
}
