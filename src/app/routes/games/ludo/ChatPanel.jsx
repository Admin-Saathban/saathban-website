/* ════════════════════════════════════════════════
   The table's chat, as a sheet that rises from the bottom edge.

   IT OPENS FROM THE PARTICLE on your own circle, and from nowhere
   else. It used to be a full-width "💬 Table talk" bar sitting under
   the board — about seventy pixels of the one thing on the screen
   that matters — with a second Emoji pill beside it. Both are gone.
   Emoji live inside this keyboard now, which is where a person looks
   for them.

   Midnight, the same gradient as the table, with NO line along its
   top edge: a hairline there reads as the seam of a dialog, and this
   is meant to read as the table folding up to meet you.

   YOUR bubbles are green and sit right; THEIRS are frosted glass and
   sit left, with their name above in their own seat colour — which is
   the one place in this game where colour tells you who is speaking,
   and it is safe because the side of the screen says it too.

   Anybody muted from their profile card simply does not appear here.
   They are not told, and nothing marks the gap.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { GAME, NO_SELECT } from "../gameSurface.js";
import { GameMotion } from "../GameUI.jsx";
import { isStickerBody } from "../../people/peopleStore.js";
import { Sticker, parseStickerRef } from "../../../assets/stickers/stickers.jsx";
import { SEAT_COLORS } from "./board.js";
import { fetchChat, sendChat } from "./ludoRails.js";
import { readMutes } from "../tableMutes.js";
import { playSound } from "../../../lib/sound.js";

const POLL_MS = 4000;
const GREEN = "#1FA83C";

/* The quick row inside the keyboard. Warm, ordinary, and short: a
   grid of forty faces is a decision, and this is meant to be a
   reflex. */
const QUICK = ["👏", "😂", "😮", "🙏", "🎉", "😅", "❤️", "🤞"];

export default function ChatPanel({ sessionId, myId, seats, open, onClose, onSent }) {
  const { t, ts } = useI18n();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  const [mutes, setMutes] = useState({});

  const seatOf = (profileId) => seats.find((s) => s.profile_id === profileId);

  useEffect(() => {
    if (!open) return undefined;
    setMutes(readMutes(sessionId));
    let timer;
    const load = () => fetchChat(sessionId).then(setMessages).catch(() => {});
    load();
    timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [sessionId, open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, open]);

  const shown = useMemo(
    () => messages.filter((m) => m.sender_id === myId || !mutes[m.sender_id]?.chat),
    [messages, mutes, myId]
  );

  const send = async (body) => {
    const text = (body || "").trim();
    if (!text) return;
    setDraft("");
    /* THE WHOOSH, before the round trip. A send sound that waits for
       the server arrives after the message is already on screen, and
       a sound that lags what it describes reads as a second event. */
    playSound("chatSend");
    try {
      await sendChat(sessionId, text);
      setMessages(await fetchChat(sessionId));
      onSent?.(text);
    } catch {
      /* transient; the poll reconciles */
    }
  };

  if (!open) return null;

  return (
    <>
      <GameMotion />
      {/* The veil. Tapping it closes — backing out of a chat should
          never be a decision. */}
      <div
        className="sb-veil-in"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          background: "rgba(0,0,0,0.45)",
        }}
        aria-hidden="true"
      />
      <section
        className="sb-panel-in"
        role="dialog"
        aria-modal="true"
        aria-label={t("ludo.chat.toggle")}
        style={{
          ...NO_SELECT,
          position: "fixed",
          insetInline: 0,
          bottom: 0,
          zIndex: 71,
          maxHeight: "76dvh",
          display: "flex",
          flexDirection: "column",
          background: GAME.panel,
          /* NO TOP EDGE LINE. */
          border: "none",
          borderRadius: "18px 18px 0 0",
          boxShadow: GAME.panelShadow,
          padding: "10px 12px calc(12px + env(safe-area-inset-bottom))",
        }}
      >
        {/* A grab bar rather than a border: it says "this pulls down"
            and costs no line across the top. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("ludo.chat.close")}
          style={{
            alignSelf: "center",
            width: 64,
            height: 24,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          <span
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.28)",
            }}
          />
        </button>

        <div
          style={{
            flex: "1 1 auto",
            minHeight: 90,
            overflowY: "auto",
            padding: "4px 2px 10px",
            userSelect: "text",
            WebkitUserSelect: "text",
          }}
        >
          {shown.length === 0 && (
            <p style={{ margin: "8px 0", color: GAME.inkMuted, fontSize: ts(A11Y.minBodyPx) }}>
              {t("ludo.chat.empty")}
            </p>
          )}
          {shown.map((m) => {
            const seat = seatOf(m.sender_id);
            const mine = m.sender_id === myId;
            const svgSticker = parseStickerRef(m.body);
            const sticker = !svgSticker && isStickerBody(m.body);
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
                {/* THEIR NAME, IN THEIR SEAT COLOUR. Never yours: a
                    label over your own bubble tells you something you
                    already know, and the column of green down the
                    right-hand side is already saying it. */}
                {!mine && (
                  <span
                    style={{
                      fontSize: ts(13),
                      fontWeight: 800,
                      color: seat ? SEAT_COLORS[seat.seat] : GAME.inkMuted,
                      margin: "0 0 2px 4px",
                    }}
                  >
                    {seat?.name || t("ludo.seat.someone")}
                  </span>
                )}
                {svgSticker ? (
                  <Sticker id={svgSticker} size={96} style={{ maxWidth: "100%" }} />
                ) : (
                  <div
                    style={{
                      display: "inline-block",
                      maxWidth: "85%",
                      padding: sticker ? "2px 6px" : "9px 14px",
                      borderRadius: 16,
                      background: sticker ? "transparent" : mine ? GREEN : GAME.glassStrong,
                      border: sticker || mine ? "none" : `1px solid ${GAME.glassEdge}`,
                      color: "#FFFFFF",
                      fontSize: sticker ? ts(44) : ts(A11Y.minBodyPx),
                      lineHeight: sticker ? 1.1 : 1.5,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {m.body}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* THE KEYBOARD AREA. The emoji row lives here, above the
            field, because that is where a phone's own keyboard puts
            them and because it is the only place they still exist. */}
        <div style={{ flex: "0 0 auto" }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              padding: "2px 0 8px",
            }}
          >
            {QUICK.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => send(e)}
                aria-label={e}
                style={{
                  flex: "0 0 auto",
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: `1px solid ${GAME.glassEdge}`,
                  background: GAME.glass,
                  fontSize: ts(22),
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                {e}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("ludo.chat.placeholder")}
              aria-label={t("ludo.chat.placeholder")}
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                minHeight: A11Y.minTapTargetPx,
                padding: "0 14px",
                borderRadius: 24,
                border: "none",
                background: "#FFFFFF",
                fontSize: ts(A11Y.minBodyPx),
                fontFamily: "inherit",
                color: "#1A1A1A",
              }}
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              style={{
                flex: "0 0 auto",
                minHeight: A11Y.minTapTargetPx,
                padding: "0 20px",
                borderRadius: 24,
                border: "none",
                /* The same green as your own bubbles: the button is
                   the thing that makes one. */
                background: GREEN,
                color: "#FFFFFF",
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 800,
                opacity: draft.trim() ? 1 : 0.45,
                cursor: draft.trim() ? "pointer" : "default",
              }}
            >
              {t("ludo.chat.sendCta")}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
