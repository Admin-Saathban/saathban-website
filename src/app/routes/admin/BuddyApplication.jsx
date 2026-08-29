/* ════════════════════════════════════════════════
   /app/admin/buddies/:id — one application, in full.

   Layout follows the reviewer's actual reading order from SPEC.md:
   motivation FIRST ("the field the reviewer reads first"), then
   identity, profile, experience, declarations, references (with the
   call actually recorded — the call is the safeguard, not the
   collection), the red-flag checklist, document requests, prior
   attempts by the same applicant, and the audit trail.

   Decisions live in one place on the right: advance along the
   pipeline, or the deliberate exits (suspend / reject). Rejection
   requires a typed reason — it becomes the audit entry and drives the
   90-day reapply cooldown server-side.

   Mock data only; every action goes through the AdminLayout store.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import {
  PIPELINE,
  NEXT_STATUS,
  STATUS_LABELS,
  RED_FLAGS,
  DOCUMENT_TYPES,
} from "./data.js";
import {
  Card,
  Field,
  AdminBtn,
  StatusChip,
  FlagBadge,
  PipelineStepper,
  fmtDate,
  fmtDateTime,
  ageFromDob,
} from "./ui.jsx";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: FONTS.sans,
  fontSize: 17,
  color: C.textMain,
  background: C.cream,
  border: `1px solid ${C.warmGray}`,
  borderRadius: 10,
  padding: "12px 14px",
};

export default function BuddyApplication() {
  const { id } = useParams();
  const { applications, actions } = useOutletContext();

  const app = applications.find((a) => a.id === id);
  const [rejectNote, setRejectNote] = useState("");
  const [notesDraft, setNotesDraft] = useState(null); // null = not editing
  const [callDraft, setCallDraft] = useState({}); // refId -> notes text
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [docNote, setDocNote] = useState("");

  if (!app) {
    return (
      <div>
        <p>No application with id “{id}”.</p>
        <Link to=".." style={{ color: C.green }}>
          ← Back to the queue
        </Link>
      </div>
    );
  }

  const priorAttempts = applications
    .filter((a) => a.applicant_id === app.applicant_id && a.id !== app.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const next = NEXT_STATUS[app.status];
  const callsDone = app.references.filter((r) => r.called_at).length;
  const advanceBlockedByCalls = next === "probation" && callsDone < 2;

  return (
    <div style={{ maxWidth: 1180 }}>
      {/* ─── Header ─── */}
      <Link
        to=".."
        style={{
          color: C.green,
          fontSize: 16,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        ← Buddy review queue
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
          margin: "10px 0 8px",
        }}
      >
        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: 32,
            fontWeight: 700,
            color: C.green,
            margin: 0,
          }}
        >
          {app.legal_name}
        </h1>
        <StatusChip status={app.status} />
        {app.reviewer_flags.length > 0 && (
          <FlagBadge count={app.reviewer_flags.length} />
        )}
        {priorAttempts.length > 0 && (
          <span
            style={{
              padding: "3px 12px",
              borderRadius: 50,
              border: `2px solid ${C.brown}`,
              color: C.brown,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Attempt {priorAttempts.length + 1}
          </span>
        )}
      </div>
      <p style={{ color: C.textMuted, margin: "0 0 18px" }}>
        Applied {fmtDate(app.created_at)} · {app.city} · speaks{" "}
        {app.languages.join(", ")}
      </p>

      <div style={{ marginBottom: 26 }}>
        <PipelineStepper status={app.status} pipeline={PIPELINE} />
      </div>

      {/* ─── Two-column body ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          gap: 22,
          alignItems: "start",
        }}
      >
        {/* ══ Left: the application, in reading order ══ */}
        <div style={{ display: "grid", gap: 22 }}>
          <Card title="Motivation">
            <p
              style={{
                fontFamily: FONTS.serif,
                fontSize: 20,
                lineHeight: 1.7,
                margin: 0,
                color: C.textMain,
              }}
            >
              “{app.motivation}”
            </p>
          </Card>

          <Card title="Identity">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px 24px",
              }}
            >
              <Field label="Legal name (as on CNIC)">{app.legal_name}</Field>
              <Field label="CNIC number">{app.cnic_number}</Field>
              <Field label="Date of birth">
                {fmtDate(app.dob)} · age {ageFromDob(app.dob)}
              </Field>
              <Field label="Phone">{app.phone}</Field>
              {/* Sensitive documents live in the PRIVATE buddy-documents
                  bucket. These placeholders will become signed-URL image
                  views; nothing here may ever be a public URL. */}
              <Field label="CNIC photo">
                <DocPlaceholder path={app.cnic_photo_path} />
              </Field>
              <Field label="Selfie at signup">
                <DocPlaceholder path={app.selfie_path} />
              </Field>
            </div>
          </Card>

          <Card title="Profile & availability">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px 24px",
              }}
            >
              <Field label="Occupation / institution">{app.occupation}</Field>
              <Field label="City">{app.city}</Field>
              <Field label="Reachable areas">{app.reachable_areas}</Field>
              <Field label="Languages spoken — key matching field">
                <strong>{app.languages.join(", ")}</strong>
              </Field>
              <Field label="Weekly hours offered">{app.weekly_hours}</Field>
              <Field label="Commitment">
                {app.commitment_months} months
              </Field>
              <Field label="Experience with seniors or caregiving" wide>
                {app.experience}
              </Field>
            </div>
          </Card>

          <Card title="Declarations">
            <ul style={{ margin: 0, paddingLeft: 22, lineHeight: 2 }}>
              <li>
                Criminal record disclosed:{" "}
                <strong>
                  {app.declared_criminal_record ? "Yes" : "None declared"}
                </strong>
                {app.criminal_record_details && (
                  <> — {app.criminal_record_details}</>
                )}
              </li>
              <li>
                Consented to police character certificate:{" "}
                <strong>{app.consented_character_certificate ? "Yes" : "No"}</strong>
              </li>
              <li>
                Accepted code of conduct:{" "}
                <strong>{app.accepted_code_of_conduct ? "Yes" : "No"}</strong>
              </li>
            </ul>
          </Card>

          <Card
            title="References"
            aside={
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: callsDone === 2 ? C.green : C.brown,
                }}
              >
                {callsDone} of 2 called
              </span>
            }
          >
            <p style={{ margin: "0 0 16px", color: C.textMuted, fontSize: 16 }}>
              Two non-family references, actually phoned. The collection is not
              the safeguard — the call is.
            </p>
            <div style={{ display: "grid", gap: 14 }}>
              {app.references.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: `1px solid ${C.warmGray}`,
                    borderRadius: 10,
                    padding: "14px 18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{r.name}</strong>{" "}
                      <span style={{ color: C.textMuted }}>
                        — {r.relationship} · {r.phone}
                      </span>
                    </div>
                    {r.called_at ? (
                      <span style={{ color: C.green, fontWeight: 700 }}>
                        ✓ Called {fmtDateTime(r.called_at)}
                      </span>
                    ) : (
                      <span style={{ color: C.brown, fontWeight: 700 }}>
                        Not yet called
                      </span>
                    )}
                  </div>
                  {r.call_notes && (
                    <p style={{ margin: "10px 0 0", color: C.textMain }}>
                      {r.call_notes}
                    </p>
                  )}
                  {!r.called_at && (
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      <textarea
                        rows={2}
                        placeholder="What did the reference say?"
                        value={callDraft[r.id] || ""}
                        onChange={(e) =>
                          setCallDraft((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                        style={inputStyle}
                      />
                      <div>
                        <AdminBtn
                          kind="outline"
                          onClick={() =>
                            actions.recordReferenceCall(
                              app.id,
                              r.id,
                              (callDraft[r.id] || "").trim()
                            )
                          }
                        >
                          Record the call
                        </AdminBtn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* ─── Prior attempts (versioned applications) ─── */}
          <Card title="Prior attempts">
            {priorAttempts.length === 0 ? (
              <p style={{ margin: 0, color: C.textMuted }}>
                First application from this applicant.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {priorAttempts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: `1px solid ${C.warmGray}`,
                      borderLeft: `4px solid ${C.brown}`,
                      borderRadius: 10,
                      padding: "14px 18px",
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
                      <StatusChip status={p.status} />
                      <span style={{ color: C.textMuted, fontSize: 16 }}>
                        Applied {fmtDate(p.created_at)}
                        {p.decided_at && <> · decided {fmtDate(p.decided_at)}</>}
                      </span>
                      {p.reviewer_flags.map((f) => (
                        <FlagBadge
                          key={f}
                          label={
                            RED_FLAGS.find((rf) => rf.key === f)?.label || f
                          }
                        />
                      ))}
                    </div>
                    {p.review_notes && (
                      <p style={{ margin: 0 }}>{p.review_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ─── Audit trail (mirrors the DB status-change trigger) ─── */}
          <Card title="Audit trail">
            {app.audit.length === 0 ? (
              <p style={{ margin: 0, color: C.textMuted }}>
                No status changes recorded yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {app.audit.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "baseline",
                      flexWrap: "wrap",
                      fontSize: 16,
                    }}
                  >
                    <span style={{ color: C.textMuted, whiteSpace: "nowrap" }}>
                      {fmtDateTime(e.at)}
                    </span>
                    <span>
                      <strong>{e.actor}</strong> moved{" "}
                      {STATUS_LABELS[e.from] || e.from} →{" "}
                      <strong>{STATUS_LABELS[e.to] || e.to}</strong>
                      {e.note && (
                        <span style={{ color: C.textMuted }}> — {e.note}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ══ Right: review actions ══ */}
        <div style={{ display: "grid", gap: 22 }}>
          <Card title="Decision">
            <div style={{ display: "grid", gap: 12 }}>
              {next && (
                <AdminBtn
                  kind="primary"
                  disabled={advanceBlockedByCalls}
                  title={
                    advanceBlockedByCalls
                      ? "Both reference calls must be recorded before probation"
                      : undefined
                  }
                  onClick={() => actions.setStatus(app.id, next)}
                >
                  Move to {STATUS_LABELS[next]}
                </AdminBtn>
              )}
              {advanceBlockedByCalls && (
                <p style={{ margin: 0, fontSize: 15, color: C.brown }}>
                  Both reference calls must be recorded before this application
                  can move to probation.
                </p>
              )}
              {app.status === "active" && (
                <AdminBtn
                  kind="danger"
                  onClick={() =>
                    actions.setStatus(
                      app.id,
                      "suspended",
                      rejectNote.trim() || "Suspended from admin review."
                    )
                  }
                >
                  Suspend
                </AdminBtn>
              )}
              {app.status === "suspended" && (
                <AdminBtn
                  kind="primary"
                  onClick={() =>
                    actions.setStatus(
                      app.id,
                      "active",
                      rejectNote.trim() || "Reinstated after review."
                    )
                  }
                >
                  Reinstate as Active
                </AdminBtn>
              )}
              {app.status !== "rejected" && app.status !== "active" && (
                <>
                  <textarea
                    rows={3}
                    placeholder="Reason (required to reject — it becomes the audit entry)"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    style={inputStyle}
                  />
                  <AdminBtn
                    kind="danger"
                    disabled={!rejectNote.trim()}
                    onClick={() => {
                      actions.setStatus(app.id, "rejected", rejectNote.trim());
                      setRejectNote("");
                    }}
                  >
                    Reject
                  </AdminBtn>
                  <p style={{ margin: 0, fontSize: 15, color: C.textMuted }}>
                    A rejected applicant can reapply after 90 days. Permanent
                    bars are a separate account block, not a rejection.
                  </p>
                </>
              )}
            </div>
          </Card>

          {/* ─── Red-flag checklist (SPEC.md, verbatim list) ─── */}
          <Card title="Reviewer red flags">
            <div style={{ display: "grid", gap: 4 }}>
              {RED_FLAGS.map((f) => {
                const on = app.reviewer_flags.includes(f.key);
                return (
                  <label
                    key={f.key}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      minHeight: A11Y.minTapTargetPx,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: on ? C.cream : "transparent",
                      cursor: "pointer",
                      fontSize: 17,
                      lineHeight: 1.45,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => actions.toggleFlag(app.id, f.key)}
                      style={{ width: 22, height: 22, marginTop: 2, accentColor: C.brown }}
                    />
                    <span style={{ fontWeight: on ? 700 : 400 }}>
                      {on && "⚑ "}
                      {f.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </Card>

          {/* ─── Document requests ─── */}
          <Card title="Documents">
            {app.document_requests.length > 0 && (
              <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                {app.document_requests.map((d) => (
                  <div key={d.id} style={{ fontSize: 16 }}>
                    <strong>{d.type}</strong>{" "}
                    <span
                      style={{
                        color: d.status === "received" ? C.green : C.brown,
                        fontWeight: 700,
                      }}
                    >
                      · {d.status === "received" ? "received" : "awaiting"}
                    </span>
                    <div style={{ color: C.textMuted, fontSize: 15 }}>
                      Requested {fmtDate(d.requested_at)}
                      {d.note && <> — {d.note}</>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={{ ...inputStyle, minHeight: A11Y.minTapTargetPx }}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Note to the applicant (optional)"
                value={docNote}
                onChange={(e) => setDocNote(e.target.value)}
                style={inputStyle}
              />
              <AdminBtn
                kind="outline"
                onClick={() => {
                  actions.requestDocument(app.id, docType, docNote.trim());
                  setDocNote("");
                }}
              >
                Request document
              </AdminBtn>
            </div>
          </Card>

          {/* ─── Review notes ─── */}
          <Card title="Review notes">
            {notesDraft === null ? (
              <>
                <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                  {app.review_notes || (
                    <span style={{ color: C.textMuted }}>No notes yet.</span>
                  )}
                </p>
                <AdminBtn
                  kind="ghost"
                  onClick={() => setNotesDraft(app.review_notes || "")}
                >
                  Edit notes
                </AdminBtn>
              </>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <textarea
                  rows={5}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <AdminBtn
                    kind="primary"
                    onClick={() => {
                      actions.saveReviewNotes(app.id, notesDraft.trim());
                      setNotesDraft(null);
                    }}
                  >
                    Save
                  </AdminBtn>
                  <AdminBtn kind="ghost" onClick={() => setNotesDraft(null)}>
                    Cancel
                  </AdminBtn>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* Placeholder for images in the private buddy-documents bucket. When
   Supabase lands, this becomes a signed-URL <img> fetched on demand —
   and the fetch is the moment app-level audit logging fires. */
function DocPlaceholder({ path }) {
  return (
    <div
      style={{
        border: `1px dashed ${C.warmGray}`,
        borderRadius: 10,
        background: C.cream,
        padding: "18px 14px",
        fontSize: 15,
        color: C.textMuted,
        lineHeight: 1.5,
      }}
    >
      🔒 Private bucket
      <div style={{ wordBreak: "break-all" }}>{path}</div>
    </div>
  );
}
