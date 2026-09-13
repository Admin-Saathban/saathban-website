/* ════════════════════════════════════════════════
   /app/admin/buddies — the Saath-Buddy review queue.

   The full pipeline is visible as filter tabs with live counts:
   pending → interviewing → probation → active, plus the two exits
   (suspended, rejected). Rows come from AdminLayout's outlet context.

   The queue view deliberately shows review-state columns (flags,
   reference calls, waiting time), not application content — reading an
   application happens in the detail view.

   Two shapes. Full: a table across the page. Compact (BuddyDesk, beside
   an open application on a wide screen): a list of names, the open one
   marked, and the tab follows the open application's stage so it is
   always in the list you are looking at.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useI18n } from "../../lib/i18n.jsx";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import { PIPELINE, statusLabel } from "./data.js";
import { StatusChip, FlagBadge, fmtDate } from "./ui.jsx";

const TABS = [...PIPELINE, "suspended", "rejected"];

export default function BuddyQueue({ compact = false, selectedId = null }) {
  const { t } = useI18n();
  const { applications, loading } = useOutletContext();
  const navigate = useNavigate();
  const selectedStatus = selectedId ? applications.find((a) => a.id === selectedId)?.status : undefined;
  const [tab, setTab] = useState(selectedStatus || "pending");

  useEffect(() => {
    if (selectedStatus) setTab(selectedStatus);
  }, [selectedId, selectedStatus]);

  const counts = Object.fromEntries(
    TABS.map((st) => [st, applications.filter((a) => a.status === st).length])
  );
  const rows = applications
    .filter((a) => a.status === tab)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const open = (id) => navigate(`/app/admin/buddies/${id}`);

  return (
    <div>
      <h1
        style={{
          fontFamily: APP_FONT,
          fontSize: compact ? 26 : 32,
          fontWeight: 700,
          color: C.green,
          margin: "0 0 6px",
        }}
      >{t("admin.buddyReview")}</h1>
      {!compact && (
        <p style={{ color: C.textMuted, margin: "0 0 24px", maxWidth: 720 }}>
          {t("admin.buddyIntro")}
        </p>
      )}

      {/* ─── Pipeline tabs ─── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: compact ? 14 : 22,
        }}
      >
        {TABS.map((st, i) => {
          const selected = st === tab;
          const isExit = i >= PIPELINE.length;
          return (
            <button
              key={st}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(st)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: A11Y.minTapTargetPx,
                padding: compact ? "0 12px" : "0 18px",
                borderRadius: 10,
                border: `2px solid ${selected ? C.green : C.warmGray}`,
                background: selected ? C.green : C.white,
                color: selected ? C.cream : isExit ? C.textMuted : C.textMain,
                fontFamily: "inherit",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                marginInlineStart: !compact && i === PIPELINE.length ? 18 : 0,
              }}
            >
              {/* Non-colour marker for the selected tab (SPEC: never colour alone) */}
              {selected && <span aria-hidden="true">✓</span>}
              {statusLabel(st, t)}
              <span
                style={{
                  minWidth: 26,
                  textAlign: "center",
                  padding: "1px 8px",
                  borderRadius: 50,
                  background: selected ? C.cream : C.warmGray,
                  color: selected ? C.green : C.textMain,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {counts[st]}
              </span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div
          aria-busy={loading}
          style={{
            background: C.white,
            border: `1px solid ${C.warmGray}`,
            borderRadius: 14,
            padding: compact ? 20 : 40,
            textAlign: "center",
            color: C.textMuted,
          }}
        >
          {loading
            ? t("admin.queue.loading")
            : t("admin.queue.emptyTab", { status: statusLabel(tab, t) })}
        </div>
      ) : compact ? (
        /* ─── Compact list, beside an open application ─── */
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {rows.map((a) => {
            const called = a.references.filter((r) => r.called_at).length;
            const selected = a.id === selectedId;
            return (
              <li key={a.id}>
                <Link
                  to={`/app/admin/buddies/${a.id}`}
                  aria-current={selected ? "page" : undefined}
                  data-application-row={a.id}
                  style={{
                    display: "block",
                    minHeight: A11Y.minTapTargetPx,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: selected ? `2.5px solid ${C.green}` : `1px solid ${C.warmGray}`,
                    borderInlineStart: `5px solid ${selected ? C.green : "transparent"}`,
                    background: selected ? C.selected : C.white,
                    color: C.textMain,
                    textDecoration: "none",
                  }}
                >
                  <strong style={{ display: "block", color: C.green, fontSize: 19 }}>
                    {selected && <span aria-hidden="true">▸ </span>}
                    {a.legal_name}
                  </strong>
                  <span style={{ display: "block", color: C.textMuted, fontSize: 16 }}>
                    {a.city} · {fmtDate(a.created_at)}
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4, fontSize: 16 }}>
                    <span style={{ fontWeight: 700, color: called >= 2 ? C.green : C.brown }}>
                      {t("admin.app.refsCalled", { done: called, total: a.references.length || 2 })}
                    </span>
                    {a.reviewer_flags.length > 0 && <FlagBadge count={a.reviewer_flags.length} />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        /* ─── Queue table ─── */
        <div
          style={{
            background: C.white,
            border: `1px solid ${C.warmGray}`,
            borderRadius: 14,
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 17,
            }}
          >
            <thead>
              <tr>
                {[
                  t("admin.queue.applicant"),
                  t("admin.queue.city"),
                  t("admin.queue.languages"),
                  t("admin.queue.applied"),
                  t("admin.queue.refsCalled"),
                  t("admin.queue.redFlags"),
                  t("admin.queue.status"),
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "start",
                      padding: "14px 18px",
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      color: C.textMuted,
                      borderBottom: `1px solid ${C.warmGray}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const called = a.references.filter((r) => r.called_at).length;
                return (
                  <tr
                    key={a.id}
                    onClick={() => open(a.id)}
                    onKeyDown={(e) => e.key === "Enter" && open(a.id)}
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    className="adm-row"
                  >
                    <td style={td}>
                      <Link to={`/app/admin/buddies/${a.id}`} style={{ fontWeight: 600, color: C.textMain }} onClick={(e) => e.stopPropagation()}>
                        {a.legal_name}
                      </Link>
                    </td>
                    <td style={td}>{a.city}</td>
                    <td style={td}>{a.languages.join(", ")}</td>
                    <td style={td}>{fmtDate(a.created_at)}</td>
                    <td style={td}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: called === 2 ? C.green : C.brown,
                        }}
                      >
                        {called} / {a.references.length || 2}
                      </span>
                      {called < 2 && (
                        <span style={{ color: C.textMuted }}> — {t("admin.queue.callsPending")}</span>
                      )}
                    </td>
                    <td style={td}>
                      {a.reviewer_flags.length > 0 ? (
                        <FlagBadge count={a.reviewer_flags.length} />
                      ) : (
                        <span style={{ color: C.textMuted }}>{t("admin.queue.noFlags")}</span>
                      )}
                    </td>
                    <td style={td}>
                      <StatusChip status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <style>{`
            .adm-row td { border-bottom: 1px solid ${C.warmGray}; }
            .adm-row:last-child td { border-bottom: none; }
            .adm-row:hover td, .adm-row:focus td { background: ${C.cream}; }
            .adm-row:focus { outline: 2px solid ${C.green}; outline-offset: -2px; }
          `}</style>
        </div>
      )}
    </div>
  );
}

const td = { padding: "16px 18px", verticalAlign: "middle" };
