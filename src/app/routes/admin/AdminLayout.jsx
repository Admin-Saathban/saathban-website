/* ════════════════════════════════════════════════
   /app/admin — layout shell and the mock data store.

   All admin state lives here as plain React state seeded from
   ./data.js, passed to child routes via Outlet context. NO Supabase
   calls in this lane yet — every action below mutates local state in
   the same shape the real RPC/update would, so wiring the backend later
   replaces the bodies of these callbacks and nothing else.

   Mirrored server behaviour worth knowing about (0004_buddy_vetting.sql):
   every status change appends an audit entry — the mock does the same,
   so the detail view's audit trail behaves like production.

   There is no auth yet either; the header carries a mock identity
   switcher for the two admin levels (support / super) so scoping can be
   exercised in the UI before it is enforced anywhere.
   ════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import { MOCK_APPLICATIONS, MOCK_REPORTS, MOCK_ADMINS } from "./data.js";

export default function AdminLayout() {
  const [applications, setApplications] = useState(MOCK_APPLICATIONS);
  const [reports, setReports] = useState(MOCK_REPORTS);
  const [admin, setAdmin] = useState(MOCK_ADMINS[0]);

  // ─── Actions (the future Supabase surface) ───
  const actions = useMemo(() => {
    const patchApp = (id, fn) =>
      setApplications((apps) => apps.map((a) => (a.id === id ? fn(a) : a)));

    return {
      // Status transitions audit-log automatically, mirroring the
      // on_buddy_status_change trigger.
      setStatus(id, to, note) {
        patchApp(id, (a) => ({
          ...a,
          status: to,
          review_notes: note || a.review_notes,
          reviewed_by: admin.id,
          decided_at: ["rejected", "active", "suspended"].includes(to)
            ? new Date().toISOString()
            : a.decided_at,
          audit: [
            ...a.audit,
            {
              at: new Date().toISOString(),
              actor: admin.name,
              action: "Status change",
              from: a.status,
              to,
              note: note || null,
            },
          ],
        }));
      },

      toggleFlag(id, flagKey) {
        patchApp(id, (a) => ({
          ...a,
          reviewer_flags: a.reviewer_flags.includes(flagKey)
            ? a.reviewer_flags.filter((f) => f !== flagKey)
            : [...a.reviewer_flags, flagKey],
        }));
      },

      saveReviewNotes(id, notes) {
        patchApp(id, (a) => ({ ...a, review_notes: notes }));
      },

      // "The collection is not the safeguard; the call is."
      recordReferenceCall(id, refId, callNotes) {
        patchApp(id, (a) => ({
          ...a,
          references: a.references.map((r) =>
            r.id === refId
              ? {
                  ...r,
                  called_at: new Date().toISOString(),
                  called_by: admin.id,
                  call_notes: callNotes || null,
                }
              : r
          ),
        }));
      },

      requestDocument(id, type, note) {
        patchApp(id, (a) => ({
          ...a,
          document_requests: [
            ...a.document_requests,
            {
              id: `doc-${Date.now()}`,
              type,
              note: note || null,
              requested_at: new Date().toISOString(),
              requested_by: admin.id,
              status: "awaiting",
            },
          ],
        }));
      },

      resolveReport(id, resolution) {
        setReports((rs) =>
          rs.map((r) =>
            r.id === id ? { ...r, status: "resolved", resolution } : r
          )
        );
      },
    };
  }, [admin]);

  const openBuddyCount = applications.filter((a) =>
    ["pending", "interviewing"].includes(a.status)
  ).length;
  const openReportCount = reports.filter((r) => r.status === "open").length;

  const navItems = [
    { to: "buddies", label: "Buddy review", count: openBuddyCount },
    { to: "moderation", label: "Moderation", count: openReportCount },
  ];

  return (
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
          >
            Saathban
          </div>
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

        {/* Coming later in the build order — visible so the shape of the
            admin area is legible, disabled so nothing dead-ends. */}
        {["Accounts & recovery", "Audit log", "Milestone messages"].map(
          (label) => (
            <div
              key={label}
              title="Arrives in a later build step"
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

        <div style={{ marginTop: "auto", padding: "18px 10px 0" }}>
          <a
            href="/app"
            style={{ color: C.sage, fontSize: 15, textDecoration: "none" }}
          >
            ← Back to the app
          </a>
        </div>
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
          <span style={{ fontSize: 16, color: C.textMuted }}>
            Signed in as (mock)
          </span>
          {MOCK_ADMINS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAdmin(a)}
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 18px",
                borderRadius: 10,
                border: `2px solid ${admin.id === a.id ? C.green : C.warmGray}`,
                background: admin.id === a.id ? C.green : C.white,
                color: admin.id === a.id ? C.cream : C.textMain,
                fontFamily: FONTS.sans,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {a.name} · {a.level === "super" ? "Super-admin" : "Support admin"}
            </button>
          ))}
        </header>

        <main style={{ flex: 1, padding: "30px 32px", minWidth: 0 }}>
          <Outlet context={{ applications, reports, admin, actions }} />
        </main>
      </div>
    </div>
  );
}
