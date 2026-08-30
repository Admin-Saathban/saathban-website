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
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import { useSession } from "../../lib/session.jsx";
import AppHeader from "../../components/AppHeader.jsx";
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
    { to: "buddies", label: "Buddy review", count: openBuddyCount },
    { to: "questions", label: "Questions", count: openQuestions },
    { to: "broadcasts", label: "Broadcasts", count: 0 },
    { to: "moderation", label: "Moderation", count: openReportCount },
    // The milestone-message desk lives outside the admin shell
    // (shared route with the Icon view — 0017).
    { to: "/app/milestones", label: "Milestones", count: 0 },
  ];

  return (
    <>
    <AppHeader />
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: C.bg,
        fontFamily: FONTS.sans,
        color: C.textMain,
        fontSize: A11Y.minBodyPx,
      }}
    >
      {/* ─── Sidebar ─── */}
      <aside
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
              fontFamily: FONTS.serif,
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
              color: C.sage,
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
            color: C.sage,
            padding: "16px 14px 4px",
          }}
        >{t("admin.viewSpaces")}</div>
        {[
          { to: "/app/community", label: "Community feed" },
          { to: "/app/outdoor", label: "Outdoor places" },
          { to: "/app/events", label: "Gatherings" },
          { to: "/app/groups", label: "Friend groups" },
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
        {["Accounts & recovery", "Audit log"].map(
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
              <span style={{ marginLeft: "auto", fontSize: 13, color: C.sage }}>
                soon
              </span>
            </div>
          )
        )}

        {/* No "back to the app" here: /app IS the admin desk for this
            role (it bounces straight back — the old link was a loop). */}
      </aside>

      {/* ─── Main column ─── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
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
              {admin.level === "super" ? "Super-admin" : "Support admin"}
            </span>
          </span>
        </header>

        <main style={{ flex: 1, padding: "30px 32px", minWidth: 0 }}>
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
                  fontFamily: FONTS.sans,
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
