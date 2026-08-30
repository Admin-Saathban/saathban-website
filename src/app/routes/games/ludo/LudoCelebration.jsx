/* ════════════════════════════════════════════════
   "Well played" — LUDO_UI_SPEC.md §8.

   A warm FULL-SCREEN moment, not a modal sitting on the board. The
   game is over; the board has nothing left to say, and leaving it
   visible behind a dialog asks the eye to keep reading a finished
   position.

   WHAT IS CELEBRATED, AND WHAT IS NOT. The winner is crowned and
   enlarged, because winning is a real thing that happened. Everybody
   else is here too, by name, under "also at the table" — NOT ranked
   second, third, fourth. §9 rules out ranks and leaderboards, and
   CLAUDE.md is firmer still: points reward participation, never
   performance. So the one line about points says exactly that, and
   there is no number attached to any face.

   No coins, no gems, no "watch a video", no purchase of any kind
   (§9). The reference's interaction design is the model; its economy
   is not.

   The seat colours are read LIVE from SEAT_COLORS rather than
   snapshotted — that mapping was re-phased twice in one day, and a
   crowned winner in last week's colour would be a small betrayal of
   the whole point of the screen.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { SEAT_COLORS, SEAT_INK } from "../seatColors.js";
import BoastSheet from "../BoastSheet.jsx";

function initialOf(name) {
  const s = (name || "").trim();
  if (!s) return "•";
  return [...s][0].toUpperCase();
}

function Face({ seat, name, size, crowned, crownLabel }) {
  const { ts } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
      <div style={{ position: "relative", lineHeight: 0 }}>
        {crowned && (
          <span
            role="img"
            aria-label={crownLabel}
            style={{
              position: "absolute",
              top: -Math.round(size * 0.42),
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: Math.round(size * 0.5),
              lineHeight: 1,
              filter: "drop-shadow(0 2px 3px rgba(45,36,24,0.3))",
            }}
          >
            👑
          </span>
        )}
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: size,
            height: size,
            borderRadius: "50%",
            background: SEAT_COLORS[seat],
            color: SEAT_INK[seat],
            fontWeight: 800,
            fontSize: Math.round(size * 0.42),
            border: `${crowned ? 4 : 3}px solid ${C.white}`,
            boxShadow: crowned
              ? `0 6px 20px ${SEAT_COLORS[seat]}55`
              : "0 2px 8px rgba(45,36,24,0.16)",
          }}
        >
          {initialOf(name)}
        </span>
      </div>
      <span
        dir="auto"
        style={{
          fontSize: ts(crowned ? 22 : A11Y.minBodyPx),
          fontWeight: crowned ? 700 : 600,
          color: C.textMain,
          maxWidth: crowned ? 240 : 116,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </div>
  );
}

function Action({ onClick, disabled, children, primary }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 60,
        borderRadius: 50,
        border: primary ? "none" : `2px solid ${C.warmGray}`,
        background: primary ? C.green : C.white,
        color: primary ? C.cream : C.textMain,
        fontSize: ts(19),
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function LudoCelebration({
  seats,
  winnerSeat,
  myId,
  seatName,
  sessionId,
  pieces,
  seatsInPlay,
  onRematch,
  onBack,
  busy,
}) {
  const { t, ts, meta } = useI18n();
  const headingRef = useRef(null);

  /* The screen announces itself once. Without this a screen-reader
     user is left on whatever the board last said while the sighted
     half of the room is looking at a crown. */
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const winner = seats.find((s) => s.seat === winnerSeat);
  const others = seats.filter((s) => s.seat !== winnerSeat);
  const iWon = winner?.profile_id === myId;
  /* Nobody to name. Not a sad version of the celebration — a different
     and honest screen, which does not claim anything about a table
     this person was not sitting at. */
  const watching = seats.length === 0;
  const [sheet, setSheet] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("ludo.celebrate.title")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: C.cream,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "32px 20px calc(32px + env(safe-area-inset-bottom, 0px))",
        textAlign: "center",
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(38),
          fontWeight: 700,
          color: C.green,
          margin: 0,
          outline: "none",
        }}
      >
        {watching ? t("ludo.celebrate.overTitle") : t("ludo.celebrate.title")}
      </h1>

      {winner && (
        <>
          <div style={{ marginTop: 10 }}>
            <Face
              seat={winner.seat}
              name={seatName(winner, t)}
              size={104}
              crowned
              crownLabel={t("ludo.celebrate.crown")}
            />
          </div>
          <p style={{ margin: 0, fontSize: ts(21), fontWeight: 600, color: C.textMain, maxWidth: 460 }}>
            {iWon
              ? t("ludo.celebrate.youWon")
              : t("ludo.celebrate.theyWon", { name: seatName(winner, t) })}
          </p>
        </>
      )}

      {others.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <p style={{ margin: "0 0 10px", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, fontWeight: 600 }}>
            {t("ludo.celebrate.alsoPlayed")}
          </p>
          <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap" }}>
            {others.map((s) => (
              <Face key={s.seat} seat={s.seat} name={seatName(s, t)} size={58} />
            ))}
          </div>
        </div>
      )}

      {/* The only thing said about points, and it is said about
          everybody at once. No number, no rank, no comparison. */}
      <p style={{ margin: "6px 0 0", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, maxWidth: 420, lineHeight: 1.5 }}>
        {watching ? t("ludo.celebrate.overNote") : t("ludo.celebrate.warmth")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 420, marginTop: 8 }}>
        {!watching && sessionId && (
          <Action onClick={() => setSheet(true)} disabled={busy} primary>
            📣 {t("ludo.boast.cta")}
          </Action>
        )}
        {onRematch && (
          <Action onClick={onRematch} disabled={busy}>
            🔁 {t("ludo.celebrate.rematchCta")}
          </Action>
        )}
        <Action onClick={onBack} disabled={busy}>
          {t("ludo.celebrate.backCta")}
        </Action>
      </div>

      {sheet && (
        <BoastSheet
          open
          onClose={() => setSheet(false)}
          sessionId={sessionId}
          players={seats.map((s) => ({
            seat: s.seat,
            name: seatName(s, t),
            photoUrl: s.avatar_url || null,
            isWinner: s.seat === winnerSeat,
          }))}
          pieces={pieces}
          seatsInPlay={seatsInPlay}
        />
      )}
    </div>
  );
}
