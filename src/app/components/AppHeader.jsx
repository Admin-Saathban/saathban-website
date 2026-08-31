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
import { IconChip } from "./Icon.jsx";
import { MORE_DRAWER_ID } from "./MoreDrawer.jsx";
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
  const { open: moreOpen, openDrawer: openMore } = useDrawer(MORE_DRAWER_ID);
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
        /* NAV IS NOT CONTENT AND NOT THE GROUND. This was C.bg, the
           same tone as the floor the page sits on, so the header had
           nothing to separate it from the screen — and with the whole
           app on white, whitespace was separating one white from
           another. It now has its own tone plus a hairline.

           §4.1 still holds: an outline means you can tap it. A
           hairline along one edge is not an outline — it is where
           the chrome stops and the content starts. */
        background: C.nav,
        borderBottom: `1px solid ${C.navEdge}`,
        /* THE HEADER OWNS THE TOP INSET. Its jet fills the status-bar
           area so the chrome reaches the top of the glass, while its own
           row sits below the notch. Padding rather than a spacer above
           it, because padding is part of the element — so when the
           shutter translates the header by -100% the inset travels with
           it and nothing dark is left behind at the top. A spacer would
           have stayed. */
        padding: "calc(6px + var(--sb-safe-top, 0px)) 10px 6px",
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
              /* C.navInk, NOT C.textMain. Measured on the new chrome:
                 textMain is #1C1E21 against a #1B1E22 bar — 1.00:1. The
                 back arrow was painted EXACTLY the colour of the bar it
                 sits on, and on a full-screen route it is the only way
                 out.

                 I moved the nav surface and did not revalue the ink
                 standing on it. Lane 3 hit the identical bug in their
                 world and told me; measuring after their message is the
                 only reason I looked at mine. A call site that was right
                 when written and became wrong when a token moved
                 underneath it — the fourth of that exact shape this
                 week. */
              color: C.navInk,
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
          <Logo height={30} variant="light" />
        </Link>

        {/* RULED ORDER: avatar · logo · search · bell · more.

            MESSAGES IS NOT HERE ANY MORE. It was a header icon that
            opened a world, which is a lot of app hanging off a glyph
            in the corner — it is a bar tab now, where a destination
            belongs. What is left in this corner is the two things
            that act ON the screen you are already looking at (find
            something, see what happened) plus the menu. */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <SearchButton />
          <NotificationsBell />
          {/* MORE, TOP-RIGHT (§6). The drawer grows from THIS corner
              now — the button you pressed is where the panel comes
              from, which is the whole of MOTION §4 and the reason it
              used to grow from the bottom. Nothing else about §4
              changes: same timing, same dim, same first-tap rule. */}
          <button
            type="button"
            onClick={openMore}
            aria-haspopup="dialog"
            aria-expanded={Boolean(moreOpen)}
            aria-label={t("hub.more")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: A11Y.minTapTargetPx,
              minWidth: A11Y.minTapTargetPx,
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <IconChip name="more" size={22} onDark />
          </button>
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
