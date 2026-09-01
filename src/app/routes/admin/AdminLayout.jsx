/* ════════════════════════════════════════════════
   /app/admin — layout shell over REAL data.

   RequireAuth (AppRoot) already guarantees a signed-in admin profile;
   this layout reads it from useSession() — who you are and your level
   (support / super) come from the profiles row, not a switcher.

   Applications load from Supabase through ./api.js; every action
   awaits its real write and then refetches, so what the reviewer sees
   is always what the database holds (including trigger-stamped fields
   like decided_at and reviewed_by). Moderation is live too
   (community_reports — ModerationQueue fetches its own rows; the
   sidebar just counts the open ones).
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../lib/i18n.jsx";
import { NavLink, Outlet } from "react-router-dom";
import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import { useSession } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";
import * as api from "./api.js";

export default function AdminLayout() {
  const { t } = useI18n();
  const { profile } = useSession();
  const admin = {
    id: profile.id,
    name: profile.full_name,
    level: profile.admin_level, // 'support' | 'super'
  };

  const [applications, setApplications] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);
  const [openReportCount, setOpenReportCount] = useState(0);
  const [openQuestions, setOpenQuestions] = useState(0);

  const reload = useCallback(async () => {
    try {
      setLoadError(null);
      setApplications(await api.fetchApplications());
      setOpenQuestions(await api.openQuestionsCount());
      const { count } = await supabase
        .from("community_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      setOpenReportCount(count || 0);
    } catch (e) {
      setLoadError(e.message || "Could not load applications.");
      setApplications([]);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Every mutation is a real write, then a refetch. Errors bubble to
  // the calling screen, which shows them next to the control used.
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
      // buddy_document_requests (0010) — the insert trigger notifies
      // the applicant and audit-logs.
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

  const apps = applications ?? [];
  const openBuddyCount = apps.filter((a) =>
    ["pending", "interviewing"].includes(a.status)
  ).length;

  const navItems = [
    { to: "buddies", label: t("admin.buddyReview"), count: openBuddyCount },
    { to: "questions", label: t("admin.questions"), count: openQuestions },
    { to: "broadcasts", label: t("admin.broadcasts"), count: 0 },
    { to: "moderation", label: t("admin.moderation"), count: openReportCount },
    // The milestone-message desk lives outside the admin shell
    // (shared route with the Icon view — 0017).
    { to: "/app/milestones", label: t("admin.navMilestones"), count: 0 },
  ];

  return (
    <>
    {/* ADMIN ON A PHONE. The shell was a flex row with a fixed 240px
        sidebar and no media query anywhere in the file — so on a 390px
        screen the sidebar took 240, the 32px main padding took 64, and
        the queue rendered into about 86px. Every report card overflowed
        sideways: resolution notes clipped mid-word, reporter names broken
        across lines, controls pushed off the edge.

        Moderation is not a desktop-only job. Reported content hits the
        queue within hours (SPEC, Community) and the person who acts on it
        is as likely to be holding a phone as sitting at a desk — a
        moderator who cannot read the report cannot act on it.

        Below 900px the sidebar stops being a column beside the content
        and becomes a scrollable strip above it. Nothing is removed: every
        destination stays reachable, which matters more here than
        tidiness, because an admin nav that hides items hides the one
        somebody needs. */}
    <style>{`
      @media (max-width: 900px) {
        .sb-admin-shell { flex-direction: column; }
        .sb-admin-side {
          width: 100% !important;
          flex-direction: row !important;
          overflow-x: auto;
          padding: 10px 12px !important;
          gap: 8px !important;
          align-items: center;
        }
        .sb-admin-side > * { flex: 0 0 auto; }
        .sb-admin-head { padding: 12px 16px !important; }
        .sb-admin-main { padding: 18px 14px !important; }
      }
    `}</style>
    <div
      className="sb-admin-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        background: C.bg,
        fontFamily: APP_FONT,
        color: C.textMain,
        fontSize: A11Y.minBodyPx,
      }}
    >
      {/* ─── Sidebar ─── */}
      <aside
        className="sb-admin-side"
        style={{
          width: 240,
          flexShrink: 0,
          background: C.green,
          color: C.cream,
          padding: "28px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ padding: "0 10px 22px" }}>
          <div
            style={{
              fontFamily: APP_FONT,
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >{t("admin.brand")}</div>
          <div
            style={{
              fontSize: 14,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: C.green,
              marginTop: 4,
            }}
          >
            Admin
          </div>
        </div>

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: A11Y.minTapTargetPx,
              padding: "0 14px",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: 17,
              fontWeight: 600,
              color: isActive ? C.green : C.cream,
              background: isActive ? C.cream : "transparent",
            })}
          >
            <span>{item.label}</span>
            {item.count > 0 && (
              <span
                style={{
                  minWidth: 28,
                  textAlign: "center",
                  padding: "2px 8px",
                  borderRadius: 50,
                  background: C.brown,
                  color: C.cream,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {item.count}
              </span>
            )}
          </NavLink>
        ))}

        {/* The community as people see it — an admin moderates what
            they can actually look at. Same routes, admin's own access. */}
        <div
          style={{
            fontSize: 13,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: C.green,
            padding: "16px 14px 4px",
          }}
        >{t("admin.viewSpaces")}</div>
        {[
          /* "Gatherings" pointed at /app/events, which §12 turned into a
             redirect to /app/outdoor — so it landed an admin on What is
             on, the SAME page as the row directly above it. Two entries,
             one destination, which is precisely the "half the doors open
             the same room" complaint. An admin wanting gatherings wants
             to MANAGE them. */
          { to: "/app/community", label: t("admin.spaceCommunity") },
          { to: "/app/outdoor", label: t("admin.spaceOutdoor") },
          { to: "/app/events/manage", label: t("admin.spaceGatherings") },
          { to: "/app/admin/places", label: t("admin.spacePlaces") },
          { to: "/app/groups", label: t("admin.spaceGroups") },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={{
              display: "flex",
              alignItems: "center",
              minHeight: A11Y.minTapTargetPx,
              padding: "0 14px",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: 16,
              color: C.cream,
            }}
          >
            {item.label}
          </NavLink>
        ))}

        {/* Coming later in the build order — visible so the shape of the
            admin area is legible, disabled so nothing dead-ends.
            (Milestone messages went live — it's in the nav above.) */}
        {[t("admin.soonAccounts"), t("admin.soonAudit")].map(
          (label) => (
            <div
              key={label}
              title={t("admin.laterBuild")}
              style={{
                display: "flex",
                alignItems: "center",
                minHeight: A11Y.minTapTargetPx,
                padding: "0 14px",
                borderRadius: 10,
                fontSize: 17,
                color: C.greenMuted,
                cursor: "default",
              }}
            >
              {label}
              <span style={{ marginLeft: "auto", fontSize: 13, color: C.green }}>{t("admin.soonBadge")}</span>
            </div>
          )
        )}

        {/* No "back to the app" here: /app IS the admin desk for this
            role (it bounces straight back — the old link was a loop). */}
      </aside>

      {/* ─── Main column ─── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          className="sb-admin-head"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 14,
            padding: "14px 32px",
            borderBottom: `1px solid ${C.warmGray}`,
            background: C.white,
          }}
        >
          <span style={{ fontSize: 17 }}>
            <strong>{admin.name}</strong>
            <span style={{ color: C.textMuted }}>
              {" · "}
              {admin.level === "super"
                ? t("admin.levelSuper")
                : admin.level === "moderator"
                  ? t("admin.levelModerator")
                  : t("admin.levelSupport")}
            </span>
          </span>
        </header>

        <main className="sb-admin-main" style={{ flex: 1, padding: "30px 32px", minWidth: 0 }}>
          {loadError && (
            <p
              role="alert"
              style={{
                border: `2px solid ${C.brown}`,
                borderRadius: 10,
                padding: "12px 16px",
                color: C.brown,
                fontWeight: 600,
                marginBottom: 18,
              }}
            >
              {loadError}{" "}
              <button
                type="button"
                onClick={reload}
                style={{
                  minHeight: A11Y.minTapTargetPx,
                  border: "none",
                  background: "none",
                  color: C.green,
                  fontSize: 17,
                  fontWeight: 700,
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontFamily: APP_FONT,
                }}
              >{t("admin.tryAgain")}</button>
            </p>
          )}
          <Outlet
            context={{
              applications: apps,
              loading: applications === null,
              admin,
              actions,
              reload,
            }}
          />
        </main>
      </div>
    </div>
    </>
  );
}
