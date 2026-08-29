/* ════════════════════════════════════════════════
   /app/admin/moderation — reports queue skeleton.

   Community, DMs, and park boards land at build steps 11–12, so this
   queue runs on mock reports (data.js) with no backing table yet. The
   shape is real, though: SPEC.md commits to a response target measured
   in HOURS, not days — so age is the loudest column, and anything past
   24 hours is visibly overdue.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import { Card, AdminBtn, fmtDateTime, hoursAgo } from "./ui.jsx";

export default function ModerationQueue() {
  const { reports, actions } = useOutletContext();
  const [resolutionDraft, setResolutionDraft] = useState({}); // id -> text

  const open = reports.filter((r) => r.status === "open");
  const resolved = reports.filter((r) => r.status === "resolved");

  return (
    <div style={{ maxWidth: 960 }}>
      <h1
        style={{
          fontFamily: FONTS.serif,
          fontSize: 32,
          fontWeight: 700,
          color: C.green,
          margin: "0 0 6px",
        }}
      >
        Moderation
      </h1>
      <p style={{ color: C.textMuted, margin: "0 0 24px", maxWidth: 720 }}>
        Reports from community posts, DM requests, and park boards. The
        response target is measured in <strong>hours, not days</strong>.
        Running on mock data until Community ships (build step 11).
      </p>

      <div style={{ display: "grid", gap: 22 }}>
        <Card
          title="Open reports"
          aside={
            <span style={{ fontWeight: 700, color: open.length ? C.brown : C.green }}>
              {open.length} waiting
            </span>
          }
        >
          {open.length === 0 ? (
            <p style={{ margin: 0, color: C.textMuted }}>
              The queue is clear.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {open.map((r) => {
                const age = hoursAgo(r.created_at);
                const overdue = age >= 24;
                return (
                  <div
                    key={r.id}
                    style={{
                      border: `1px solid ${C.warmGray}`,
                      borderLeft: `4px solid ${overdue ? C.brown : C.olive}`,
                      borderRadius: 10,
                      padding: "16px 20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          padding: "3px 12px",
                          borderRadius: 50,
                          background: C.warmGray,
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        {r.surface}
                        {r.place && ` · ${r.place}`}
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: overdue ? C.brown : C.textMuted,
                          fontSize: 15,
                        }}
                      >
                        {overdue ? "⚑ " : ""}
                        {age}h old
                        {overdue && " — past the response target"}
                      </span>
                      <span style={{ color: C.textMuted, fontSize: 15 }}>
                        · reported {fmtDateTime(r.created_at)}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 6px", fontStyle: "italic" }}>
                      {r.content_excerpt}
                    </p>
                    <p style={{ margin: "0 0 14px", fontSize: 16, color: C.textMuted }}>
                      Reported by {r.reported_by} · reason:{" "}
                      <strong style={{ color: C.textMain }}>{r.reason}</strong>
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Resolution note"
                        value={resolutionDraft[r.id] || ""}
                        onChange={(e) =>
                          setResolutionDraft((d) => ({
                            ...d,
                            [r.id]: e.target.value,
                          }))
                        }
                        style={{
                          flex: 1,
                          minWidth: 220,
                          minHeight: A11Y.minTapTargetPx,
                          boxSizing: "border-box",
                          fontFamily: FONTS.sans,
                          fontSize: 17,
                          background: C.cream,
                          border: `1px solid ${C.warmGray}`,
                          borderRadius: 10,
                          padding: "0 14px",
                        }}
                      />
                      <AdminBtn
                        kind="primary"
                        disabled={!(resolutionDraft[r.id] || "").trim()}
                        onClick={() =>
                          actions.resolveReport(
                            r.id,
                            resolutionDraft[r.id].trim()
                          )
                        }
                      >
                        Resolve
                      </AdminBtn>
                      {/* Content/account actions (remove post, pause account,
                          warn) arrive with the real moderation tooling. */}
                      <AdminBtn kind="ghost" disabled title="Arrives with build step 11">
                        Remove content
                      </AdminBtn>
                      <AdminBtn kind="ghost" disabled title="Arrives with build step 11">
                        Pause account
                      </AdminBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Recently resolved">
          {resolved.length === 0 ? (
            <p style={{ margin: 0, color: C.textMuted }}>Nothing yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {resolved.map((r) => (
                <div key={r.id} style={{ fontSize: 16 }}>
                  <span style={{ color: C.green, fontWeight: 700 }}>✓</span>{" "}
                  <strong>{r.surface}</strong> — {r.reason}
                  <div style={{ color: C.textMuted, fontSize: 15 }}>
                    {r.resolution}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
