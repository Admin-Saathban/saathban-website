/* In-game chat — collapsible under the board so the game stays the
   star. Stickers reuse the people lane's warm set, rendered large
   when a message is emoji-only. Participants-only at the database. */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { BodyText, PrimaryBtn, GhostBtn } from "../../circle/ui.jsx";
import { STICKERS, isStickerBody } from "../../people/peopleStore.js";
import { SEAT_COLORS } from "./board.js";
import { fetchChat, sendChat } from "./ludoRails.js";

const POLL_MS = 4000;

export default function ChatPanel({ sessionId, myId, seats }) {
  const { t, ts } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [stickersOpen, setStickersOpen] = useState(false);
  const endRef = useRef(null);

  const seatOf = (profileId) => seats.find((s) => s.profile_id === profileId);

  useEffect(() => {
    let timer;
    const load = () => fetchChat(sessionId).then(setMessages).catch(() => {});
    load();
    timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [sessionId]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, open]);

  const send = async (body) => {
    const text = body.trim();
    if (!text) return;
    try {
      await sendChat(sessionId, text);
      setDraft("");
      setStickersOpen(false);
      setMessages(await fetchChat(sessionId));
    } catch {
      /* transient; the poll reconciles */
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <GhostBtn
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: "100%", justifyContent: "center" }}
      >
        💬 {t("ludo.chat.toggle")} {messages.length > 0 ? `(${messages.length})` : ""}
      </GhostBtn>

      {open && (
        <div
          style={{
            border: `1.5px solid ${C.warmGray}`,
            borderRadius: 16,
            background: "rgba(255,255,255,0.6)",
            padding: 12,
            marginTop: 8,
          }}
        >
          <div style={{ maxHeight: "30vh", overflowY: "auto", marginBottom: 10 }}>
            {messages.length === 0 && <BodyText muted>{t("ludo.chat.empty")}</BodyText>}
            {messages.map((m) => {
              const seat = seatOf(m.sender_id);
              const mine = m.sender_id === myId;
              const sticker = isStickerBody(m.body);
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: mine ? "flex-end" : "flex-start",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ maxWidth: "85%", textAlign: mine ? "end" : "start" }}>
                    {!mine && (
                      <BodyText muted style={{ margin: 0, fontSize: ts(15) }}>
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-block",
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: seat ? SEAT_COLORS[seat.seat] : C.warmGray,
                            marginInlineEnd: 6,
                          }}
                        />
                        {seat?.name || t("ludo.seat.someone")}
                      </BodyText>
                    )}
                    <div
                      style={{
                        display: "inline-block",
                        padding: sticker ? "2px 6px" : "8px 14px",
                        borderRadius: 14,
                        background: sticker ? "transparent" : mine ? C.green : C.white,
                        border: sticker || mine ? "none" : `1px solid ${C.warmGray}`,
                        color: mine ? C.cream : C.textMain,
                        fontSize: sticker ? ts(44) : ts(A11Y.minBodyPx),
                        lineHeight: sticker ? 1.1 : 1.5,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {stickersOpen && (
            <div
              role="group"
              aria-label={t("ludo.chat.stickers")}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(52px, 1fr))",
                gap: 4,
                marginBottom: 10,
              }}
            >
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  aria-label={`${t("ludo.chat.stickers")}: ${s}`}
                  style={{
                    minHeight: A11Y.minTapTargetPx,
                    fontSize: 30,
                    background: "transparent",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <GhostBtn
              onClick={() => setStickersOpen((o) => !o)}
              aria-expanded={stickersOpen}
              aria-label={t("ludo.chat.stickers")}
              style={{ padding: "0 12px", fontSize: ts(22) }}
            >
              😊
            </GhostBtn>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("ludo.chat.placeholder")}
              aria-label={t("ludo.chat.placeholder")}
              style={{
                flex: "1 1 140px",
                minHeight: A11Y.minTapTargetPx,
                padding: "0 14px",
                borderRadius: 50,
                border: `1.5px solid ${C.warmGray}`,
                background: C.white,
                fontSize: ts(A11Y.minBodyPx),
                fontFamily: "inherit",
                color: C.textMain,
              }}
            />
            <PrimaryBtn type="submit" disabled={!draft.trim()} style={{ minHeight: A11Y.minTapTargetPx }}>
              {t("ludo.chat.sendCta")}
            </PrimaryBtn>
          </form>
        </div>
      )}
    </div>
  );
}
