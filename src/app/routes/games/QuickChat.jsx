/* ════════════════════════════════════════════════
   Quick chat — two taps, no typing. Shared by every table: ludo,
   snakes, carrom.

   At a real table nobody composes a sentence; they say "wah!" and get
   on with the game. So the ten things people actually say are one tap
   each from a corner button, alongside the sticker row we already
   have. A preset is an ordinary chat message — no schema of its own,
   so it lands in the same history as everything else and anyone
   reading the thread later sees a conversation rather than a set of
   event codes.

   What is said appears as a floating bubble BY THE SPEAKER'S CORNER
   for a few seconds, so a remark belongs to a face rather than to a
   list. Bubbles fade on their own; under reduced-motion they simply
   appear and go without travelling.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";
import { SEAT_COLORS } from "./seatColors.js";

/* The presets, in the order they are offered. Warm first, teasing
   second, courteous last — the shape of an actual table's talk. */
export const QUICK_KEYS = [
  "wah",
  "shabash",
  "kyaChaal",
  "bachGaya",
  "naaInsafi",
  "chaloJaldi",
  "meriBaari",
  "acha",
  "khelteHain",
  "phirMilenge",
];

export const BUBBLE_MS = 4200;

/* A remark floating by its speaker's corner. `corner` is 0..3 from the
   board's own corner numbering (top-left, then clockwise). */
export function ChatBubbles({ bubbles, cornerOf }) {
  const { ts } = useI18n();
  const spot = (corner) => {
    switch (corner) {
      case 0: return { top: 4, left: 4, align: "flex-start" };
      case 1: return { top: 4, right: 4, align: "flex-end" };
      case 2: return { bottom: 4, right: 4, align: "flex-end" };
      default: return { bottom: 4, left: 4, align: "flex-start" };
    }
  };
  return (
    <>
      {bubbles.map((b) => {
        const corner = cornerOf(b.seat);
        const { align, ...pos } = spot(corner);
        const colour = SEAT_COLORS[b.seat % SEAT_COLORS.length];
        const sticker = parseStickerRef(b.text);
        return (
          <div
            key={b.id}
            className="sb-bubble"
            role="status"
            style={{
              position: "absolute",
              ...pos,
              zIndex: 6,
              maxWidth: "62%",
              display: "flex",
              flexDirection: "column",
              alignItems: align,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: C.white,
                border: `2px solid ${colour}`,
                borderRadius: 16,
                padding: sticker ? "6px 8px" : "8px 12px",
                boxShadow: "0 4px 14px rgba(45,36,24,0.22)",
                fontSize: ts(17),
                fontWeight: 600,
                color: C.textMain,
                lineHeight: 1.35,
              }}
            >
              {sticker ? <Sticker id={sticker} size={54} /> : b.text}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function QuickChat({ onSend, disabled }) {
  const { t, ts } = useI18n();
  const [open, setOpen] = useState(false);
  const [stickers, setStickers] = useState(false);
  const sending = useRef(false);

  // Closing on Escape, because a sheet that only closes by tapping a
  // small ✕ is a trap on a phone.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const say = (text) => {
    if (sending.current || !text) return;
    sending.current = true;
    setOpen(false);
    setStickers(false);
    Promise.resolve(onSend(text)).finally(() => {
      sending.current = false;
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={t("ludo.quick.open")}
        style={{
          minHeight: A11Y.minTapTargetPx,
          minWidth: A11Y.minTapTargetPx,
          padding: "0 18px",
          borderRadius: 50,
          border: `2px solid ${C.warmGray}`,
          background: C.white,
          color: C.brown,
          fontSize: ts(18),
          fontWeight: 700,
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span aria-hidden="true">💬</span>
        {t("ludo.quick.open")}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={t("ludo.quick.open")}
      style={{
        position: "fixed",
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: 0,
        zIndex: 70,
        background: C.white,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        boxShadow: "0 -8px 30px rgba(45,36,24,0.28)",
        padding: "16px 14px calc(16px + env(safe-area-inset-bottom, 0px))",
        maxHeight: "72vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <p style={{ flex: 1, margin: 0, fontSize: ts(17), color: C.textMuted }}>{t("ludo.quick.hint")}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            minHeight: A11Y.minTapTargetPx,
            minWidth: A11Y.minTapTargetPx,
            borderRadius: 50,
            border: `2px solid ${C.warmGray}`,
            background: C.white,
            color: C.textMain,
            fontSize: ts(18),
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          {t("ludo.quick.close")}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
        {QUICK_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => say(t(`ludo.quick.phrases.${k}`))}
            style={{
              minHeight: 56,
              padding: "0 14px",
              borderRadius: 16,
              border: `2px solid ${C.warmGray}`,
              background: C.cream,
              color: C.textMain,
              fontSize: ts(18),
              fontWeight: 600,
              fontFamily: "inherit",
              textAlign: "start",
              cursor: "pointer",
            }}
          >
            {t(`ludo.quick.phrases.${k}`)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => setStickers((v) => !v)}
          aria-expanded={stickers}
          style={{
            minHeight: A11Y.minTapTargetPx,
            padding: "0 16px",
            borderRadius: 50,
            border: `2px solid ${C.warmGray}`,
            background: C.white,
            color: C.brown,
            fontSize: ts(18),
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          {stickers ? "▾ " : "▸ "}
          {t("ludo.chat.stickers")}
        </button>
        {stickers && (
          <div style={{ marginTop: 8 }}>
            <StickerPicker onPick={(id) => say(stickerRef(id))} label={t("ludo.chat.stickers")} />
          </div>
        )}
      </div>
    </div>
  );
}
