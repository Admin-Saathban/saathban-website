/* ════════════════════════════════════════════════
   Quick talk at the table — LUDO_UI_SPEC.md §7. Shared by every
   table: ludo, snakes, carrom.

   TWO BUTTONS, NOT ONE. The spec separates them and it is right to:
   an emoji is a reaction and a phrase is a sentence, and burying the
   faces behind a "say something" sheet costs a tap for the thing
   people reach for most. So the action row carries an EMOJI button
   and a CHAT button, each opening its own sheet, each one tap from
   the board.

   At a real table nobody composes a sentence; they say "wah!" and get
   on with the game. So the ten things people actually say are one tap
   each, in the warm desi register the spec asks for, and no part of
   any of this requires typing.

   A preset is an ordinary chat message — no schema of its own — so it
   lands in the same history as everything else and anyone reading the
   thread later sees a conversation rather than a set of event codes.

   What is said appears as a floating bubble BY THE SPEAKER'S AVATAR
   for a few seconds, so a remark belongs to a face rather than to a
   list. Bubbles fade on their own; under reduced-motion they simply
   appear and go without travelling.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { GAME, NO_SELECT } from "./gameSurface.js";
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";
import { SEAT_COLORS } from "./seatColors.js";
import useBackToClose from "../../components/useBackToClose.js";

/* The presets, in the order LUDO_UI_SPEC §7 gives them. Warm first,
   teasing in the middle, courteous last — the shape of an actual
   table's talk. */
export const QUICK_KEYS = [
  "wah",
  "shabash",
  "achhaKhela",
  "naaInsafi",
  "kyaChaal",
  "meriBaari",
  "oho",
  "phirMilenge",
  "jeetayRaho",
  "chaloPhir",
];

export const BUBBLE_MS = 4200;

/* A remark floating by its speaker's corner. `corner` is 0..3 from the
   board's own corner numbering (top-left, then clockwise). */
export function ChatBubbles({ bubbles, cornerOf }) {
  const { ts } = useI18n();
  /* PHYSICAL left/right, not logical. These name the corners of an SVG
     board whose geometry does not flip with the document direction —
     with inset-inline every bubble in Urdu landed on the opposite side
     of the table from the person who said it. */
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
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                color: C.textMain,
                lineHeight: 1.35,
              }}
            >
              {sticker ? <Sticker id={sticker} size={54} /> : <span dir="auto">{b.text}</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* The sheet both buttons open. Same frame, different contents, so the
   two never drift apart in padding, dismissal or safe-area handling. */
function Sheet({ hint, onClose, children }) {
  const { t, ts } = useI18n();
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Tapping outside dismisses it (§7). A sheet that only closes by
          finding a small ✕ is a trap on a phone. */}
      <div
        onClick={onClose}
        className="sb-game-veil"
        style={{ position: "fixed", inset: 0, zIndex: 69, background: "rgba(20,8,20,0.55)" }}
      />
      <div
        role="dialog"
        className="sb-game-panel"
        aria-label={hint}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 70,
          /* The game's panel: plum with a gold edge, the way the
             reference dresses every sheet it raises over a board. */
          background: GAME.panel,
          borderTop: `2px solid ${GAME.panelEdge}`,
          color: GAME.ink,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow: "0 -8px 30px rgba(45,36,24,0.28)",
          padding: "16px 14px calc(16px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "72vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <p style={{ flex: 1, margin: 0, fontSize: ts(A11Y.minBodyPx), color: GAME.inkMuted }}>{hint}</p>
          <button
            type="button"
            onClick={onClose}
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
              cursor: "pointer",
            }}
          >
            {t("ludo.quick.close")}
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

/* THE GAME'S PILL, NOT THE APP'S.

   This was a white capsule with a warm-grey border and brown ink —
   the app's button, sitting under a dark board, and one of the
   loudest reasons the play screen still read as Saathban with the
   lights off.

   `game` keeps the old look available for anywhere outside a game
   surface, so this component does not have to know where it is.

   UNDER 40px TALL when it is in a game, which is a deliberate
   exception to the app's 48px floor: these are conveniences beside
   a board, not the action of the screen, and the pill is wide
   enough that the target stays comfortable. */
function TriggerBtn({ onClick, disabled, label, glyph, game }) {
  const { ts } = useI18n();
  const [down, setDown] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      style={{
        ...(game ? NO_SELECT : null),
        minHeight: game ? 36 : A11Y.minTapTargetPx,
        minWidth: game ? 0 : A11Y.minTapTargetPx,
        padding: game ? "6px 14px" : "0 16px",
        borderRadius: game ? 18 : 50,
        border: `1px solid ${game ? GAME.pillEdge : C.warmGray}`,
        background: game ? (down ? GAME.pillPressed : GAME.pill) : C.white,
        color: game ? GAME.ink : C.brown,
        fontSize: ts(game ? 16 : 18),
        fontWeight: 700,
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transform: down ? "translateY(1px)" : "none",
        transition: "transform 100ms ease, background 100ms ease",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: ts(game ? 17 : 20) }}>{glyph}</span>
      {label}
    </button>
  );
}
/* ── The emoji button: a grid of faces, one tap to send ──
   Our sticker set IS our emoji set — hand-drawn, bilingual labels,
   already sized for a 64px cell. A second parallel set of faces would
   be two things to translate and two to keep warm. */
export function EmojiButton({ onSend, disabled, game }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const sending = useRef(false);
  /* Back closes the quick-remark sheet rather than the table
     underneath it. */
  useBackToClose(open, () => setOpen(false));

  const say = (text) => {
    if (sending.current || !text) return;
    sending.current = true;
    setOpen(false);
    Promise.resolve(onSend(text)).finally(() => {
      sending.current = false;
    });
  };

  return (
    <>
      <TriggerBtn
        onClick={() => setOpen(true)}
        disabled={disabled}
        label={t("ludo.quick.emojiOpen")}
        glyph="🙂"
        game={game}
      />
      {open && (
        <Sheet hint={t("ludo.quick.emojiHint")} onClose={() => setOpen(false)}>
          <StickerPicker onPick={(id) => say(stickerRef(id))} label={t("ludo.quick.emojiOpen")} />
        </Sheet>
      )}
    </>
  );
}

/* ── The chat button: ten things people say, one tap each ── */
export default function QuickChat({ onSend, disabled, game }) {
  const { t, ts } = useI18n();
  const [open, setOpen] = useState(false);
  const sending = useRef(false);

  const say = (text) => {
    if (sending.current || !text) return;
    sending.current = true;
    setOpen(false);
    Promise.resolve(onSend(text)).finally(() => {
      sending.current = false;
    });
  };

  return (
    <>
      <TriggerBtn
        onClick={() => setOpen(true)}
        disabled={disabled}
        label={t("ludo.quick.open")}
        glyph="💬"
        game={game}
      />
      {open && (
        <Sheet hint={t("ludo.quick.hint")} onClose={() => setOpen(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {QUICK_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => say(t(`ludo.quick.phrases.${k}`))}
                dir="auto"
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
        </Sheet>
      )}
    </>
  );
}
