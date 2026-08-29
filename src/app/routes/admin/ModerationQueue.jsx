/* ════════════════════════════════════════════════
   /app/admin/moderation — the reports queue, wired to the real
   community_reports table (migration 0014).

   SPEC.md commits to a response target measured in HOURS, not days —
   so age is the loudest column and anything past 24 hours is visibly
   overdue. Every decision (resolve/dismiss) is audit-logged by the
   0014 trigger; "Hide content" soft-hides a post or comment in place.
   Reported DMs are moderated from the snapshot the reporter's client
   took — admins have NO read path into DM threads (QUESTIONS.md C5).

   Self-contained on purpose: reads and writes go straight through
   supabase (admin RLS), not the AdminLayout mock context.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import supabase from "../../lib/supabase.js";
import { Card, AdminBtn, fmtDateTime, hoursAgo } from "./ui.jsx";

const KIND_LABEL = {
  post: "Community post",
  comment: "Comment",
  dm_message: "Direct message",
  park_board: "Park board",
  group: "Friend group",
  group_post: "Group post",
};

const HIDE_TABLE = {
  post: "community_posts",
  comment: "post_comments",
  park_board: "park_board_messages",
  group: "groups",
  group_post: "group_posts",
};

async function fetchReports() {
  const { data, error } = await supabase
    .from("community_reports")
    .select(
      "id, reporter_id, target_kind, target_id, target_author_id, target_excerpt, reason, status, resolution_note, resolved_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

async function fetchNames(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name")
    .in("id", unique);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.id, p.full_name]));
}

export default function ModerationQueue() {
  const [reports, setReports] = useState(null); // null = loading
  const [names, setNames] = useState({});
  const [resolutionDraft, setResolutionDraft] = useState({}); // id -> text
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const rows = await fetchReports();
      setReports(rows);
      setNames(
        await fetchNames(rows.flatMap((r) => [r.reporter_id, r.target_author_id]))
      );
    } catch {
      setError("The queue didn't load. Please try again in a moment.");
      setReports([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (report, status) => {
    setError("");
    try {
      const { error: err } = await supabase
        .from("community_reports")
        .update({
          status,
          resolution_note: (resolutionDraft[report.id] || "").trim() || null,
        })
        .eq("id", report.id);
      if (err) throw err;
      await load();
    } catch {
      setError("That decision didn't save. Please try again.");
    }
  };

  /* Soft-hide the reported content where it lives (QUESTIONS.md O7:
     park-board messages hide the same way as posts and comments). */
  const hideContent = async (report) => {
    setError("");
    const table = HIDE_TABLE[report.target_kind];
    if (!table) return;
    try {
      const { data: me } = await supabase.auth.getUser();
      const { error: err } = await supabase
        .from(table)
        .update({ hidden_at: new Date().toISOString(), hidden_by: me?.user?.id || null })
        .eq("id", report.target_id);
      if (err) throw err;
      setResolutionDraft((d) => ({
        ...d,
        [report.id]: d[report.id] || "Content hidden.",
      }));
    } catch {
      setError("Hiding failed — the content may already be gone.");
    }
  };

  const open = (reports || []).filter((r) => r.status === "open");
  const decided = (reports || []).filter((r) => r.status !== "open").slice(0, 20);
  const nameOf = (id) => names[id] || "(account gone)";

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
        Reports from community posts, comments, and direct messages. The
        response target is measured in <strong>hours, not days</strong>. DM
        reports show the reporter's snapshot — threads themselves stay
        private to their participants.
      </p>

      {error && (
        <p role="alert" style={{ color: C.brown, fontWeight: 700 }}>
          ⚠ {error}
        </p>
      )}

      <div style={{ display: "grid", gap: 22 }}>
        <Card
          title="Open reports"
          aside={
            <span style={{ fontWeight: 700, color: open.length ? C.brown : C.green }}>
              {reports === null ? "…" : `${open.length} waiting`}
            </span>
          }
        >
          {reports === null ? (
            <p style={{ margin: 0, color: C.textMuted }} role="status">Loading…</p>
          ) : open.length === 0 ? (
            <p style={{ margin: 0, color: C.textMuted }}>The queue is clear.</p>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {open.map((r) => {
                const age = hoursAgo(r.created_at);
                const overdue = age >= 24;
                const canHide = Boolean(HIDE_TABLE[r.target_kind]);
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
                        {KIND_LABEL[r.target_kind] || r.target_kind}
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
                      “{r.target_excerpt || "(no excerpt captured)"}”
                    </p>
                    <p style={{ margin: "0 0 14px", fontSize: 16, color: C.textMuted }}>
                      By <strong style={{ color: C.textMain }}>{nameOf(r.target_author_id)}</strong>
                      {" · "}reported by {nameOf(r.reporter_id)}
                      {r.reason && (
                        <>
                          {" · "}reason:{" "}
                          <strong style={{ color: C.textMain }}>{r.reason}</strong>
                        </>
                      )}
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
                        placeholder="Resolution note (audit-logged)"
                        value={resolutionDraft[r.id] || ""}
                        onChange={(e) =>
                          setResolutionDraft((d) => ({ ...d, [r.id]: e.target.value }))
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
                      {canHide && (
                        <AdminBtn kind="ghost" onClick={() => hideContent(r)}>
                          Hide content
                        </AdminBtn>
                      )}
                      <AdminBtn
                        kind="primary"
                        disabled={!(resolutionDraft[r.id] || "").trim()}
                        onClick={() => decide(r, "resolved")}
                      >
                        Resolve
                      </AdminBtn>
                      <AdminBtn kind="ghost" onClick={() => decide(r, "dismissed")}>
                        Dismiss
                      </AdminBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Recently decided">
          {decided.length === 0 ? (
            <p style={{ margin: 0, color: C.textMuted }}>Nothing yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {decided.map((r) => (
                <div key={r.id} style={{ fontSize: 16 }}>
                  <span
                    style={{
                      color: r.status === "resolved" ? C.green : C.textMuted,
                      fontWeight: 700,
                    }}
                  >
                    {r.status === "resolved" ? "✓ resolved" : "— dismissed"}
                  </span>{" "}
                  <strong>{KIND_LABEL[r.target_kind] || r.target_kind}</strong>
                  {r.reason && <> — {r.reason}</>}
                  <div style={{ color: C.textMuted, fontSize: 15 }}>
                    {r.resolution_note || ""}
                    {r.resolved_at && ` · ${fmtDateTime(r.resolved_at)}`}
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
