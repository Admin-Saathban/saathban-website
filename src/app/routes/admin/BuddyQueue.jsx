/* ════════════════════════════════════════════════
   /app/admin/buddies — the Saath-Buddy review queue.

   The full pipeline is visible as filter tabs with live counts:
   pending → interviewing → probation → active, plus the two exits
   (suspended, rejected). Mock data only — see AdminLayout.jsx.

   The queue view deliberately shows review-state columns (flags,
   reference calls, waiting time), not application content — reading an
   application happens in the detail view, which is where routine-read
   audit logging will hook in at the app level.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useI18n } from "../../lib/i18n.jsx";
import { useNavigate, useOutletContext } from "react-router-dom";
import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import { PIPELINE, STATUS_LABELS } from "./data.js";
import { StatusChip, FlagBadge, fmtDate } from "./ui.jsx";

const TABS = [...PIPELINE, "suspended", "rejected"];

export default function BuddyQueue() {
  const { t } = useI18n();
  const { applications, loading } = useOutletContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState("pending");

  const counts = Object.fromEntries(
    TABS.map((t) => [t, applications.filter((a) => a.status === t).length])
  );
  const rows = applications
    .filter((a) => a.status === tab)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div>
      <h1
        style={{
          fontFamily: APP_FONT,
          fontSize: 32,
          fontWeight: 700,
          color: C.green,
          margin: "0 0 6px",
        }}
      >{t("admin.buddyReview")}</h1>
      <p style={{ color: C.textMuted, margin: "0 0 24px", maxWidth: 720 }}>
        {t("admin.buddyIntro")}
            </p>

      {/* ─── Pipeline tabs ─── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        {TABS.map((t, i) => {
          const selected = t === tab;
          const isExit = i >= PIPELINE.length;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(t)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: A11Y.minTapTargetPx,
                padding: "0 18px",
                borderRadius: 10,
                border: `2px solid ${selected ? C.green : C.warmGray}`,
                background: selected ? C.green : C.white,
                color: selected ? C.cream : isExit ? C.textMuted : C.textMain,
                fontFamily: APP_FONT,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                marginLeft: i === PIPELINE.length ? 18 : 0,
              }}
            >
              {/* Non-colour marker for the selected tab (SPEC: never colour alone) */}
              {selected && <span aria-hidden="true">✓</span>}
              {STATUS_LABELS[t]}
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
                {counts[t]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Queue table ─── */}
      {rows.length === 0 ? (
        <div
          aria-busy={loading}
          style={{
            background: C.white,
            border: `1px solid ${C.warmGray}`,
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
            color: C.textMuted,
          }}
        >
          {loading
            ? "Loading applications…"
            : `Nothing waiting under “${STATUS_LABELS[tab]}” right now.`}
        </div>
      ) : (
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
                  "Applicant",
                  "City",
                  "Languages",
                  "Applied",
                  "References called",
                  "Red flags",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
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
                    onClick={() => navigate(a.id)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(a.id)}
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    className="adm-row"
                  >
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{a.legal_name}</span>
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
                        <span style={{ color: C.textMuted }}> — calls pending</span>
                      )}
                    </td>
                    <td style={td}>
                      {a.reviewer_flags.length > 0 ? (
                        <FlagBadge count={a.reviewer_flags.length} />
                      ) : (
                        <span style={{ color: C.textMuted }}>none</span>
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
