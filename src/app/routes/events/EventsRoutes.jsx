/* ════════════════════════════════════════════════
   Events route table — the single entry point for this folder.
   Registration snippet in EVENTS_WIRING.md (AppRoot is not edited by
   this lane while other sessions hold uncommitted changes there).

   Tabs by role: every signed-in role sees Gatherings; Icons get
   My calendar; admins get Manage. Direct URLs to a tab a role
   doesn't hold bounce to the list — and RLS behind each screen makes
   the bounce cosmetic, not security.
   ════════════════════════════════════════════════ */

import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { Screen } from "./ui.jsx";
import EventsList from "./EventsList.jsx";
import MyCalendar from "./MyCalendar.jsx";
import AdminEvents from "./AdminEvents.jsx";

/* Absolute tab targets computed from the current location — relative
   links inside a splat route resolve differently across react-router
   minor versions, and a tab bar is the wrong place to find that out. */
function Tab({ to, active, children }) {
  const { ts } = useI18n();
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: A11Y.minTapTargetPx,
        padding: "0 20px",
        borderRadius: 50,
        border: active ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: active ? C.white : "transparent",
        color: C.textMain,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      <span aria-hidden="true" style={{ color: C.green, visibility: active ? "visible" : "hidden" }}>
        ✓
      </span>
      {children}
    </Link>
  );
}

export default function EventsRoutes() {
  const { t } = useI18n();
  const { profile } = useSession();
  const { pathname } = useLocation();
  const role = profile?.role;

  const onCalendar = /\/calendar\/?$/.test(pathname);
  const onManage = /\/manage\/?$/.test(pathname);
  const base = pathname.replace(/\/(calendar|manage)\/?$/, "").replace(/\/$/, "");

  return (
    <>
      <AppHeader />
      <Screen>
        <nav
          aria-label={t("events.nav.events")}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}
        >
          <Tab to={base || "/"} active={!onCalendar && !onManage}>
            {t("events.nav.events")}
          </Tab>
          {role === "saath_icon" && (
            <Tab to={`${base}/calendar`} active={onCalendar}>
              {t("events.nav.calendar")}
            </Tab>
          )}
          {role === "admin" && (
            <Tab to={`${base}/manage`} active={onManage}>
              {t("events.nav.manage")}
            </Tab>
          )}
        </nav>

        <Routes>
          <Route index element={<EventsList />} />
          <Route
            path="calendar"
            element={role === "saath_icon" ? <MyCalendar /> : <Navigate to=".." replace />}
          />
          <Route
            path="manage"
            element={role === "admin" ? <AdminEvents /> : <Navigate to=".." replace />}
          />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </Screen>
    </>
  );
}
