/* ════════════════════════════════════════════════
   AppHeader — NAVIGATION_SPEC §3.

   Left to right: profile avatar · SAATHBAN · search · bell · messages.

   THE AVATAR IS TOP-LEFT AND OPENS FROM THE LEFT. That is not a
   detail: MOTION_SPEC §1 says a thing arrives from where you touched
   it, and the profile is the stated test case for the rule working in
   both directions. Search sits on the right and opens from the right.
   Bell and messages grow from their own corner.

   NO HAMBURGER. It was deleted on 29 August and stays deleted —
   NAVIGATION_SPEC §0 lists that as unchanged and correct. Navigation
   is the bottom bar and the More drawer, nowhere else.

   Back is one step of history, also unchanged from 29 August, and
   appears only where there is something to go back to.
   ════════════════════════════════════════════════ */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { roleHomePath, useSession } from "../lib/session.jsx";
import NotificationsBell from "../routes/notifications/NotificationsBell.jsx";
import Logo from "./Logo.jsx";
import HeaderAvatar from "./HeaderAvatar.jsx";
import MessagesButton from "./MessagesButton.jsx";
import SearchButton from "./SearchButton.jsx";
import NotificationsDrawer, { NOTIFICATIONS_DRAWER_ID } from "./NotificationsDrawer.jsx";
import { useDrawer } from "./Drawer.jsx";
import useShutter from "./useShutter.js";

export default function AppHeader() {
  const { t, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const { pathname, key: locationKey } = useLocation();
  /* §7's drawer is mounted HERE rather than in the app shell,
     because the bell is here and the shell is absent on several
     screens that still draw a header. A bell that opens nothing on
     the admin shell would be a new dead control. */
  const { open: notifOpen, closeDrawer: closeNotif } = useDrawer(NOTIFICATIONS_DRAWER_ID);
  /* Both bars move together, so the frame behaves as one thing (§5). */
  const shuttered = useShutter() && !notifOpen;

  const home = profile ? roleHomePath(profile.role) : "/app";
  /* A way back on every inner page, except the admin shell, which has
     its own sidebar. */
  const showBack =
    Boolean(profile) &&
    pathname !== home &&
    !(profile.role === "admin" && pathname.startsWith("/app/admin"));

  const backArrow = meta.dir === "rtl" ? "→" : "←";
  /* "default" is the first entry in this tab's history: nothing to go
     back to, so Home is the only honest destination. */
  const hasHistory = locationKey !== "default";
  const goBack = () => (hasHistory ? navigate(-1) : navigate(home));

  return (
    <>
    <header
      className="sb-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: C.bg,
        /* §4.1 — an outline means you can tap it. The header is not a
           control, so it separates by whitespace rather than a border
           that reads like one. */
        padding: "6px 10px",
        transform: shuttered ? "translateY(-100%)" : "none",
        transition: "transform 180ms ease-out",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {/* Top-left: the person. Opens from the left (MOTION §1). */}
        <HeaderAvatar />

        {showBack && (
          <button
            type="button"
            onClick={goBack}
            aria-label={hasHistory ? t("common.back") : t("common.backToHome")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: A11Y.minTapTargetPx,
              minWidth: 36,
              border: "none",
              background: "none",
              color: C.textMain,
              fontSize: 20,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true">{backArrow}</span>
          </button>
        )}

        <Link
          to={home}
          aria-label="Saathban"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: A11Y.minTapTargetPx,
            flex: 1,
            minWidth: 0,
          }}
        >
          <Logo height={30} />
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <SearchButton />
          <NotificationsBell />
          <MessagesButton />
        </nav>
      </div>
    </header>
      {/* OUTSIDE THE HEADER ELEMENT, DELIBERATELY. The header is
         sticky with a z-index, which makes it a stacking context —
         a position:fixed child of it is ordered WITHIN that context,
         so the drawer at z 71 would have painted underneath the
         bottom bar at z 60 and the dim would not have covered it. */}
      <NotificationsDrawer open={notifOpen} onClose={closeNotif} />
    </>
  );
}
