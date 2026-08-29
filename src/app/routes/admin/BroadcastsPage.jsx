/* ════════════════════════════════════════════════
   /app/admin/broadcasts — compose and send a broadcast.

   One notification to every active account (not blocked, not paused),
   optionally narrowed to a single role. Sending goes through the
   admin_broadcast RPC (migration 0010): the server filters recipients,
   writes every notification row, and audit-logs the send with the
   recipient count — the client only composes.

   The reason field is the audit reason, not part of the message; the
   RPC refuses to send without one.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C, FONTS, A11Y } from "../../../shared/tokens.js";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { sendBroadcast } from "./api.js";
import { Card, AdminBtn } from "./ui.jsx";

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

const AUDIENCES = [
  { value: "", label: "Everyone (all active accounts)" },
  ...Object.entries(ROLE_DISPLAY).map(([value, label]) => ({
    value,
    label: `${label} accounts only`,
  })),
];

export default function BroadcastsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null); // { title, count, audience }

  const canSend = title.trim().length >= 2 && reason.trim().length >= 5 && !busy;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const count = await sendBroadcast({
        title: title.trim(),
        body: body.trim() || null,
        reason: reason.trim(),
        role: role || null,
      });
      setSent({
        title: title.trim(),
        count,
        audience: AUDIENCES.find((a) => a.value === role)?.label,
      });
      setTitle("");
      setBody("");
      setReason("");
      setRole("");
    } catch (e) {
      setError(e.message || "The broadcast didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1
        style={{
          fontFamily: FONTS.serif,
          fontSize: 32,
          fontWeight: 700,
          color: C.green,
          margin: "0 0 6px",
        }}
      >
        Broadcasts
      </h1>
      <p style={{ color: C.textMuted, margin: "0 0 24px" }}>
        An in-app notification to every active account, or one role. Every send
        is audit-logged with its recipient count.
      </p>

      {sent && (
        <p
          role="status"
          style={{
            border: `2px solid ${C.sage}`,
            borderRadius: 10,
            padding: "12px 16px",
            color: C.green,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          ✓ “{sent.title}” delivered to {sent.count}{" "}
          {sent.count === 1 ? "account" : "accounts"} — {sent.audience}
        </p>
      )}
      {error && (
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
          {error}
        </p>
      )}

      <Card title="Compose">
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 600 }}>
            Audience
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ ...inputStyle, minHeight: A11Y.minTapTargetPx, fontWeight: 400 }}
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 600 }}>
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What the notification says"
              style={{ ...inputStyle, fontWeight: 400 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 600 }}>
            Message (optional)
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The longer text shown when the notification is opened"
              style={{ ...inputStyle, fontWeight: 400, resize: "vertical" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 16, fontWeight: 600 }}>
            Reason (for the audit log — not shown to recipients)
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this broadcast is going out"
              style={{ ...inputStyle, fontWeight: 400 }}
            />
          </label>

          <div>
            <AdminBtn kind="primary" disabled={!canSend} onClick={send}>
              Send broadcast
            </AdminBtn>
          </div>
        </div>
      </Card>
    </div>
  );
}
