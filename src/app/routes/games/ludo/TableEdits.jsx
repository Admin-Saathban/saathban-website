/* ════════════════════════════════════════════════
   Changing the table AT the table — GAMES_IMMERSION_SPEC §8.

   "Seats, invites, colour, one-die-or-two and the table name are all
   changed at the table, by tapping the thing itself."

   THE THING ITSELF IS THE POINT, so there is no settings screen here
   and no gear icon. You tap a seat and the sheet that opens is about
   THAT seat: sit in it, ask someone to it, or change how many seats
   the table has. You tap the name and it becomes a field. You tap
   the spare die and there are two dice.

   The window this is allowed in belongs to the server
   (game_table_is_soft, 0092): set, but not yet played. The board
   hides these taps once the first die is thrown, and the RPCs refuse
   them anyway — the hiding is manners, not the rule.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { GAME } from "../gameSurface.js";
import { SEAT_COLORS, SEAT_INK } from "./board.js";
/* The names, from where the hexes are — never a second list. */
import { SEAT_COLOR_NAMES } from "../seatColors.js";
import { reformTable, takeSeat, inviteToSeat, fetchAskable } from "./ludoRails.js";

/* One row in the sheet. 56px, full width, no icon-only anything —
   the same floor the rest of the app keeps (A11Y). */
function Row({ onClick, children, tone = "plain", disabled }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: 56,
        padding: "10px 14px",
        borderRadius: 14,
        border: `1px solid ${tone === "plain" ? GAME.controlEdge : "transparent"}`,
        background: tone === "plain" ? GAME.control : C.green,
        color: tone === "plain" ? GAME.ink : C.cream,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 700,
        textAlign: "start",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* The sheet itself. Dark, on the table, and it closes on the
   backdrop — nothing in it can lose anything, so nothing in it
   asks twice. */
function Sheet({ title, onClose, children }) {
  const { ts, meta } = useI18n();
  const box = useRef(null);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(10,4,7,0.62)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          boxSizing: "border-box",
          width: "100%",
          maxWidth: 520,
          maxHeight: "78vh",
          overflowY: "auto",
          padding: "14px 14px 22px",
          borderRadius: "20px 20px 0 0",
          background: GAME.surface,
          border: `1px solid ${GAME.controlEdge}`,
          borderBottom: "none",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          outline: "none",
        }}
      >
        <p
          style={{
            margin: "2px 0 6px",
            fontFamily: meta.fonts.heading,
            fontSize: ts(22),
            fontWeight: 700,
            color: GAME.ink,
          }}
        >
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

/* ── The seat sheet ──────────────────────────────────────────────
   Opened by tapping a seat. Everything in it is about that seat,
   except the table-size row, which is about the seat in the truest
   way available: how many of them there are. */
