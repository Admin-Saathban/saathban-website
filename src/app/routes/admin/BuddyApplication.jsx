/* ════════════════════════════════════════════════
   /app/admin/buddies/:id — one application, in full, on REAL data.

   Layout follows the reviewer's actual reading order from SPEC.md:
   motivation FIRST, then identity, profile, declarations, references
   (recording the call is a real UPDATE — the call is the safeguard),
   the red-flag checklist, document requests, prior attempts by the
   same applicant, and the audit trail.

   Writes go through the layout's actions (→ api.js → Supabase):
   - Advance / suspend / reject: UPDATE buddy_applications.status; the
     DB trigger writes the audit entry and stamps decided_at and
     reviewed_by. Rejection requires a typed reason — it becomes the
     audit reason and drives the 90-day reapply cooldown server-side.
   - Document requests: rpc admin_contact_icon — an audited in-app
     notification to the applicant (no documents table exists yet).

   Scoping: the audit trail is super-admin only (0003 RLS). Support
   admins get a scope notice — never an empty list pretending to be
   history.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useI18n } from "../../lib/i18n.jsx";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import {
  PIPELINE,
  NEXT_STATUS,
  statusLabel,
  RED_FLAG_KEYS,
  redFlagLabel,
  DOCUMENT_KEYS,
  documentLabel,
} from "./data.js";
import { fetchAuditTrail } from "./api.js";
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
import Icon from "../../components/Icon.jsx";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: A11Y.minTapTargetPx,
  fontFamily: APP_FONT,
  fontSize: 17,
  color: C.textMain,
  background: C.cream,
  border: `1px solid ${C.warmGray}`,
  borderRadius: 10,
  padding: "12px 14px",
};

export default function BuddyApplication() {
  const { t } = useI18n();
  const { id } = useParams();
  const { applications, loading, admin, actions } = useOutletContext();

  const app = applications.find((a) => a.id === id);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [notesDraft, setNotesDraft] = useState(null); // null = not editing
  const [callDraft, setCallDraft] = useState({}); // refId -> notes text
  const [docType, setDocType] = useState(""); // free text, suggestions via datalist
  const [docNote, setDocNote] = useState("");
  const [audit, setAudit] = useState(null); // null = not loaded

  const isSuper = admin.level === "super";

  // Audit trail: super-admin scope. Support never queries — RLS would
  // silently return [], which must not read as "no history".
  useEffect(() => {
    let alive = true;
    if (!isSuper || !app) return undefined;
    fetchAuditTrail(app.applicant_id)
      .then((rows) => alive && setAudit(rows))
      .catch(() => alive && setAudit(null));
    return () => {
      alive = false;
    };
  }, [isSuper, app?.applicant_id, app?.status]); // refetch after transitions

  if (!app) {
    return (
      <div>
        <p>{loading ? "Loading…" : `No application with id “${id}”.`}</p>
        <Link to=".." style={{ color: C.green }}>
          ← Back to the queue
        </Link>
      </div>
    );
  }

  const run = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setActionError(e.message || t("admin.app.saveFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const priorAttempts = applications
    .filter((a) => a.applicant_id === app.applicant_id && a.id !== app.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const refs = app.references || [];
  const next = NEXT_STATUS[app.status];
  const callsDone = refs.filter((r) => r.called_at).length;
  const advanceBlockedByCalls = next === "probation" && callsDone < 2;

  return (
    <div style={{ maxWidth: 1180 }}>
      {/* The body is two columns on a desk and one on a phone. Without
          this, minmax(0, 1fr) let the reading column shrink to a
          sliver behind the 360px sidebar — the page did not overflow,
          it just hid the application it exists to show. The reviewer
          confirming calls from a phone is the normal case, not the
          edge one. */}
      <style>{`
        @media (max-width: 900px) {
          .sb-buddy-body { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>

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
        {t("admin.app.backToQueue")}
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
            fontFamily: APP_FONT,
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
        {t("admin.app.appliedOn", { when: fmtDate(app.created_at), city: app.city })}{" "}
        {app.languages.join(", ")}
      </p>

      <div style={{ marginBottom: 26 }}>
        <PipelineStepper status={app.status} pipeline={PIPELINE} />
      </div>

      {actionError && (
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
          {actionError}
        </p>
      )}

      {/* ─── Two-column body ─── */}
      <div
        className="sb-buddy-body"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          gap: 22,
          alignItems: "start",
        }}
      >
        {/* ══ Left: the application, in reading order ══ */}
        <div style={{ display: "grid", gap: 22 }}>
          <Card title={t("admin.motivation")}>
            <p
              style={{
                fontFamily: APP_FONT,
                fontSize: 20,
                lineHeight: 1.7,
                margin: 0,
                color: C.textMain,
              }}
            >
              “{app.motivation}”
            </p>
          </Card>

          <Card title={t("admin.identity")}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px 24px",
              }}
            >
              <Field label={t("admin.app.legalName")}>{app.legal_name}</Field>
              <Field label={t("admin.app.cnicNumber")}>{app.cnic_number}</Field>
              <Field label={t("admin.app.dob")}>
                {t("admin.app.dobAge", { when: fmtDate(app.dob), age: ageFromDob(app.dob) })}
              </Field>
              <Field label={t("admin.app.phone")}>{app.phone}</Field>
              {/* Sensitive documents live in the PRIVATE buddy-documents
                  bucket. These placeholders become signed-URL image views
                  once uploads exist; the signed-URL fetch is where
                  app-level read logging will fire. Never a public URL. */}
              <Field label={t("admin.app.cnicPhoto")}>
                <DocPlaceholder path={app.cnic_photo_path} />
              </Field>
              <Field label={t("admin.app.selfie")}>
                <DocPlaceholder path={app.selfie_path} />
              </Field>
            </div>
          </Card>

          <Card title={t("admin.profileAvailability")}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px 24px",
              }}
            >
              <Field label={t("admin.app.occupation")}>{app.occupation}</Field>
              <Field label={t("admin.app.city")}>{app.city}</Field>
              <Field label={t("admin.app.areas")}>{app.reachable_areas}</Field>
              <Field label={t("admin.app.languages")}>
                <strong>{app.languages.join(", ")}</strong>
              </Field>
              <Field label={t("admin.app.hours")}>{app.weekly_hours}</Field>
              <Field label={t("admin.app.commitment")}>
                {t("admin.app.commitMonths", { n: app.commitment_months })}
              </Field>
              <Field label={t("admin.app.experience")} wide>
                {app.experience}
              </Field>
            </div>
          </Card>

          <Card title={t("admin.declarations")}>
            <ul style={{ margin: 0, paddingLeft: 22, lineHeight: 2 }}>
              <li>
                {t("admin.app.criminalRecord")}{" "}
                <strong>
                  {app.declared_criminal_record ? t("admin.app.yes") : t("admin.app.noneDeclared")}
                </strong>
                {app.criminal_record_details && (
                  <> — {app.criminal_record_details}</>
                )}
              </li>
              <li>
                {t("admin.app.consentedCert")}{" "}
                <strong>{app.consented_character_certificate ? t("admin.app.yes") : t("admin.app.no")}</strong>
              </li>
              <li>
                {t("admin.app.acceptedConduct")}{" "}
                <strong>{app.accepted_code_of_conduct ? t("admin.app.yes") : t("admin.app.no")}</strong>
              </li>
            </ul>
          </Card>

          <Card
            title={t("admin.references")}
            aside={
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: callsDone === 2 ? C.green : C.brown,
                }}
              >
                {t("admin.app.refsCalled", { done: callsDone, total: refs.length || 2 })}
              </span>
            }
          >
            <p style={{ margin: "0 0 16px", color: C.textMuted, fontSize: 16 }}>
              {t("admin.app.refsExplainer")}
            </p>
            <div style={{ display: "grid", gap: 14 }}>
              {refs.map((r) => (
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
                        {t("admin.app.calledOn", { when: fmtDateTime(r.called_at) })}
                      </span>
                    ) : (
                      <span style={{ color: C.brown, fontWeight: 700 }}>{t("admin.notCalled")}</span>
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
                        placeholder={t("admin.whatReferenceSaid")}
                        value={callDraft[r.id] || ""}
                        onChange={(e) =>
                          setCallDraft((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                        style={inputStyle}
                      />
                      <div>
                        <AdminBtn
                          kind="outline"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              actions.recordReferenceCall(
                                r.id,
                                (callDraft[r.id] || "").trim()
                              )
                            )
                          }
                        >{t("admin.recordCall")}</AdminBtn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* ─── Prior attempts (versioned applications) ─── */}
          <Card title={t("admin.priorAttempts")}>
            {priorAttempts.length === 0 ? (
              <p style={{ margin: 0, color: C.textMuted }}>{t("admin.firstApplication")}</p>
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
                        {t("admin.app.appliedShort", { when: fmtDate(p.created_at) })}
                        {p.decided_at && <> · decided {fmtDate(p.decided_at)}</>}
                      </span>
                      {p.reviewer_flags.map((f) => (
                        <FlagBadge
                          key={f}
                          label={
                            redFlagLabel(f, t)
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

          {/* ─── Audit trail: super-admin scope (0003) ─── */}
          <Card title={t("admin.auditTrail")}>
            {!isSuper ? (
              <p style={{ margin: 0, color: C.textMuted }}>
                {t("admin.app.auditScope")}
              </p>
            ) : audit === null ? (
              <p style={{ margin: 0, color: C.textMuted }}>{t("admin.app.loading")}</p>
            ) : audit.length === 0 ? (
              <p style={{ margin: 0, color: C.textMuted }}>{t("admin.noEntries")}</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {audit.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "baseline",
                      flexWrap: "wrap",
                      fontSize: 16,
                    }}
                  >
                    <span style={{ color: C.textMuted, whiteSpace: "nowrap" }}>
                      {fmtDateTime(e.created_at)}
                    </span>
                    <span>
                      <strong>{e.action}</strong>
                      {e.detail?.from && e.detail?.to && (
                        <>
                          {" "}
                          {statusLabel(e.detail.from, t)} →{" "}
                          <strong>{statusLabel(e.detail.to, t)}</strong>
                        </>
                      )}
                      {e.reason && (
                        <span style={{ color: C.textMuted }}> — {e.reason}</span>
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
          <Card title={t("admin.decision")}>
            <div style={{ display: "grid", gap: 12 }}>
              {next && (
                <AdminBtn
                  kind="primary"
                  disabled={busy || advanceBlockedByCalls}
                  title={
                    advanceBlockedByCalls
                      ? t("admin.app.bothRefs")
                      : undefined
                  }
                  onClick={() => run(() => actions.setStatus(app.id, next))}
                >
                  {t("admin.moveTo", { status: statusLabel(next, t) })}
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
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      actions.setStatus(
                        app.id,
                        "suspended",
                        rejectNote.trim() || t("admin.app.suspendNote")
                      )
                    )
                  }
                >{t("admin.suspend")}</AdminBtn>
              )}
              {app.status === "suspended" && (
                <AdminBtn
                  kind="primary"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      actions.setStatus(
                        app.id,
                        "active",
                        rejectNote.trim() || t("admin.app.reinstateNote")
                      )
                    )
                  }
                >{t("admin.reinstate")}</AdminBtn>
              )}
              {app.status !== "rejected" && app.status !== "active" && (
                <>
                  <textarea
                    rows={3}
                    placeholder={t("admin.rejectReason")}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    style={inputStyle}
                  />
                  <AdminBtn
                    kind="danger"
                    disabled={busy || !rejectNote.trim()}
                    onClick={async () => {
                      const ok = await run(() =>
                        actions.setStatus(app.id, "rejected", rejectNote.trim())
                      );
                      if (ok) setRejectNote("");
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
          <Card title={t("admin.redFlags")}>
            <div style={{ display: "grid", gap: 4 }}>
              {RED_FLAG_KEYS.map((key) => {
                const f = { key, label: redFlagLabel(key, t) };
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
                      disabled={busy}
                      onChange={() => run(() => actions.toggleFlag(app, f.key))}
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

          {/* ─── Document requests (buddy_document_requests, 0010) ─── */}
          <Card title={t("admin.documents")}>
            <p style={{ margin: "0 0 12px", fontSize: 15, color: C.textMuted }}>
              {t("admin.app.docExplainer")}
            </p>
            {(app.document_requests || [])
              .slice()
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((d) => (
                <div
                  key={d.id}
                  style={{
                    border: `1px solid ${C.warmGray}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>
                      <strong>{d.doc_type}</strong>{" "}
                      <span
                        style={{
                          color: d.status === "received" ? C.green : C.brown,
                          fontWeight: 700,
                        }}
                      >
                        {/* the stored enum is a key, not a word to show */}
                        · {d.response_path
                            ? t("admin.app.uploadedByApplicant")
                            : t(`admin.app.docStatus.${d.status}`) || d.status}
                      </span>
                    </span>
                    {d.status === "awaiting" && (
                      <AdminBtn
                        kind="ghost"
                        disabled={busy}
                        onClick={() => run(() => actions.markDocumentReceived(d.id))}
                      >{t("admin.markReceived")}</AdminBtn>
                    )}
                  </div>
                  <div style={{ color: C.textMuted, fontSize: 15 }}>
                    {t("admin.app.requestedOn", { when: fmtDate(d.created_at) })}
                    {d.note && <> — {d.note}</>}
                    {d.responded_at && (
                      <>
                        {" · "}{t("admin.app.responseOn", { when: fmtDate(d.responded_at) })}{" "}
                        <span style={{ wordBreak: "break-all" }}><Icon name="locked" size={15} style={{ verticalAlign: "-2px", marginInlineEnd: 4 }} />{d.response_path}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            <div style={{ display: "grid", gap: 10 }}>
              <input
                type="text"
                list="doc-type-suggestions"
                placeholder={t("admin.whichDocument")}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={inputStyle}
              />
              <datalist id="doc-type-suggestions">
                {/* value is what gets stored, so it is the KEY's
                    wording in the admin's own language — the list is a
                    suggestion, not an enum. */}
                {DOCUMENT_KEYS.map((k) => (
                  <option key={k} value={documentLabel(k, t)} />
                ))}
              </datalist>
              <input
                type="text"
                placeholder={t("admin.noteToApplicant")}
                value={docNote}
                onChange={(e) => setDocNote(e.target.value)}
                style={inputStyle}
              />
              <AdminBtn
                kind="outline"
                disabled={busy || docType.trim().length < 2}
                onClick={async () => {
                  const ok = await run(() =>
                    actions.requestDocument(app.id, docType.trim(), docNote.trim())
                  );
                  if (ok) {
                    setDocType("");
                    setDocNote("");
                  }
                }}
              >{t("admin.requestDocument")}</AdminBtn>
            </div>
          </Card>

          {/* ─── Review notes ─── */}
          <Card title={t("admin.reviewNotes")}>
            {notesDraft === null ? (
              <>
                <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                  {app.review_notes || (
                    <span style={{ color: C.textMuted }}>{t("admin.noNotes")}</span>
                  )}
                </p>
                <AdminBtn
                  kind="ghost"
                  disabled={busy}
                  onClick={() => setNotesDraft(app.review_notes || "")}
                >{t("admin.editNotes")}</AdminBtn>
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
                    disabled={busy}
                    onClick={async () => {
                      const ok = await run(() =>
                        actions.saveReviewNotes(app.id, notesDraft.trim())
                      );
                      if (ok) setNotesDraft(null);
                    }}
                  >
                    Save
                  </AdminBtn>
                  <AdminBtn kind="ghost" disabled={busy} onClick={() => setNotesDraft(null)}>
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
   uploads exist this becomes a signed-URL <img> fetched on demand —
   and the fetch is the moment app-level audit logging fires. */
function DocPlaceholder({ path }) {
  const { t } = useI18n();
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
      <Icon name="locked" size={15} style={{ verticalAlign: "-2px", marginInlineEnd: 4 }} />{t("admin.app.privateBucket")}
      <div style={{ wordBreak: "break-all" }}>{path}</div>
    </div>
  );
}
