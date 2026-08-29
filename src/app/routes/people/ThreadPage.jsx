/* ════════════════════════════════════════════════
   THE DM thread — /app/people/<profileId>/chat is the one canonical
   conversation surface with a person (MIGRATIONS.md, "Canonical DM
   surface"). Community's /app/community/messages/<requestId> redirects
   here; every "Message" action in the app links here.

   One pair, one thread: open_dm_with() (0019) + the 0030 unique pair
   index guarantee it at the database. Circle pairs land accepted; a
   non-circle pair sees the request-pending note until the other side
   says yes (and the database refuses sends until then).

   Carried over from the community surface so nothing was lost in the
   unification: the carrom inline board (a message may carry a
   game_session_id — the board renders in-thread, conversation
   continuing beneath), the brand sticker picker, the money-talk
   warning banner on incoming messages, and one-tap report. Unread
   state is the 0030 'dm' bell notification; opening this thread clears
   the messages' read_at AND that notification, so the bell agrees.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";
import { BodyText, GhostBtn, PrimaryBtn } from "../circle/ui.jsx";
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";
import { MONEY_PATTERN } from "../community/communityCopy.js";
import {
  fetchThread,
  sendMessage,
  markThreadRead,
  fileReport,
} from "../community/communityData.js";
import { announceRead } from "../notifications/data.js";
import CarromRailsController from "../games/carrom/CarromRailsController.jsx";
import { startCarromInThread } from "../games/carrom/rails.js";
import { STRINGS as CARROM } from "../games/carrom/carromCopy.js";
import { isStickerBody, fetchPerson, openDmWith } from "./peopleStore.js";

const POLL_MS = 4000;

/* Reading the thread clears its 0030 bell notification too — the
   badge and the thread must never disagree. Best-effort. */
async function clearDmNotifications(otherId) {
  try {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("kind", "dm")
      .eq("link", `/app/people/${otherId}/chat`)
      .is("read_at", null);
    announceRead();
  } catch {
    /* the bell catches up on its own next poll */
  }
}

