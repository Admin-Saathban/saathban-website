/* ════════════════════════════════════════════════
   Proposals — the admin review section inside events → Manage
   (migration 0019). Lists pending "Suggest a gathering" submissions,
   each with the proposer's name, the place, the day, and their note.

   Approve → the approve RPC publishes a credited event ("Suggested by
   Iqbal") and notifies the proposer. Decline → a required, kind
   message goes to the proposer as a notification. Both are admin-only
   at the database; this section renders inside the admin-gated Manage
   tab and mirrors what the RPCs enforce.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Card, SectionLabel, Pill, PrimaryBtn, GhostBtn, BodyText, inputStyle } from "./ui.jsx";
import {
  adminFetchPendingProposals,
  approveProposal,
  declineProposal,
  firstName,
} from "./proposalsStore.js";
import { STRINGS } from "./proposalsCopy.js";

function fmtDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return ` · ${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/* onReviewed refreshes the parent's events list (an approval adds an
   event); the section shows its own confirmation notice inline. */
export default function AdminProposals({ onReviewed }) {
  const { lang, ts } = useI18n();
  const s = (STRINGS[lang] || STRINGS.en).admin;

  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [declining, setDeclining] = useState(null); // proposal id being declined
  const [message, setMessage] = useState("");

  const load = () =>
    adminFetchPendingProposals()
      .then(setRows)
      .catch(() => { setRows([]); setError(s.loadError); });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const afterReview = async () => {
    await load();
    onReviewed?.();
  };

  const approve = async (p) => {
    setBusyId(p.id);
    setError("");
    try {
      await approveProposal(p.id);
      setNotice(s.approvedToast(firstName(p.proposerName)));
      await afterReview();
    } catch {
      setError(s.actionError);
    } finally {
      setBusyId(null);
    }
  };

  const sendDecline = async (p) => {
    if (!message.trim()) { setError(s.needMessage); return; }
    setBusyId(p.id);
    setError("");
    try {
      await declineProposal(p.id, message.trim());
      setNotice(s.declinedToast(firstName(p.proposerName)));
      setDeclining(null);
      setMessage("");
      await afterReview();
    } catch {
      setError(s.actionError);
    } finally {
      setBusyId(null);
    }
  };

  // Nothing to show while the queue is empty — keep Manage uncluttered,
  // unless a just-completed review left a confirmation to display.
  if (rows !== null && rows.length === 0 && !error && !notice) return null;

  return (
    <section>
      <SectionLabel>{s.heading}</SectionLabel>

      {notice && (
        <BodyText role="status" style={{ fontWeight: 600, color: C.green }}>✓ {notice}</BodyText>
      )}
      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>⚠ {error}</BodyText>
      )}
      {rows !== null && rows.length === 0 && !error && (
        <BodyText muted>{s.empty}</BodyText>
      )}

      {rows === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : (
        rows.map((p) => (
          <Card key={p.id} style={{ borderInlineStart: `4px solid ${C.olive}` }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
              <BodyText style={{ fontWeight: 700, margin: 0, flex: "1 1 200px", fontSize: ts(20) }}>
                {p.title}
              </BodyText>
              <Pill tone="brown">{s.suggestedBy(p.proposerName)}</Pill>
            </div>

            <BodyText muted style={{ margin: "8px 0 6px", fontSize: ts(18) }}>
              📅 {fmtDate(p.event_date)}{fmtTime(p.start_time)}
              {p.placeLabel ? ` · 📍 ${p.placeLabel}` : ""}
            </BodyText>

            {p.note && (
              <BodyText style={{ margin: "8px 0 0" }}>
                <span style={{ fontWeight: 600 }}>{s.noteLabel}:</span> {p.note}
              </BodyText>
            )}

            {declining === p.id ? (
              <div style={{ marginTop: 14 }}>
                <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600 }}>
                  {s.declinePromptLabel(firstName(p.proposerName))}
                  <textarea
                    autoFocus
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={s.declinePromptPh}
                    style={{ ...inputStyle(ts), resize: "vertical" }}
                  />
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <PrimaryBtn onClick={() => sendDecline(p)} disabled={busyId === p.id}>
                    {busyId === p.id ? s.declining : s.declineSend}
                  </PrimaryBtn>
                  <GhostBtn onClick={() => { setDeclining(null); setMessage(""); setError(""); }}>
                    {s.cancel}
                  </GhostBtn>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <PrimaryBtn onClick={() => approve(p)} disabled={busyId === p.id}>
                  {busyId === p.id ? s.approving : `✓ ${s.approveCta}`}
                </PrimaryBtn>
                <GhostBtn onClick={() => { setDeclining(p.id); setMessage(""); setError(""); }} disabled={busyId === p.id}>
                  {s.declineCta}
                </GhostBtn>
              </div>
            )}
          </Card>
        ))
      )}
    </section>
  );
}
