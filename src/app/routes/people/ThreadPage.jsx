/* ════════════════════════════════════════════════
   The DM thread with one person — reuses the community DM tables
   through open_dm_with() (0019). Circle pairs land here already
   accepted; a non-circle pair sees the request-pending note until the
   other side says yes (and the database refuses sends until then).

   Stickers are ordinary messages whose body is one warm emoji from a
   fixed set, rendered large — nothing new at the database, so every
   0014 rule (blocks, freeze triggers, participants-only) applies to
   them unchanged.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { BodyText, GhostBtn, PrimaryBtn } from "../circle/ui.jsx";
import {
  STICKERS,
  isStickerBody,
  fetchPerson,
  openDmWith,
  fetchDmRequest,
  fetchMessages,
  sendDm,
  markThreadRead,
} from "./peopleStore.js";

const POLL_MS = 5000;

function Bubble({ msg, mine, ts }) {
  const sticker = isStickerBody(msg.body);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          padding: sticker ? "6px 10px" : "10px 16px",
          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: sticker ? "transparent" : mine ? C.green : C.white,
          border: sticker ? "none" : mine ? "none" : `1.5px solid ${C.warmGray}`,
          color: mine ? C.cream : C.textMain,
          fontSize: sticker ? ts(56) : ts(A11Y.minBodyPx),
          lineHeight: sticker ? 1.1 : 1.5,
          overflowWrap: "anywhere",
        }}
      >
        {msg.body}
      </div>
    </div>
  );
}

export default function ThreadPage() {
  const { profileId } = useParams();
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [person, setPerson] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [status, setStatus] = useState(null); // dm_requests.status
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const reqRef = useRef(null);

  const refresh = async (reqId) => {
    const [req, msgs] = await Promise.all([fetchDmRequest(reqId), fetchMessages(reqId)]);
    setStatus(req?.status ?? null);
    setMessages(msgs);
    if (myId && msgs.some((m) => m.sender_id !== myId && !m.read_at)) {
      markThreadRead(reqId, myId).catch(() => {});
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer;
    (async () => {
      try {
        const [p, reqId] = await Promise.all([fetchPerson(profileId), openDmWith(profileId)]);
        if (cancelled) return;
        setPerson(p);
        setRequestId(reqId);
        reqRef.current = reqId;
        await refresh(reqId);
        timer = setInterval(() => {
          if (reqRef.current) refresh(reqRef.current).catch(() => {});
        }, POLL_MS);
      } catch (err) {
        if (!cancelled) setError(err.message || "people.thread.sendError");
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, myId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  const send = async (body) => {
    const text = body.trim();
    if (!text || !requestId) return;
    setError("");
    try {
      await sendDm(requestId, text);
      setDraft("");
      setPickerOpen(false);
      await refresh(requestId);
    } catch {
      setError("people.thread.sendError");
    }
  };

  const first = person?.full_name?.split(" ")[0] || "";
  const open = status === "accepted";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "70vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(26),
            fontWeight: 700,
            color: C.green,
            margin: 0,
            flex: 1,
          }}
        >
          💬 {person?.full_name || "…"}
        </h1>
        <Link
          to=".."
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 16px",
            color: C.brown,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("people.thread.backToProfile", { name: first })}
        </Link>
      </div>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {/* The conversation */}
      <div
        aria-live="polite"
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.55)",
          border: `1.5px solid ${C.warmGray}`,
          borderRadius: 18,
          padding: "16px 14px",
          marginBottom: 12,
          overflowY: "auto",
          maxHeight: "52vh",
        }}
      >
        {messages === null ? (
          <BodyText muted role="status">···</BodyText>
        ) : messages.length === 0 ? (
          <BodyText muted>{open ? t("people.thread.empty") : ""}</BodyText>
        ) : (
          messages.map((m) => <Bubble key={m.id} msg={m} mine={m.sender_id === myId} ts={ts} />)
        )}
        {status && !open && (
          <BodyText muted>{t("people.thread.pendingNote", { name: first })}</BodyText>
        )}
        <div ref={endRef} />
      </div>

      {/* Sticker picker */}
      {pickerOpen && (
        <div
          role="group"
          aria-label={t("people.thread.stickersLabel")}
          style={{
            background: C.white,
            border: `1.5px solid ${C.warmGray}`,
            borderRadius: 18,
            padding: 10,
            marginBottom: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(56px, 1fr))",
            gap: 6,
          }}
        >
          {STICKERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              aria-label={`${t("people.thread.stickersLabel")}: ${s}`}
              style={{
                minHeight: 56,
                minWidth: A11Y.minTapTargetPx,
                fontSize: 34,
                background: "transparent",
                border: `1.5px solid transparent`,
                borderRadius: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}
      >
        <GhostBtn
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          aria-label={t("people.thread.stickersCta")}
          disabled={!open}
          style={{ padding: "0 14px", fontSize: ts(24) }}
        >
          😊
        </GhostBtn>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("people.thread.placeholder")}
          aria-label={t("people.thread.placeholder")}
          disabled={!open}
          style={{
            flex: "1 1 180px",
            minHeight: 56,
            padding: "0 16px",
            borderRadius: 50,
            border: `1.5px solid ${C.warmGray}`,
            background: C.white,
            fontSize: ts(A11Y.minBodyPx),
            fontFamily: "inherit",
            color: C.textMain,
          }}
        />
        <PrimaryBtn type="submit" disabled={!open || !draft.trim()}>
          {t("people.thread.sendCta")}
        </PrimaryBtn>
      </form>
    </div>
  );
}
