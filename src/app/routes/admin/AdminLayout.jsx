/* ════════════════════════════════════════════════
   /app/admin — the panel's shell.

   RequireAuth (AppRoot) already guarantees a signed-in admin profile;
   who you are and your level (moderator / support / super) come from
   the profiles row, not a switcher.

   ── One navigation, every screen ──

   NAV below is the single list of admin screens, grouped into a few
   sections and filtered by level. A screen missing from it is a screen
   reachable only by typing its address, which is exactly what this
   panel exists to end.

   ── Shape follows width ──

   900px and up: the navigation is a column that stays beside the work,
   sticky under the app header. Below 900px it is a drawer behind a
   labelled Menu button: focus moves into it, Tab stays inside it,
   Escape and the back button close it (useBackToClose), and focus goes
   back to the button. In Urdu the whole row is mirrored by dir="rtl" on
   the app shell, so the column and the drawer are on the right.

   Applications still load here for the vetting screens (BuddyDesk and
   BuddyApplication read them from the outlet context), and every
   mutation is a real write followed by a refetch. The counts in the
   navigation come from admin_dashboard (0176), the same call the front
   screen reads, so the two can never disagree.
   ════════════════════════════════════════════════ */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";
import useBackToClose from "../../components/useBackToClose.js";
import useMedia, { SIDE_NAV_QUERY } from "./useMedia.js";
import { STAFF, ALL_LEVELS, SUPER, levelOf } from "./levels.js";
import * as api from "./api.js";
import AdminSignOut from "./AdminSignOut.jsx";

/* Where "Go to the app" lands. An admin has no Icon home; the community
   feed is the part of the app everyone shares and the part an admin
   most often needs to see as people see it. */
export const APP_LANDING_FOR_ADMIN = "/app/community";

/* count(d) reads the admin_dashboard payload; absent for a level means
   the level does not see that number at all. */
const NAV = [
  {
    key: "desk",
    items: [
      { to: "/app/admin", end: true, label: "admin.nav.front", levels: ALL_LEVELS, count: (d) => attentionTotal(d) },
    ],
  },
  {
    key: "safety",
    label: "admin.nav.sectionSafety",
    items: [
      { to: "/app/admin/moderation", label: "admin.nav.reports", levels: ALL_LEVELS, count: (d) => d?.reports?.open },
      { to: "/app/admin/content", label: "admin.nav.content", levels: STAFF },
      { to: "/app/admin/questions", label: "admin.nav.questions", levels: STAFF, count: (d) => d?.questions_open },
      /* One screen, two honest names: the database shows a super-admin every entry and anyone else only their own (0179, 0180). */
      { to: "/app/admin/audit", label: "admin.nav.audit", levels: SUPER },
      { to: "/app/admin/audit", label: "admin.nav.myActions", levels: ["moderator", "support"] },
    ],
  },
  {
    key: "people",
    label: "admin.nav.sectionPeople",
    items: [
      { to: "/app/admin/people", label: "admin.nav.people", levels: STAFF },
      {
        to: "/app/admin/buddies",
        label: "admin.nav.buddies",
        levels: STAFF,
        count: (d) => (d?.applications ? Number(d.applications.pending) + Number(d.applications.interviewing) + Number(d.documents_to_review || 0) : 0),
      },
      { to: "/app/admin/activity", label: "admin.nav.activity", levels: STAFF },
      { to: "/app/admin/test-data", label: "admin.nav.testData", levels: STAFF },
    ],
  },
  {
    key: "reach",
    label: "admin.nav.sectionReach",
    items: [
      { to: "/app/admin/broadcasts", label: "admin.nav.broadcasts", levels: STAFF },
      { to: "/app/admin/gatherings", label: "admin.nav.gatherings", levels: STAFF, count: (d) => d?.proposals_pending },
      { to: "/app/admin/places", label: "admin.nav.places", levels: STAFF },
      { to: "/app/admin/milestones", label: "admin.nav.milestones", levels: STAFF },
    ],
  },
  {
    key: "grow",
    label: "admin.nav.sectionGrow",
    items: [
      { to: "/app/admin/grow/courses", label: "admin.nav.courses", levels: STAFF },
      { to: "/app/admin/grow/pending", label: "admin.nav.pending", levels: STAFF },
      { to: "/app/admin/grow/surveys", label: "admin.nav.surveys", levels: STAFF },
      { to: "/app/admin/grow/results", label: "admin.nav.results", levels: SUPER },
      { to: "/app/admin/grow/interest", label: "admin.nav.interest", levels: STAFF },
    ],
  },
];

