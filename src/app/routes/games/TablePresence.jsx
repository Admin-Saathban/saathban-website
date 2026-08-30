/* ════════════════════════════════════════════════
   The people around the table.

   Wraps the board — whatever board that is — and puts a face at each
   corner: initial, name, that seat's own colour, and a quiet
   "thinking" pulse on whoever is on the move. The board canvas itself
   is untouched; this is the chrome around it, so ludo, snakes and
   carrom all get the same table without any of them knowing.

   WHAT A BUBBLE IS. A quick-chat line appears beside its speaker's
   corner for a few seconds and then fades, so a remark belongs to a
   face rather than to a list. It is an ordinary row from the game
   chat — nothing new is stored, and the same words stay in the chat
   history underneath, where anyone can scroll back to them.

   Under prefers-reduced-motion nothing pulses, drifts or fades: the
   turn is shown by weight and a ring, and bubbles simply appear and
   go. Both readings carry the same information, because the pulse is
   never the only way to know whose turn it is.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { SEAT_COLORS, SEAT_INK } from "./seatColors.js";
import { parseStickerRef, Sticker } from "../../assets/stickers/stickers.jsx";

const CORNERS = [
  { top: 0, insetInlineStart: 0, align: "flex-start" },
  { top: 0, insetInlineEnd: 0, align: "flex-end" },
  { bottom: 0, insetInlineStart: 0, align: "flex-start" },
  { bottom: 0, insetInlineEnd: 0, align: "flex-end" },
];

const BUBBLE_MS = 5000;

const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase();

export function TablePresenceStyles() {
  return (
    <style>{`
      @keyframes sb-think { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
      @keyframes sb-bubble-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      .sb-think-dot { animation: sb-think 1.2s ease-in-out infinite; }
      .sb-think-dot:nth-child(2) { animation-delay: .2s }
      .sb-think-dot:nth-child(3) { animation-delay: .4s }
      .sb-bubble { animation: sb-bubble-in .18s ease-out both; }
      @media (prefers-reduced-motion: reduce) {
        .sb-think-dot, .sb-bubble { animation: none !important; }
      }
    `}</style>
  );
}

function SeatChipFace({ seat, seatNo, isTurn, isMe, t, ts }) {
  const colour = SEAT_COLORS[(seatNo - 1) % SEAT_COLORS.length];
  const ink = SEAT_INK[(seatNo - 1) % SEAT_INK.length];
  const name = seat
    ? seat.is_bot
      ? t("games.board.bot")
      : isMe
        ? t("games.board.you")
        : (seat.name || "").split(" ")[0]
    : t("games.presence.emptySeat");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: C.white,
        /* The turn is carried by a ring AND by weight AND by the dots —
           never by colour alone. */
        border: isTurn ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        borderRadius: 50,
        padding: "5px 12px 5px 5px",
        boxShadow: isTurn ? `0 0 0 4px ${C.green}22` : "none",
        maxWidth: 148,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          flex: "0 0 30px",
          borderRadius: "50%",
          background: seat ? colour : C.warmGray,
          color: seat ? ink : C.textMuted,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: ts(15),
          fontWeight: 800,
        }}
      >
        {seat ? initialOf(seat.is_bot ? t("games.board.bot") : seat.name) : "+"}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: ts(15),
            fontWeight: isTurn ? 800 : 600,
            color: seat ? C.textMain : C.textMuted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </span>
        {isTurn && (
          <span
            style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}
            aria-label={t("games.presence.thinking", { name })}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="sb-think-dot"
                aria-hidden="true"
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: C.green,
                  display: "inline-block",
                }}
              />
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

function Bubble({ msg, align, ts }) {
  const text = msg.body || "";
  const svgSticker = parseStickerRef(text);
  const emoji = msg.sticker || null;
  return (
    <div
      className="sb-bubble"
      style={{
        alignSelf: align,
        marginTop: 6,
        maxWidth: 168,
        background: svgSticker || emoji ? "transparent" : C.green,
        color: C.cream,
        borderRadius: 16,
        padding: svgSticker || emoji ? 0 : "7px 12px",
        fontSize: ts(16),
        fontWeight: 600,
        lineHeight: 1.35,
        overflowWrap: "anywhere",
        boxShadow: svgSticker || emoji ? "none" : "0 2px 8px #0002",
      }}
    >
      {svgSticker ? (
        <Sticker id={svgSticker} size={56} />
      ) : emoji ? (
        <span style={{ fontSize: ts(30) }}>{emoji}</span>
      ) : (
        text
      )}
    </div>
  );
}

export default function TablePresence({ session, chat = [], profile, children }) {
  const { t, ts } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const seenRef = useRef(new Set());

  /* Only lines that arrived while we were watching float; opening a
     table does not replay the last five minutes at you. */
  const [live, setLive] = useState([]);
  const primed = useRef(false);

  useEffect(() => {
    if (!primed.current) {
      // First load: everything already said is history, not news.
      chat.forEach((m) => seenRef.current.add(m.id));
      primed.current = true;
      return;
    }
    const fresh = chat.filter((m) => !seenRef.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => seenRef.current.add(m.id));
    setLive((cur) => [...cur, ...fresh.map((m) => ({ ...m, at: Date.now() }))]);
  }, [chat]);

  // One timer while anything is floating; none when the table is quiet.
  useEffect(() => {
    if (!live.length) return undefined;
    const h = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(h);
  }, [live.length]);

  useEffect(() => {
    if (!live.length) return;
    const keep = live.filter((m) => now - m.at < BUBBLE_MS);
    if (keep.length !== live.length) setLive(keep);
  }, [now, live]);

  const seatsByNo = useMemo(() => {
    const out = {};
    for (const s of session.seats || []) out[s.seat_no] = s;
    return out;
  }, [session.seats]);

  const bubblesFor = (seatNo) => {
    const seat = seatsByNo[seatNo];
    if (!seat?.profile_id) return [];
    return live.filter((m) => m.sender_id === seat.profile_id);
  };

  const total = Math.min(session.seats_total || 2, 4);

  return (
    <div style={{ position: "relative", paddingTop: 6 }}>
      <TablePresenceStyles />
      {/* The board, untouched — this component never reaches inside it. */}
      <div style={{ padding: "44px 0" }}>{children}</div>

      {Array.from({ length: total }, (_, i) => {
        const seatNo = i + 1;
        const seat = seatsByNo[seatNo];
        const corner = CORNERS[i];
        const isTurn = session.status === "active" && session.current_seat === seatNo;
        const isMe = seat?.profile_id && profile?.id === seat.profile_id;
        const bubbles = bubblesFor(seatNo);
        return (
          <div
            key={seatNo}
            style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: corner.align,
              gap: 0,
              pointerEvents: "none",
              zIndex: 2,
              ...corner,
            }}
          >
            <SeatChipFace seat={seat} seatNo={seatNo} isTurn={isTurn} isMe={isMe} t={t} ts={ts} />
            <div aria-live="polite" style={{ display: "flex", flexDirection: "column", alignItems: corner.align }}>
              {bubbles.slice(-2).map((m) => (
                <Bubble key={m.id} msg={m} align={corner.align} ts={ts} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
