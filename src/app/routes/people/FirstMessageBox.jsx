/* ════════════════════════════════════════════════
   The one message you get to send to someone you haven't met.

   PRODUCT_DECISIONS §6: a first message from an unconnected person
   waits as a request, and the guard is "ONE SHOT ONLY — no follow-ups
   before acceptance".

   Before 0073 there was nowhere to write it: dm_messages is shut until
   the request is accepted, so a person who tapped Message on a stranger
   arrived at a thread with a composer that could not send. The request
   went out carrying nothing, and the recipient was asked to judge a
   name with no sentence attached.

   This is the other half of that fix, on the sender's side. It appears
   only for the person who made the request, only while it is pending,
   and only while their one message is unsent — after that the thread's
   own "waiting for {name}" line says everything true, and adding a
   second box would invite exactly the follow-up §6 forbids.

   It says the rule BEFORE the typing rather than after it. A person
   who writes three paragraphs and is then told they had one shot has
   been tricked by the interface, even though nothing was lost.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";
import { setDmFirstMessage } from "../community/communityData.js";

export default function FirstMessageBox({ requestId, name }) {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [show, setShow] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!requestId || !myId) return undefined;
    let dead = false;
    (async () => {
      const { data } = await supabase
        .from("dm_requests")
        .select("requester_id, status, first_message")
        .eq("id", requestId)
        .maybeSingle();
      if (dead || !data) return;
      setShow(
        data.requester_id === myId &&
          data.status === "pending" &&
          !data.first_message
      );
    })();
    return () => { dead = true; };
  }, [requestId, myId]);

  if (!show) return null;

  const send = async () => {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      await setDmFirstMessage(requestId, body);
      setSent(true);
    } catch (err) {
      setError(err.message || t("community.dm.requestsError"));
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <p
        role="status"
        style={{ color: C.green, fontWeight: 600, fontSize: ts(A11Y.minBodyPx), margin: "8px 0" }}
      >
        ✓ {t("community.dm.onceSent")}
      </p>
    );
  }

  return (
    <div
      style={{
        background: C.white,
        border: `2px solid ${C.warmGray}`,
        borderRadius: 16,
        padding: "14px 16px",
        margin: "8px 0 12px",
      }}
    >
      <p style={{ fontSize: ts(19), fontWeight: 700, color: C.textMain, margin: "0 0 4px" }}>
        {t("community.dm.onceTitle")}
      </p>
      {/* The rule, before the typing rather than after it. */}
      <p style={{ fontSize: ts(16), color: C.textMuted, margin: "0 0 10px" }}>
        {t("community.dm.onceHint", { name })}
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t("community.dm.oncePh")}
        aria-label={t("community.dm.onceTitle")}
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "inherit",
          fontSize: ts(A11Y.minBodyPx),
          color: C.textMain,
          background: C.cream,
          border: `2px solid ${C.warmGray}`,
          borderRadius: 12,
          padding: "10px 12px",
          resize: "vertical",
        }}
      />

      {error && (
        <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(16), margin: "8px 0 0" }}>
          ⚠ {error}
        </p>
      )}

      <button
        type="button"
        onClick={send}
        disabled={busy || !body.trim()}
        style={{
          marginTop: 10,
          minHeight: A11Y.minTapTargetPx,
          padding: "0 24px",
          borderRadius: 50,
          border: "none",
          background: C.green,
          color: C.cream,
          fontFamily: "inherit",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          opacity: busy || !body.trim() ? 0.6 : 1,
          cursor: busy || !body.trim() ? "default" : "pointer",
        }}
      >
        {t("community.dm.onceSend")}
      </button>
    </div>
  );
}