/* Everything the front screen lists as waiting, as one number. Unchecked
   access notes are left out: they are real work but not a decision
   anyone is waiting on, and a badge that never goes away stops being read. */
export function attentionTotal(d) {
  if (!d) return 0;
  return (
    Number(d.reports?.open || 0) +
    Number(d.applications?.pending || 0) +
    Number(d.applications?.interviewing || 0) +
    Number(d.documents_to_review || 0) +
    Number(d.questions_open || 0) +
    Number(d.proposals_pending || 0)
  );
}

export function navFor(level) {
  return NAV.map((s) => ({ ...s, items: s.items.filter((i) => i.levels.includes(level)) })).filter((s) => s.items.length);
}

function AdminNav({ level, dashboard, onNavigate, idPrefix }) {
  const { t, ts, meta } = useI18n();
  const sections = navFor(level);
  return (
    <nav aria-label={t("admin.shell.navLabel")} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sections.map((s) => (
        <div key={s.key} role="group" aria-labelledby={s.label ? `${idPrefix}-${s.key}` : undefined} style={{ marginBottom: 10 }}>
          {s.label && (
            <div
              id={`${idPrefix}-${s.key}`}
              style={{
                fontSize: ts(15),
                fontWeight: 700,
                letterSpacing: meta.dir === "rtl" ? 0 : 0.6,
                color: C.cream,
                opacity: 0.85,
                padding: "10px 14px 4px",
                lineHeight: meta.dir === "rtl" ? 1.8 : 1.3,
              }}
            >
              {t(s.label)}
            </div>
          )}
          {s.items.map((item) => {
            const n = item.count ? Number(item.count(dashboard) || 0) : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                data-admin-nav={item.to.replace("/app/admin", "") || "/"}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  minHeight: A11Y.minTapTargetPx,
                  padding: "4px 14px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: ts(A11Y.minBodyPx),
                  fontWeight: isActive ? 800 : 600,
                  lineHeight: meta.dir === "rtl" ? 1.9 : 1.3,
                  color: isActive ? C.green : C.cream,
                  background: isActive ? C.cream : "transparent",
                  /* Never colour alone: the current page also carries a bar. */
                  borderInlineStart: `4px solid ${isActive ? C.brown : "transparent"}`,
                })}
              >
                {({ isActive }) => (
                  <>
                    {/* NavLink sets aria-current="page" on the current one. */}
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{t(item.label)}</span>
                    {n > 0 && (
                      <span
                        aria-label={t("admin.shell.waitingCount", { n })}
                        style={{
                          flex: "0 0 auto",
                          minWidth: 30,
                          textAlign: "center",
                          padding: "1px 9px",
                          borderRadius: 50,
                          background: C.brown,
                          color: C.cream,
                          fontSize: ts(15),
                          fontWeight: 800,
                          lineHeight: 1.6,
                        }}
                      >
                        {n}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}

      {/* THE WAY INTO THE APP. The way back is the app header's own
          "Admin panel" link, which points at /app/admin. */}
      <NavLink
        to={APP_LANDING_FOR_ADMIN}
        onClick={onNavigate}
        data-admin-nav="go-to-app"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          minHeight: A11Y.minTapTargetPx,
          padding: "4px 14px",
          marginTop: 6,
          borderRadius: 10,
          border: `2px solid ${C.cream}`,
          textDecoration: "none",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          lineHeight: meta.dir === "rtl" ? 1.9 : 1.3,
          color: C.cream,
        }}
      >
        <span>{t("admin.shell.goToApp")}</span>
        <span aria-hidden="true">{meta.dir === "rtl" ? "←" : "→"}</span>
      </NavLink>
      <AdminSignOut />
    </nav>
  );
}

function WhoAmI({ admin, tone = "light" }) {
  const { t, ts } = useI18n();
  const levelWord =
    admin.level === "super" ? t("admin.levelSuper") : admin.level === "moderator" ? t("admin.levelModerator") : t("admin.levelSupport");
  return (
    <div style={{ fontSize: ts(16), lineHeight: 1.5, color: tone === "light" ? C.cream : C.textMuted, minWidth: 0 }}>
      <strong style={{ color: tone === "light" ? C.cream : C.textMain, overflowWrap: "anywhere" }}>{admin.name}</strong>
      <span>{" · "}{levelWord}</span>
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function MenuDrawer({ open, onClose, returnFocusTo, children }) {
  const { t, ts } = useI18n();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  /* Escape and the back button. */
  useBackToClose(open, onClose);

  useEffect(() => {
    if (!open) return undefined;
    const back = returnFocusTo.current;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      /* After the drawer has gone, so the focus lands on something visible. */
      window.setTimeout(() => {
        if (back && document.contains(back)) back.focus();
      }, 0);
    };
  }, [open, returnFocusTo]);

  const trap = (e) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div className="sb-adm-scrim" hidden={!open} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        id="sb-admin-drawer"
        data-admin-drawer
        data-open={open ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        aria-label={t("admin.shell.navLabel")}
        className="sb-adm-drawer"
        hidden={!open}
        onKeyDown={trap}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={{
              minHeight: A11Y.minTapTargetPx,
              minWidth: A11Y.minTapTargetPx,
              padding: "0 16px",
              borderRadius: 10,
              border: `2px solid ${C.cream}`,
              background: "transparent",
              color: C.cream,
              fontFamily: "inherit",
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true">✕ </span>
            {t("admin.shell.closeMenu")}
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export default function AdminLayout() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const { pathname } = useLocation();
  const level = levelOf(profile);
  const admin = { id: profile.id, name: profile.full_name, level };
  /* A moderator moderates (0125) and nothing else: vetting is refused to
     them at the database, so the panel does not fetch it. */
  const isModerator = level === "moderator";

  const [applications, setApplications] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState(false);

  const refreshDashboard = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_dashboard");
    if (error) {
      setDashboardError(true);
      return;
    }
    setDashboardError(false);
    setDashboard(data);
  }, []);

  const reload = useCallback(async () => {
    refreshDashboard();
    try {
      setLoadError(null);
      setApplications(isModerator ? [] : await api.fetchApplications());
    } catch (e) {
      setLoadError(e.message || t("admin.loadFailed"));
      setApplications([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModerator, refreshDashboard]);

  useEffect(() => {
    reload();
  }, [reload]);

  /* The counts follow the work: moving between screens is when something
     has usually just been decided. Counts only, so no audit row. */
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    refreshDashboard();
  }, [pathname, refreshDashboard]);

  const actions = useMemo(
    () => ({
      async setStatus(id, to, note) {
        await api.setApplicationStatus(id, to, note);
        await reload();
      },
      async toggleFlag(app, flagKey) {
        const flags = app.reviewer_flags.includes(flagKey)
          ? app.reviewer_flags.filter((f) => f !== flagKey)
          : [...app.reviewer_flags, flagKey];
        await api.setReviewerFlags(app.id, flags);
        await reload();
      },
      async saveReviewNotes(id, notes) {
        await api.saveReviewNotes(id, notes);
        await reload();
      },
      async recordReferenceCall(refId, callNotes) {
        await api.recordReferenceCall(refId, admin.id, callNotes);
        await reload();
      },
      async requestDocument(applicationId, type, note) {
        await api.createDocumentRequest(applicationId, type, note);
        await reload();
      },
      async markDocumentReceived(requestId) {
        await api.markDocumentReceived(requestId);
        await reload();
      },
    }),
    [admin.id, reload]
  );

  /* ── The drawer ── */
  const sideNav = useMedia(SIDE_NAV_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => {
    if (sideNav) setMenuOpen(false);
  }, [sideNav]);

  const headerH = "var(--sb-hdr-h, calc(57px + var(--sb-safe-top, 0px)))";

  return (
    <>
      <style>{`
        .sb-adm-shell { display: flex; align-items: flex-start; min-height: calc(100vh - ${headerH}); background: ${C.bg}; color: ${C.textMain}; }
        .sb-adm-side {
          flex: 0 0 272px; width: 272px; box-sizing: border-box;
          position: sticky; top: ${headerH};
          height: calc(100vh - ${headerH}); overflow-y: auto; overscroll-behavior: contain;
          background: ${C.green}; color: ${C.cream}; padding: 20px 12px 28px;
        }
        .sb-adm-main { flex: 1 1 auto; min-width: 0; box-sizing: border-box; padding: 28px clamp(20px, 2.4vw, 44px) 72px; }
        .sb-adm-bar { display: none; }
        .sb-adm-scrim { position: fixed; inset: 0; background: rgba(15, 17, 19, 0.45); z-index: 60; }
        .sb-adm-drawer {
          position: fixed; inset-block: 0; inset-inline-start: 0; z-index: 61;
          width: min(340px, 88vw); box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain;
          background: ${C.green}; color: ${C.cream};
          padding: calc(12px + var(--sb-safe-top, 0px)) 12px calc(24px + var(--sb-safe-bottom, 0px));
          box-shadow: 0 0 40px rgba(0,0,0,0.25);
        }
        @media (max-width: 899.98px) {
          .sb-adm-shell { display: block; }
          .sb-adm-side { display: none; }
          .sb-adm-bar { display: flex; }
          .sb-adm-main { padding: 14px 16px 56px; }
        }
        /* Shared by the screens: a list and what it opens, side by side. */
        .sb-adm-split { display: grid; gap: 22px; align-items: start; grid-template-columns: minmax(0, 1fr); }
        .sb-adm-split[data-split="yes"] { grid-template-columns: minmax(320px, 400px) minmax(0, 1fr); }
        @media (min-width: 1700px) { .sb-adm-split[data-split="yes"] { grid-template-columns: minmax(360px, 480px) minmax(0, 1fr); } }
        .sb-adm-split[data-split="yes"] > .sb-adm-split-list {
          position: sticky; top: calc(${headerH} + 12px);
          max-height: calc(100vh - ${headerH} - 24px); overflow-y: auto; overscroll-behavior: contain;
        }
        .sb-adm-split-detail { min-width: 0; container-type: inline-size; }
        /* Card lists that use the width they are given. */
        .sb-adm-cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 540px), 1fr)); align-items: start; }
      `}</style>

      <div className="sb-adm-shell" style={{ fontFamily: meta.fonts.body, fontSize: ts(A11Y.minBodyPx) }} data-admin-shell>
        {/* ─── Side navigation (900px and up) ─── */}
        <aside className="sb-adm-side" data-admin-side>
          <div style={{ padding: "0 14px 16px" }}>
            <div style={{ fontSize: ts(24), fontWeight: 800, lineHeight: meta.dir === "rtl" ? 1.8 : 1.15 }}>{t("admin.shell.title")}</div>
            <WhoAmI admin={admin} />
          </div>
          <AdminNav level={level} dashboard={dashboard} idPrefix="side" />
        </aside>

        <div className="sb-adm-main" data-admin-main>
          {/* ─── Menu bar (below 900px) ─── */}
          <div
            className="sb-adm-bar"
            style={{ alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}
          >
            <button
              ref={menuButton}
              type="button"
              data-admin-menu-button
              aria-expanded={menuOpen}
              aria-controls="sb-admin-drawer"
              onClick={() => setMenuOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                minHeight: A11Y.minTapTargetPx,
                padding: "0 18px",
                borderRadius: 10,
                border: `2px solid ${C.green}`,
                background: C.green,
                color: C.cream,
                fontFamily: "inherit",
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true">☰</span>
              {t("admin.shell.menu")}
              {attentionTotal(dashboard) > 0 && (
                <span
                  style={{ padding: "0 9px", borderRadius: 50, background: C.cream, color: C.green, fontSize: ts(15), fontWeight: 800 }}
                >
                  {t("admin.shell.waitingCount", { n: attentionTotal(dashboard) })}
                </span>
              )}
            </button>
            <WhoAmI admin={admin} tone="dark" />
          </div>

          {!sideNav && (
            <MenuDrawer open={menuOpen} onClose={closeMenu} returnFocusTo={menuButton}>
              <div style={{ padding: "0 14px 12px" }}>
                <div style={{ fontSize: ts(22), fontWeight: 800, lineHeight: meta.dir === "rtl" ? 1.8 : 1.2 }}>{t("admin.shell.title")}</div>
                <WhoAmI admin={admin} />
              </div>
              <AdminNav level={level} dashboard={dashboard} onNavigate={closeMenu} idPrefix="drawer" />
            </MenuDrawer>
          )}

          <main style={{ minWidth: 0 }}>
            {loadError && /\/app\/admin\/buddies/.test(pathname) && (
              <p
                role="alert"
                style={{ border: `2px solid ${C.brown}`, borderRadius: 10, padding: "12px 16px", color: C.brown, fontWeight: 600, marginBottom: 18 }}
              >
                ⚠ {loadError}{" "}
                <button
                  type="button"
                  onClick={reload}
                  style={{
                    minHeight: A11Y.minTapTargetPx,
                    border: "none",
                    background: "none",
                    color: C.green,
                    fontSize: ts(A11Y.minBodyPx),
                    fontWeight: 700,
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t("admin.tryAgain")}
                </button>
              </p>
            )}
            <Suspense fallback={<p aria-busy="true" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>{t("admin.shell.opening")}</p>}>
              <Outlet
                context={{
                  applications: applications ?? [],
                  loading: applications === null,
                  admin,
                  actions,
                  reload,
                  dashboard,
                  dashboardError,
                  refreshDashboard,
                }}
              />
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
}
