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
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import FirstMessageBox from "./FirstMessageBox.jsx";
import { fetchLikes, toggleLike } from "../messages/messagesData.js";
import { copyToEvidence } from "../community/communityData.js";
import { VoiceRecorder, VoicePlayer } from "./VoiceNote.jsx";
import { useSession } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";
import { BodyText, GhostBtn, PrimaryBtn } from "../circle/ui.jsx";
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";
import { MONEY_PATTERN } from "../community/communityCopy.js";
import { markThreadRead, fileReport } from "../community/communityData.js";
import {
  fetchThreadDeep,
  sendDeep,
  hideMessageForMe,
  deleteMessageForEveryone,
  canDeleteForEveryone,
  uploadChatImage,
  chatImageUrl,
  uploadChatAudio,
  chatAudioUrl,
} from "./myPeopleStore.js";
import { announceRead } from "../notifications/data.js";
import CarromRailsController from "../games/carrom/CarromRailsController.jsx";
import { startCarromInThread } from "../games/carrom/rails.js";
import { createSession, inviteToGame } from "../../lib/games.js";
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
  const [chooserOpen, setChooserOpen] = useState(false);
  const [lastGame, setLastGame] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  // Chat depth (0034): reply quote, per-message action menu, photos.
  const [replyTo, setReplyTo] = useState(null);      // message being replied to
  const [menuFor, setMenuFor] = useState(null);      // message id with the ⋯ menu open
  const [imageUrls, setImageUrls] = useState({});    // image_path -> signed url
  /* MESSAGES_SPEC §6 — one heart, one tap. Two sets rather than a
     count: §6 forbids a counter, and with exactly two people in a
     thread "who liked it" is fully answered by these two. */
  const [heartsMine, setHeartsMine] = useState(() => new Set());
  const [heartsTheirs, setHeartsTheirs] = useState(() => new Set());
  const [audioUrls, setAudioUrls] = useState({});    // audio_path -> signed url
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  // Bubbles on their way to the server (text/stickers only).
  const [pendingMsgs, setPendingMsgs] = useState([]);
  const [lightbox, setLightbox] = useState(null);    // signed url shown large
  const [flashId, setFlashId] = useState(null);      // briefly highlighted after a jump
  const msgRefs = useRef({});
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const endRef = useRef(null);
  const openedRef = useRef(false);
  const reqRef = useRef(null);

  const refresh = useCallback(
    async (reqId) => {
      const { request: req, messages: msgs } = await fetchThreadDeep(reqId, myId);
      setStatus(req?.status ?? null);
      setMessages(msgs);
      /* §6 remembers what you last played with this person — read off
         the thread rather than stored anywhere. The newest message
         carrying a game names the game. */
      const played = msgs.filter((m) => m.game_session_id).map((m) => m.game_session_id);
      if (played.length) {
        const { data: sess } = await supabase
          .from("game_sessions")
          .select("id, game_key, created_at")
          .in("id", played)
          .order("created_at", { ascending: false })
          .limit(1);
        setLastGame(sess?.[0]?.game_key || null);
      } else {
        setLastGame(null);
      }
      /* Hearts, alongside the messages they sit on. */
      try {
        const likes = await fetchLikes(msgs.map((m) => m.id));
        const mine = new Set();
        const theirs = new Set();
        for (const l of likes) {
          (l.profile_id === myId ? mine : theirs).add(l.message_id);
        }
        setHeartsMine(mine);
        setHeartsTheirs(theirs);
      } catch {
        /* a heart that will not load must not cost anyone their thread */
      }

      // Private bucket: resolve short-lived signed URLs for any photos.
      const paths = msgs.filter((m) => m.image_path).map((m) => m.image_path);
      if (paths.length) {
        const entries = await Promise.all(paths.map(async (p) => [p, await chatImageUrl(p)]));
        setImageUrls((cur) => ({ ...cur, ...Object.fromEntries(entries.filter(([, u]) => u)) }));
      }
      /* Voice notes live in their own participant-scoped bucket (0074)
         and need their own signed URLs. preload="none" on the player
         means signing a URL still downloads nothing until it is played. */
      const apaths = msgs.filter((m) => m.audio_path).map((m) => m.audio_path);
      if (apaths.length) {
        const aentries = await Promise.all(apaths.map(async (p) => [p, await chatAudioUrl(p)]));
        setAudioUrls((cur) => ({ ...cur, ...Object.fromEntries(aentries.filter(([, u]) => u)) }));
      }
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

  /* Optimistic send: the bubble is on screen before the round trip,
     marked "sending", and the real row replaces it on confirm. A
     refusal returns the words to the box with a kind line + Retry —
     a message a person typed is never silently swallowed.
     Text and stickers only: a photo keeps the existing uploading
     state, because a bucket path is not a renderable src until the
     upload lands. */
  const send = async (body, gameSessionId = null) => {
    const text = (body || "").trim();
    if ((!text && !gameSessionId) || !requestId || sending) return;
    setError("");
    const keptDraft = draft;
    const keptReply = replyTo;
    const pending = gameSessionId
      ? null
      : {
          id: `pending-${Date.now()}`,
          sender_id: myId,
          body: text,
          created_at: new Date().toISOString(),
          reply_to_id: replyTo?.id || null,
          __pending: true,
        };
    if (pending) setPendingMsgs((cur) => [...cur, pending]);
    setDraft("");
    setReplyTo(null);
    setPickerOpen(false);
    setSending(true);
    try {
      await sendDeep(requestId, myId, { body: text, replyToId: keptReply?.id || null, gameSessionId });
      await refresh(requestId);
      if (pending) setPendingMsgs((cur) => cur.filter((m) => m.id !== pending.id));
    } catch {
      if (pending) setPendingMsgs((cur) => cur.filter((m) => m.id !== pending.id));
      setDraft(keptDraft || text);
      setReplyTo(keptReply);
      setError(t("people.thread.sendError"));
      pushToast(t("feedback.dmFailed"), {
        tone: "error",
        actionLabel: t("feedback.retry"),
        onAction: () => send(text, gameSessionId),
        key: "dm-send",
      });
    } finally {
      setSending(false);
    }
  };

  /* "Play carrom": create the session + invite this person (their bell
     gets the rails invitation with a deep link), then drop the board
     into the thread as a game-attachment message. */
  /* WHICH GAME WE OFFER FIRST IS DERIVED, NOT STORED (§6: remembers
     what you last played with that person). The thread already holds
     the answer — the newest message carrying a game — so there is no
     preference to save, nothing to go stale, and it is right on every
     device the moment it is right on one. */
  const playGame = async (gameKey) => {
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
          pushToast(carrom.alreadySetUp, { tone: "info" });
          setStarting(false);
          return;
        }
      }
      /* Carrom renders inline in the thread; ludo and snakes get a
         two-seat table with the other person invited, and the card
         that lands here offers them the seat. */
      const sessionId =
        gameKey === "carrom"
          ? await startCarromInThread(profileId)
          : await (async () => {
              const id = await createSession(gameKey, 2, {});
              await inviteToGame(id, profileId);
              return id;
            })();
      await sendDeep(requestId, myId, { gameSessionId: sessionId });
      await refresh(requestId);
    } catch {
      setError(t("community.dm.gameStartFailed"));
    }
    setStarting(false);
  };

  const reportMessage = async (m) => {
    try {
      /* A reported VOICE note has no words to quote. The moderation
         queue used to receive "(no excerpt captured)" and nothing else,
         so a complaint about audio could not be judged at all. The
         reporter hands over a copy — they can read their own thread,
         the moderator cannot, and that asymmetry is the whole reason
         the copy exists rather than an admin read path (C5). */
      let media = null;
      if (m.audio_path) {
        const copied = await copyToEvidence("dm-audio", m.audio_path);
        if (copied) media = { bucket: "report-evidence", path: copied, kind: "audio" };
      }
      await fileReport(myId, "dm_message", m.id, m.sender_id, m.body, null, media);
      pushToast(t("feedback.reported"));
    } catch {
      setError(t("people.thread.sendError"));
    }
  };

  /* Delete for me: a per-person hide. Delete for everyone: sender-only,
     15 minutes, server-enforced — the row becomes a "removed" stub. */
  const deleteForMe = async (m) => {
    setMenuFor(null);
    try { await hideMessageForMe(m.id, myId); await refresh(requestId); }
    catch { setError(t("people.thread.sendError")); }
  };
  const deleteForEveryone = async (m) => {
    setMenuFor(null);
    try { await deleteMessageForEveryone(m.id); await refresh(requestId); }
    catch { setError(t("people.thread.deleteWindowNote")); }
  };
  const startReply = (m) => { setMenuFor(null); setReplyTo(m); };
  const jumpTo = (id) => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(id);
    window.setTimeout(() => setFlashId(null), 1600);
  };
  /* Camera or gallery → the thread's private folder → a photo message. */
  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !requestId) return;
    setUploading(true);
    setError("");
    try {
      const path = await uploadChatImage(requestId, file);
      await sendDeep(requestId, myId, { imagePath: path, replyToId: replyTo?.id || null });
      setReplyTo(null);
      await refresh(requestId);
    } catch (err) {
      const k = err.message === "too-big" ? "photoTooBig" : err.message === "bad-type" ? "photoBadType" : "photoFailed";
      setError(t("people.thread." + k));
    }
    setUploading(false);
  };
  /* §6's Voice button. The recorder hands back a blob and its length;
     the length is stored so the other person can see how long it is
     before any of it is downloaded (0074). */
  const onRecorded = async (blob, seconds, mime) => {
    if (!requestId) return;
    setUploading(true);
    setError("");
    try {
      const path = await uploadChatAudio(requestId, blob, mime);
      await sendDeep(requestId, myId, {
        audioPath: path,
        audioSeconds: seconds,
        replyToId: replyTo?.id || null,
      });
      setReplyTo(null);
      await refresh(requestId);
    } catch (err) {
      const k = err.message === "too-big" ? "photoTooBig" : "voiceFailed";
      setError(t("people.thread." + k));
    }
    setUploading(false);
  };

  /* §6 — tap to give it, tap again to take it back. Optimistic,
     because a heart that waits for the network stops being a warm
     reflex; it rolls back if the write is refused. No toast, no
     points, no badge — §6 and POINTS.md both say a reaction earns
     nothing, and that is deliberate. */
  const toggleHeart = async (m) => {
    const had = heartsMine.has(m.id);
    setHeartsMine((cur) => {
      const next = new Set(cur);
      if (had) next.delete(m.id); else next.add(m.id);
      return next;
    });
    try {
      await toggleLike(m.id, myId, had);
    } catch {
      setHeartsMine((cur) => {
        const next = new Set(cur);
        if (had) next.add(m.id); else next.delete(m.id);
        return next;
      });
    }
  };

  const byId = Object.fromEntries((messages || []).map((m) => [m.id, m]));
  const quoteText = (m) =>
    !m ? t("people.thread.removed")
    : m.deleted_at ? t("people.thread.removed")
    : m.image_path ? "📷"
    : m.game_session_id ? "🎯"
    : (m.body || "").slice(0, 80);

  /* Three names, from the locale rather than the registry: the chooser
     must render before any network call, and a chooser that flickers
     into existence is worse than one that is simply there. */
  const gameName = (k) => t(`people.thread.game_${k}`);
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
          <GhostBtn
            disabled={starting}
            onClick={() => (lastGame ? playGame(lastGame) : setChooserOpen(true))}
            aria-label={
              lastGame
                ? t("people.thread.playAgainNamed", { game: gameName(lastGame) })
                : t("people.thread.playCta")
            }
          >
            {/* Second time is ONE TAP: if this thread has a game in it
                already, the button plays that game again rather than
                asking the same question twice. */}
            🎲 {lastGame ? t(`people.thread.playAgainNamed`, { game: gameName(lastGame) }) : t("people.thread.playCta")}
          </GhostBtn>
        )}
        {open && lastGame && (
          <GhostBtn disabled={starting} onClick={() => setChooserOpen(true)} style={{ padding: "0 14px" }}>
            {t("people.thread.playOther")}
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

      {chooserOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("people.thread.playCta")}
          style={{
            position: "fixed", inset: 0, zIndex: 70, background: "rgba(45,36,24,0.45)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
          onClick={() => setChooserOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 640, background: C.bg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "18px 16px 24px",
            }}
          >
            <h2 style={{ fontSize: ts(22), fontWeight: 800, color: C.brown, margin: "0 0 12px" }}>
              {t("people.thread.playWhich")}
            </h2>
            {["ludo", "carrom", "snakes"].map((k) => (
              <button
                key={k}
                type="button"
                disabled={starting}
                onClick={() => { setChooserOpen(false); playGame(k); }}
                style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%",
                  minHeight: 72, padding: "12px 18px", marginBottom: 10,
                  background: C.white, border: `2px solid ${C.warmGray}`, borderRadius: 18,
                  fontFamily: "inherit", fontSize: ts(20), fontWeight: 700,
                  color: C.textMain, textAlign: "start", cursor: "pointer",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: ts(26) }}>
                  {k === "ludo" ? "🎲" : k === "carrom" ? "🎯" : "🪜"}
                </span>
                {gameName(k)}
              </button>
            ))}
            <GhostBtn onClick={() => setChooserOpen(false)} style={{ width: "100%" }}>
              {t("outdoor.place.formCancel")}
            </GhostBtn>
          </div>
        </div>
      )}

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
            const setRef = (el) => { if (el) msgRefs.current[m.id] = el; };
            const flashStyle = flashId === m.id ? { outline: "3px solid " + C.sage, outlineOffset: 4, borderRadius: 18 } : {};

            /* Delete-for-everyone leaves a quiet stub — never a gap. */
            if (m.deleted_at) {
              return (
                <div key={m.id} ref={setRef} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8, ...flashStyle }}>
                  <BodyText muted style={{ margin: 0, fontStyle: "italic", fontSize: ts(17) }}>
                    🚫 {t("people.thread.removed")}
                  </BodyText>
                </div>
              );
            }

            /* Quoted reply — tap jumps to (and highlights) the original. */
            const quote = m.reply_to_id ? (
              <button
                type="button"
                onClick={() => jumpTo(m.reply_to_id)}
                aria-label={t("people.thread.jumpToOriginal")}
                style={{
                  display: "block", textAlign: "start", maxWidth: "82%", marginBottom: 4,
                  padding: "6px 12px", borderInlineStart: "4px solid " + C.sage, borderRadius: 10,
                  background: "rgba(143,166,126,0.15)", border: "none", color: C.textMuted,
                  fontSize: ts(16), fontFamily: "inherit", cursor: "pointer", minHeight: A11Y.minTapTargetPx,
                  overflowWrap: "anywhere",
                }}
              >
                ↩ {quoteText(byId[m.reply_to_id])}
              </button>
            ) : null;

            /* The ⋯ menu: Reply / Delete for me / Delete for everyone
               (sender, 15 min) / Report (incoming). Absent, never disabled. */
            const menu = (
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                {/* §6 — ONE heart, ONE tap. No long-press (a gesture
                    many older people never discover) and no six-emoji
                    picker (which turns a warm gesture into a decision). */}
                {!m.deleted_at && (
                  <button
                    type="button"
                    onClick={() => toggleHeart(m)}
                    aria-pressed={heartsMine.has(m.id)}
                    aria-label={t(heartsMine.has(m.id) ? "people.thread.unheart" : "people.thread.heart")}
                    style={{
                      minHeight: A11Y.minTapTargetPx,
                      minWidth: A11Y.minTapTargetPx,
                      background: "none",
                      border: "none",
                      fontSize: ts(20),
                      cursor: "pointer",
                      opacity: heartsMine.has(m.id) || heartsTheirs.has(m.id) ? 1 : 0.45,
                    }}
                  >
                    <span aria-hidden="true">{heartsMine.has(m.id) ? "❤️" : "🤍"}</span>
                  </button>
                )}
                {/* Their heart, when it is not also mine — said as a
                    mark, never as a number. */}
                {heartsTheirs.has(m.id) && !heartsMine.has(m.id) && (
                  <span aria-label={t("people.thread.theyHearted")} style={{ fontSize: ts(16) }}>❤️</span>
                )}
                <button
                  type="button"
                  aria-expanded={menuFor === m.id}
                  aria-label={t("people.thread.moreActions")}
                  onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                  style={{ minHeight: A11Y.minTapTargetPx, minWidth: A11Y.minTapTargetPx, background: "none", border: "none", color: C.textMuted, fontSize: ts(22), cursor: "pointer" }}
                >
                  ⋯
                </button>
                {menuFor === m.id && (
                  <div role="menu" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <GhostBtn role="menuitem" onClick={() => startReply(m)}>↩ {t("people.thread.reply")}</GhostBtn>
                    <GhostBtn role="menuitem" onClick={() => deleteForMe(m)}>{t("people.thread.deleteForMe")}</GhostBtn>
                    {canDeleteForEveryone(m, myId) && (
                      <GhostBtn role="menuitem" onClick={() => deleteForEveryone(m)} style={{ color: C.error, borderColor: C.error }}>
                        {t("people.thread.deleteForEveryone")}
                      </GhostBtn>
                    )}
                    {!mine && (
                      <GhostBtn role="menuitem" onClick={() => { setMenuFor(null); reportMessage(m); }}>
                        {t("community.dm.reportMessage")}
                      </GhostBtn>
                    )}
                  </div>
                )}
              </div>
            );

            /* A voice note: playable in place, never a file to fetch. */
            if (m.audio_path) {
              return (
                <div key={m.id} ref={setRef} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", marginBottom: 8, ...flashStyle }}>
                  {quote}
                  <VoicePlayer
                    url={audioUrls[m.audio_path]}
                    seconds={m.audio_seconds}
                    mine={mine}
                  />
                  {menu}
                </div>
              );
            }

            /* A photo: inline, private signed URL, tap to view large. */
            if (m.image_path) {
              const url = imageUrls[m.image_path];
              return (
                <div key={m.id} ref={setRef} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", marginBottom: 8, ...flashStyle }}>
                  {quote}
                  {url ? (
                    <button
                      type="button"
                      onClick={() => setLightbox(url)}
                      aria-label={t("people.thread.viewLarge")}
                      style={{ padding: 0, border: "1.5px solid " + C.warmGray, borderRadius: 16, background: C.white, cursor: "zoom-in", maxWidth: "82%", overflow: "hidden" }}
                    >
                      <img src={url} alt={t("people.thread.photoAlt", { name: mine ? t("people.thread.you") : first })} style={{ display: "block", maxWidth: "100%", maxHeight: 320, objectFit: "cover" }} />
                    </button>
                  ) : (
                    <BodyText muted style={{ margin: 0 }}>📷 …</BodyText>
                  )}
                  {m.body && <BodyText style={{ margin: "6px 0 0", maxWidth: "82%" }}>{m.body}</BodyText>}
                  {menu}
                </div>
              );
            }

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
                ref={setRef}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: mine ? "flex-end" : "flex-start",
                  marginBottom: 8,
                  ...flashStyle,
                }}
              >
                {quote}
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
                {menu}
              </div>
            );
          })
        )}
        {status && !open && (
          <BodyText muted>{t("people.thread.pendingNote", { name: first })}</BodyText>
        )}
        {/* §6 — the ONE message a stranger may send. Renders only for
            the requester, only while pending, only while unsent. */}
        {status && !open && <FirstMessageBox requestId={requestId} name={first} />}
        {pendingMsgs.map((m) => (
          <div
            key={m.id}
            style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}
          >
            <div
              style={{
                maxWidth: "78%",
                background: C.sage,
                opacity: 0.72,
                color: C.textMain,
                borderRadius: 18,
                padding: "10px 14px",
                fontSize: ts(A11Y.minBodyPx),
                lineHeight: 1.5,
                overflowWrap: "anywhere",
              }}
            >
              {parseStickerRef(m.body) ? (
                <Sticker id={parseStickerRef(m.body)} size={96} />
              ) : (
                m.body
              )}
              <span
                role="status"
                style={{ display: "block", fontSize: ts(15), color: C.textMuted, marginTop: 4 }}
              >
                · {t("feedback.sending")}
              </span>
            </div>
          </div>
        ))}
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

      {/* Reply strip — what you're replying to, one tap to cancel. */}
      {replyTo && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", borderInlineStart: "4px solid " + C.sage, background: "rgba(143,166,126,0.15)", borderRadius: 10 }}>
          <BodyText muted style={{ margin: 0, flex: 1, fontSize: ts(16), overflowWrap: "anywhere" }}>
            ↩ {t("people.thread.replyingTo", { name: replyTo.sender_id === myId ? t("people.thread.you") : first })}: {quoteText(replyTo)}
          </BodyText>
          <GhostBtn onClick={() => setReplyTo(null)} aria-label={t("people.thread.cancelReply")} style={{ padding: "0 14px" }}>✕</GhostBtn>
        </div>
      )}

      {/* Photo inputs: camera (capture on mobile) and gallery. No filters (v2). */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPickImage} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickImage} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
      {uploading && <BodyText muted role="status" style={{ margin: "0 0 8px" }}>{t("people.thread.uploading")}</BodyText>}

      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label={t("people.thread.viewLarge")} onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12 }} />
          <button type="button" onClick={() => setLightbox(null)} style={{ position: "absolute", top: 12, insetInlineEnd: 12, minHeight: A11Y.minTapTargetPx, minWidth: A11Y.minTapTargetPx, borderRadius: 50, border: "none", background: C.cream, color: C.textMain, fontSize: ts(20), fontWeight: 700, cursor: "pointer" }}>
            ✕ {t("people.thread.closeImage")}
          </button>
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
          aria-label={t("people.thread.stickerCta")}
          disabled={!open}
          style={{ padding: "0 16px", gap: 8 }}
        >
          <span aria-hidden="true" style={{ fontSize: ts(22) }}>🌸</span>
          {t("people.thread.stickerCta")}
        </GhostBtn>
        {/* §6 — the third labelled button. It asks for the microphone
            at the moment it is tapped, never before. */}
        <VoiceRecorder disabled={!open || uploading} onRecorded={onRecorded} />
        {/* ONE Photo button, not two. The phone's own sheet already
            offers the camera, and two controls for one idea is exactly
            what §6 replaces. */}
        <GhostBtn
          onClick={() => galleryRef.current?.click()}
          aria-label={t("people.thread.photoCta")}
          disabled={!open || uploading}
          style={{ padding: "0 16px", gap: 8 }}
        >
          <span aria-hidden="true" style={{ fontSize: ts(22) }}>📷</span>
          {t("people.thread.photoCta")}
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
        <PrimaryBtn type="submit" disabled={!open || !draft.trim() || sending}>
          {sending ? t("feedback.sending") : t("people.thread.sendCta")}
        </PrimaryBtn>
      </form>
    </div>
  );
}
