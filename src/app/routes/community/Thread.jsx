/* ════════════════════════════════════════════════
   One DM thread — /app/community/messages/:requestId.

   Participants only, at the database level. A message from the other
   side that mentions money renders under a warning banner to the
   RECIPIENT (SPEC.md) — advisory, client-side, nothing blocked —
   with a one-tap report that snapshots the message text so admins
   can act without ever reading the thread (QUESTIONS.md C5).
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { MONEY_PATTERN } from "./communityCopy.js";
import {
  fetchThread,
  fetchAuthors,
  sendMessage,
  markThreadRead,
  fileReport,
} from "./communityData.js";
import { CommunityScreen, BodyText, PrimaryBtn, GhostBtn, Toast } from "./ui.jsx";
/* The DM game embed (ask A4, migration 0027): a message may carry a
   game_session_id and the thread renders the board inline, the
   conversation carrying on beneath. Carrom is the first (and so far
   only) game that starts from a thread — its controller and strings
   are the carrom lane's. */
import CarromRailsController from "../games/carrom/CarromRailsController.jsx";
import { startCarromInThread } from "../games/carrom/rails.js";
import { STRINGS as CARROM } from "../games/carrom/carromCopy.js";

export default function Thread() {
  const { requestId } = useParams();
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;
  const carrom = CARROM[lang] || CARROM.en;
  const [starting, setStarting] = useState(false);

  const [request, setRequest] = useState(undefined); // undefined loading, null missing
  const [messages, setMessages] = useState([]);
  const [people, setPeople] = useState({});
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const endRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { request: req, messages: msgs } = await fetchThread(requestId);
      setRequest(req || null);
      setMessages(msgs);
      if (req) {
        setPeople(await fetchAuthors([req.requester_id, req.recipient_id]));
        markThreadRead(requestId, myId);
      }
    } catch {
      setError(t("community.dm.loadError"));
      setRequest(null);
    }
  }, [requestId, myId]);

  useEffect(() => {
    if (myId) load();
  }, [myId, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (request === null) return <Navigate to="/app/community/messages" replace />;

  const otherId =
    request && (request.requester_id === myId ? request.recipient_id : request.requester_id);
  const otherName = people[otherId]?.full_name || "…";

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError("");
    try {
      await sendMessage(requestId, myId, body);
      setBody("");
      await load();
    } catch {
      setError(t("community.dm.sendError"));
    }
  };

  /* "Play carrom": create the session + invite the other person
     (their bell gets the rails invitation with a deep link), then
     drop the board into the thread as a game-attachment message. */
  const playCarrom = async () => {
    if (!otherId || starting) return;
    setStarting(true);
    setError("");
    try {
      const sessionId = await startCarromInThread(otherId);
      await sendMessage(requestId, myId, null, sessionId);
      await load();
    } catch {
      setError(t("community.dm.gameStartFailed"));
    }
    setStarting(false);
  };

  const reportMessage = async (m) => {
    try {
      await fileReport(myId, "dm_message", m.id, m.sender_id, m.body, null);
      setToast(t("community.feed.reportedToast"));
      window.setTimeout(() => setToast(""), 5000);
    } catch {
      setError(t("community.dm.loadError"));
    }
  };

  return (
    <CommunityScreen backTo="/app/community/messages" backLabel={t("community.dm.title")} width={560}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          margin: "0 0 16px",
        }}
      >
        <h1
          style={{
            fontSize: ts(24),
            fontWeight: 700,
            color: C.green,
            margin: 0,
            flex: 1,
          }}
        >
          {otherName}
        </h1>
        {request && (
          <GhostBtn disabled={starting} onClick={playCarrom}>
            🎯 {carrom.playCarromCta}
          </GhostBtn>
        )}
      </div>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {error}
        </BodyText>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {request === undefined ? (
          <BodyText muted role="status">…</BodyText>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myId;
            const moneyFlag = !mine && m.body && MONEY_PATTERN.test(m.body);

            /* A game attachment renders the live board inline — full
               width, the conversation continuing beneath. */
            if (m.game_session_id) {
              return (
                <div key={m.id} style={{ alignSelf: "stretch" }}>
                  <CarromRailsController sessionId={m.game_session_id} />
                  <BodyText muted style={{ margin: "8px 0 0", fontSize: ts(16) }}>
                    {carrom.startedInChat}{" "}
                    <Link
                      to={`/app/games/s/${m.game_session_id}`}
                      style={{ color: C.green, fontWeight: 600 }}
                    >
                      {t("community.dm.gameOpenBoard")}
                    </Link>
                  </BodyText>
                  {m.body && (
                    <BodyText style={{ margin: "6px 0 0" }}>{m.body}</BodyText>
                  )}
                </div>
              );
            }
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                {moneyFlag && (
                  <div
                    role="alert"
                    style={{
                      background: "#f3e9df",
                      border: `2px solid ${C.brown}`,
                      borderRadius: 14,
                      padding: "10px 14px",
                      marginBottom: 6,
                      // Safety banner: never below the 18px floor
                      // (QUALITY_REPORT §3 must-fix).
                      fontSize: ts(18),
                      lineHeight: 1.5,
                      color: C.brown,
                      fontWeight: 600,
                    }}
                  >
                    ⚠ {t("community.dm.moneyWarning")}
                  </div>
                )}
                <div
                  style={{
                    background: mine ? C.green : C.white,
                    color: mine ? C.cream : C.textMain,
                    border: mine ? "none" : `1.5px solid ${C.warmGray}`,
                    borderRadius: 16,
                    padding: "10px 16px",
                    fontSize: ts(A11Y.minBodyPx),
                    lineHeight: 1.5,
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.body}
                </div>
                {/* Report is a safety affordance: full 48px target,
                    full 18px text (QUALITY_REPORT §3 must-fix). */}
                {!mine && (
                  <button
                    type="button"
                    onClick={() => reportMessage(m)}
                    style={{
                      minHeight: A11Y.minTapTargetPx,
                      background: "none",
                      border: "none",
                      color: C.textMuted,
                      fontSize: ts(18),
                      fontFamily: "inherit",
                      textDecoration: "underline",
                      cursor: "pointer",
                      padding: "2px 8px",
                    }}
                  >
                    {t("community.dm.reportMessage")}
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 10 }}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("community.dm.threadPlaceholder")}
          maxLength={2000}
          style={{ flex: 1 }}
        />
        <PrimaryBtn type="submit" onClick={send} disabled={!body.trim()}>
          {t("community.dm.threadSend")}
        </PrimaryBtn>
      </form>

      <Toast text={toast} />
    </CommunityScreen>
  );
}