export default function SeatSheet({ sessionId, seat, row, seats, seatsTotal, iAmHost, onClose, onChanged }) {
  const { t, ts } = useI18n();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [people, setPeople] = useState(null);
  const [note, setNote] = useState("");

  const colour = SEAT_COLORS[seat];
  const isBot = !!row?.is_bot;

  const act = async (fn) => {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      await fn();
      await onChanged?.();
      onClose();
    } catch (e) {
      /* The server's own sentence, not a code. It is written for the
         person: "The game has begun — this cannot be changed now". */
      setNote(e?.message || t("ludo.table.failed"));
      setBusy(false);
    }
  };

  const openAsk = async () => {
    setAsking(true);
    if (people === null) setPeople(await fetchAskable());
  };

  const sizes = [2, 3, 4];

  return (
    <Sheet title={t("ludo.table.seatTitle", {
        colour: t(`games.setup.colour.${SEAT_COLOR_NAMES[seat]}`),
      })} onClose={onClose}>
      {note && (
        <p role="alert" style={{ margin: "0 0 4px", fontSize: ts(16), fontWeight: 700, color: "#FFD8C2" }}>
          {note}
        </p>
      )}

      {asking ? (
        <>
          {people === null ? (
            <p style={{ margin: 0, color: GAME.inkMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>
          ) : people.length === 0 ? (
            /* NOBODY TO ASK IS A DOOR, NOT A SCOREBOARD (CLAUDE.md).
               An Icon who has connected with no one meets a sentence
               about the bots being good company, not an empty list
               implying they should have people. */
            <p style={{ margin: 0, color: GAME.inkMuted, fontSize: ts(A11Y.minBodyPx), lineHeight: 1.5 }}>
              {t("ludo.table.noOneYet")}
            </p>
          ) : (
            people.map((p) => (
              <Row key={p.id} disabled={busy} onClick={() => act(() => inviteToSeat(sessionId, p.id, seat))}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 34,
                    height: 34,
                    flex: "0 0 auto",
                    borderRadius: 17,
                    background: colour,
                    color: SEAT_INK[seat],
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                  }}
                >
                  {(p.name || "·").trim().charAt(0).toUpperCase()}
                </span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name || t("ludo.seat.someone")}
                </span>
              </Row>
            ))
          )}
          <Row onClick={() => setAsking(false)}>← {t("ludo.table.back")}</Row>
        </>
      ) : (
        <>
          {isBot && (
            <Row tone="green" disabled={busy} onClick={() => act(() => takeSeat(sessionId, seat))}>
              {t("ludo.table.sitHere")}
            </Row>
          )}
          {isBot && iAmHost && (
            <Row disabled={busy} onClick={openAsk}>
              {t("ludo.table.askSomeone")}
            </Row>
          )}

          {iAmHost && (
            <>
              <p
                style={{
                  margin: "8px 2px 2px",
                  fontSize: ts(15),
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: GAME.inkMuted,
                }}
              >
                {t("ludo.table.howMany")}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {sizes.map((n) => {
                  const on = n === seatsTotal;
                  /* A size that would leave somebody off the board is
                     not offered. The server refuses it too — it keeps
                     the floor at the highest seat a PERSON holds — but
                     a button that quietly does nothing is worse than
                     one that is plainly not available. */
                  const floor = Math.max(2, ...seats.filter((s) => !s.is_bot).map((s) => s.seat + 1));
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={busy || n < floor}
                      aria-pressed={on}
                      onClick={() => act(() => reformTable(sessionId, { seats: n }))}
                      style={{
                        flex: 1,
                        minHeight: 56,
                        borderRadius: 14,
                        border: on ? `2px solid ${C.green}` : `1px solid ${GAME.controlEdge}`,
                        background: on ? C.green : GAME.control,
                        color: on ? C.cream : GAME.ink,
                        fontSize: ts(20),
                        fontWeight: 800,
                        opacity: n < floor ? 0.35 : 1,
                        cursor: n < floor ? "default" : "pointer",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <Row onClick={onClose}>{t("ludo.table.done")}</Row>
        </>
      )}
    </Sheet>
  );
}

/* ── The table's name ────────────────────────────────────────────
   Tap the name, type, done. No dialog: the name IS the field, which
   is the whole of "tapping the thing itself" for a piece of text. */
export function TableName({ sessionId, title, editable, onChanged }) {
  const { t, ts } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title || "");
  const input = useRef(null);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  useEffect(() => {
    setDraft(title || "");
  }, [title]);

  const commit = async () => {
    setEditing(false);
    if ((draft || "").trim() === (title || "").trim()) return;
    try {
      await reformTable(sessionId, { title: draft });
      await onChanged?.();
    } catch {
      setDraft(title || "");
    }
  };

  const base = {
    fontSize: ts(A11Y.minBodyPx),
    fontWeight: 700,
    minWidth: 0,
    maxWidth: "58vw",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        maxLength={40}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(title || "");
            setEditing(false);
          }
        }}
        aria-label={t("ludo.table.nameLabel")}
        style={{
          ...base,
          padding: "6px 10px",
          borderRadius: 10,
          border: `1px solid ${GAME.controlEdge}`,
          background: GAME.control,
          color: GAME.ink,
        }}
      />
    );
  }

  if (!editable) {
    return title ? <p style={{ ...base, margin: 0, color: C.greenMuted }}>{title}</p> : null;
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={t("ludo.table.nameLabel")}
      style={{
        ...base,
        margin: 0,
        padding: "6px 10px",
        minHeight: 44,
        borderRadius: 10,
        border: `1px dashed ${title ? "transparent" : GAME.controlEdge}`,
        background: "transparent",
        color: title ? GAME.ink : GAME.inkMuted,
        textAlign: "start",
        cursor: "pointer",
      }}
    >
      {title || t("ludo.table.nameIt")}
    </button>
  );
}