export default function ThreadPage() {
  const { profileId } = useParams();
  const { t, ts, meta, lang } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;
  const carrom = CARROM[lang] || CARROM.en;

  const [person, setPerson] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [status, setStatus] = useState(null); // dm_requests.status
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const endRef = useRef(null);
  const openedRef = useRef(false);
  const reqRef = useRef(null);

  const refresh = useCallback(
    async (reqId) => {
      const { request: req, messages: msgs } = await fetchThread(reqId);
      setStatus(req?.status ?? null);
      setMessages(msgs);
      if (myId && msgs.some((m) => m.sender_id !== myId && !m.read_at)) {
        markThreadRead(reqId, myId);
        clearDmNotifications(profileId);
      }
    },
    [myId, profileId]
  );

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
        // Arriving from the bell with everything already read still
        // has to clear the notification that brought us here.
        clearDmNotifications(profileId);
        timer = setInterval(() => {
          if (reqRef.current) refresh(reqRef.current).catch(() => {});
        }, POLL_MS);
      } catch (err) {
        if (!cancelled) setError(err.message || t("people.thread.sendError"));
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, myId]);

  useEffect(() => {
    // Open at the LATEST message and follow growth. A single post-
    // render scroll under-shoots when stickers/fonts settle late, so
    // the jump repeats briefly until layout is stable. After the first
    // open, only follow when already near the bottom — never yank a
    // reader who scrolled up to reread.
    if (!messages?.length) return undefined;
    const nearBottom =
      window.scrollY + window.innerHeight >= document.body.scrollHeight - 200;
    if (openedRef.current && !nearBottom) return undefined;
    openedRef.current = true;
    let tries = 0;
    const timer = setInterval(() => {
      endRef.current?.scrollIntoView({ block: "end" });
      if (++tries >= 6) clearInterval(timer);
    }, 150);
    return () => clearInterval(timer);
  }, [messages?.length]);

  const send = async (body, gameSessionId = null) => {
    const text = (body || "").trim();
    if ((!text && !gameSessionId) || !requestId) return;
    setError("");
    try {
      await sendMessage(requestId, myId, text || null, gameSessionId);
      setDraft("");
      setPickerOpen(false);
      await refresh(requestId);
    } catch {
      setError(t("people.thread.sendError"));
    }
  };

  /* "Play carrom": create the session + invite this person (their bell
     gets the rails invitation with a deep link), then drop the board
     into the thread as a game-attachment message. */
  const playCarrom = async () => {
    if (!profileId || starting || !requestId) return;
    setStarting(true);
    setError("");
    try {
      // One live board per conversation: if a table from this thread
      // is still in the lobby or being played, point at it instead of
      // setting another (each tap used to mint a fresh session).
      const embedded = (messages || []).filter((m) => m.game_session_id).map((m) => m.game_session_id);
      if (embedded.length) {
        const { data: rows } = await supabase
          .from("game_sessions")
          .select("id, status, created_at, game_seats(profile_id)")
          .in("id", embedded)
          .in("status", ["lobby", "active"]);
        // "Live" means shared: an active table with THEM seated, or a
        // lobby still fresh enough that their seat is worth waiting for.
        // A bot-filled table or a two-hour-old unanswered lobby is not.
        const live = (rows || []).some((r) =>
          r.status === "active"
            ? (r.game_seats || []).some((seat) => seat.profile_id === profileId)
            : Date.now() - new Date(r.created_at).getTime() < 2 * 60 * 60 * 1000
        );
        if (live) {
          setToast(carrom.alreadySetUp);
          window.setTimeout(() => setToast(""), 5000);
          setStarting(false);
          return;
        }
      }
      const sessionId = await startCarromInThread(profileId);
      await sendMessage(requestId, myId, null, sessionId);
      await refresh(requestId);
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
      setError(t("people.thread.sendError"));
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
        {open && (
          <GhostBtn disabled={starting} onClick={playCarrom}>
            🎯 {carrom.playCarromCta}
          </GhostBtn>
        )}
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
          ⚠ {error}
        </BodyText>
      )}
      {toast && (
        <BodyText role="status" style={{ fontWeight: 700, color: C.green }}>
          ✓ {toast}
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
          /* Every empty state is a door: a not-yet-open thread says the
             request is waiting, never a blank pane (PARITY.md). */
          <BodyText muted>
            {open ? t("people.thread.empty") : t("people.thread.pendingNote", { name: first })}
          </BodyText>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myId;

            /* A game attachment renders the live board inline — full
               width, the conversation continuing beneath. */
            if (m.game_session_id) {
              return (
                <div key={m.id} style={{ marginBottom: 10 }}>
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
                  {m.body && <BodyText style={{ margin: "6px 0 0" }}>{m.body}</BodyText>}
                </div>
              );
            }

            const svgSticker = parseStickerRef(m.body);
            const emojiSticker = !svgSticker && isStickerBody(m.body);
            const moneyFlag =
              !mine && !svgSticker && !emojiSticker && m.body && MONEY_PATTERN.test(m.body);
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: mine ? "flex-end" : "flex-start",
                  marginBottom: 8,
                }}
              >
                {moneyFlag && (
                  <div
                    role="alert"
                    style={{
                      background: "#f3e9df",
                      border: `2px solid ${C.brown}`,
                      borderRadius: 14,
                      padding: "10px 14px",
                      marginBottom: 6,
                      /* Safety banner: never below the 18px floor. */
                      fontSize: ts(18),
                      lineHeight: 1.5,
                      color: C.brown,
                      fontWeight: 600,
                      maxWidth: "82%",
                    }}
                  >
                    ⚠ {t("community.dm.moneyWarning")}
                  </div>
                )}
                {svgSticker ? (
                  <Sticker id={svgSticker} size={104} style={{ maxWidth: "100%" }} />
                ) : (
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: emojiSticker ? "6px 10px" : "10px 16px",
                      borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: emojiSticker ? "transparent" : mine ? C.green : C.white,
                      border: emojiSticker
                        ? "none"
                        : mine
                          ? "none"
                          : `1.5px solid ${C.warmGray}`,
                      color: mine ? C.cream : C.textMain,
                      fontSize: emojiSticker ? ts(56) : ts(A11Y.minBodyPx),
                      lineHeight: emojiSticker ? 1.1 : 1.5,
                      overflowWrap: "anywhere",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.body}
                  </div>
                )}
                {/* Report is a safety affordance: full tap target,
                    full-size text, on every incoming message. */}
                {!mine && !svgSticker && (
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
        {status && !open && (
          <BodyText muted>{t("people.thread.pendingNote", { name: first })}</BodyText>
        )}
        <div ref={endRef} />
      </div>

      {/* Sticker picker — the shared Saathban set */}
      {pickerOpen && (
        <div style={{ marginBottom: 12 }}>
          <StickerPicker
            label={t("people.thread.stickersLabel")}
            onPick={(id) => send(stickerRef(id))}
          />
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
          🌸
        </GhostBtn>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("people.thread.placeholder")}
          aria-label={t("people.thread.placeholder")}
          disabled={!open}
          maxLength={2000}
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
