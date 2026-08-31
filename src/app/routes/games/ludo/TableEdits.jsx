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
import { APP_COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { useSession } from "../../../lib/session.jsx";
import { GAME } from "../gameSurface.js";
import { SEAT_COLORS, SEAT_INK } from "./board.js";
/* The names, from where the hexes are — never a second list. */
import { SEAT_COLOR_NAMES } from "../seatColors.js";
import { reformTable, takeSeat, inviteToSeat, fetchAskable, fetchPieceMarks, setPieceMarks } from "./ludoRails.js";
import ShareTableButton from "../ShareTableButton.jsx";
import { createShare } from "../../community/communityData.js";

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


/* ── YOUR OWN FOUR (0095) ──────────────────────────────────────
   The owner's oldest complaint was that you cannot tell which of
   your gotis is which. They asked for the mark to be choosable —
   "you can name each goti if you want… change or design their own
   emojis" — and were equally clear about the limit: "color should
   mainly be the same respective ie blue red yellow green which was
   assigned originally". So this changes what is WRITTEN on a goti
   and never what colour it is.

   It lives on your own seat and nowhere else, and unlike the rest
   of this sheet it is not confined to the soft window: your gotis
   are yours, not the table's, and a preference you can only change
   in the thirty seconds before your first roll is a preference
   nobody will ever change. */
const PALETTE = ["", "\u2618", "\u2600", "\u2764", "\u2605", "\u266A", "\u265B", "\u2693", "\u2708", "\u26BD", "\u2615", "\u273F"];

function GotiMarks({ seat, myId, onSaved }) {
  const { t, ts } = useI18n();
  const [marks, setMarks] = useState(null);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPieceMarks([myId])
      .then((m) => alive && setMarks((m.get(myId) || ["", "", "", ""]).slice(0, 4)))
      .catch(() => alive && setMarks(["", "", "", ""]));
    return () => {
      alive = false;
    };
  }, [myId]);

  const put = async (i, glyph) => {
    if (busy) return;
    const next = [0, 1, 2, 3].map((n) => (n === i ? glyph : marks?.[n] || ""));
    setMarks(next);
    setSlot(null);
    setBusy(true);
    try {
      await setPieceMarks(next);
      await onSaved?.();
    } catch {
      /* the board simply keeps the marks it had */
    }
    setBusy(false);
  };

  const colour = SEAT_COLORS[seat];
  const ink = SEAT_INK[seat];

  return (
    <>
      <p
        style={{
          margin: "10px 2px 2px",
          fontSize: ts(15),
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: GAME.inkMuted,
        }}
      >
        {t("ludo.table.myGotis")}
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSlot(slot === i ? null : i)}
            aria-pressed={slot === i}
            aria-label={t("ludo.table.gotiSlot", { n: i + 1 })}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 28,
              /* THE COLOUR IS NOT A CHOICE HERE. Each slot is drawn
                 in the seat's own colour so it is plain that the
                 mark is the only thing being changed. */
              background: colour,
              color: ink,
              border: slot === i ? `3px solid ${C.cream}` : `3px solid transparent`,
              fontSize: ts(24),
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {marks?.[i] || i + 1}
          </button>
        ))}
      </div>
      {slot != null && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {PALETTE.map((glyph, n) => (
            <button
              key={n}
              type="button"
              onClick={() => put(slot, glyph)}
              aria-label={glyph || t("ludo.table.gotiPlain")}
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                border: `1px solid ${GAME.controlEdge}`,
                background: GAME.control,
                color: GAME.ink,
                fontSize: ts(22),
                cursor: "pointer",
              }}
            >
              {glyph || String(slot + 1)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
/* ── The house rules, at the table (TASK 5) ─────────────────────
   Four switches, each one a rule people actually argue about at a
   real table. They write straight into house_rules, which is what
   ludo_state_init reads at the first roll — so while the table is
   soft they are live, and after that they are frozen into the
   game's own state and cannot be changed under anybody. That is
   the same window the rest of this sheet lives in, and it is why
   this is safe to offer without a confirm. */
const RULES = [
  ["extra_roll_on_six", "ludo.rules.extraRoll", true],
  ["exact_home", "ludo.rules.exactHome", true],
  ["capture_before_home", "ludo.rules.captureFirst", false],
  ["undo", "games.setup.undoOn", true],
];

function HouseRules({ sessionId, rules, onChanged }) {
  const { t, ts } = useI18n();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(() => rules || {});

  const flip = async (key, next) => {
    if (busy) return;
    setBusy(true);
    setLocal((r) => ({ ...r, [key]: next }));
    try {
      await reformTable(sessionId, { houseRules: { [key]: next } });
      await onChanged?.();
    } catch {
      setLocal((r) => ({ ...r, [key]: !next }));
    }
    setBusy(false);
  };

  return (
    <>
      <p
        style={{
          margin: "10px 2px 2px",
          fontSize: ts(15),
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: GAME.inkMuted,
        }}
      >
        {t("ludo.rules.title")}
      </p>
      {RULES.map(([key, labelKey, dflt]) => {
        const on = local[key] === undefined ? dflt : !!local[key];
        return (
          <button
            key={key}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={() => flip(key, !on)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              width: "100%",
              minHeight: 56,
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 14,
              border: `1px solid ${GAME.controlEdge}`,
              background: GAME.control,
              color: GAME.ink,
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 700,
              textAlign: "start",
              cursor: "pointer",
            }}
          >
            <span style={{ minWidth: 0 }}>{t(labelKey)}</span>
            {/* Never colour alone: the pill says the word as well as
                sliding, because on/off by hue is unreadable to a
                good number of people. */}
            <span
              aria-hidden="true"
              style={{
                flex: "0 0 auto",
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: ts(15),
                fontWeight: 800,
                background: on ? C.green : "rgba(255,255,255,0.12)",
                color: on ? C.cream : GAME.inkMuted,
              }}
            >
              {on ? t("circle.toggle.on") : t("circle.toggle.off")}
            </span>
          </button>
        );
      })}
    </>
  );
}
/* ── The seat sheet ──────────────────────────────────────────────
   Opened by tapping a seat. Everything in it is about that seat,
   except the table-size row, which is about the seat in the truest
   way available: how many of them there are. */
export default function SeatSheet({ sessionId, seat, row, seats, seatsTotal, iAmHost, myId, rules = null, joinCode = null, soft = true, onClose, onChanged }) {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  /* Icons post; everyone else reads. Organisations too, which is the
     same test SessionPage applies for its own open table — taken
     from there rather than invented here. */
  const canPost = profile?.role === "saath_icon" || profile?.is_org;
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [people, setPeople] = useState(null);
  const [note, setNote] = useState("");
  const [posted, setPosted] = useState(false);

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
          {isBot && soft && (
            <Row tone="green" disabled={busy} onClick={() => act(() => takeSeat(sessionId, seat))}>
              {t("ludo.table.sitHere")}
            </Row>
          )}
          {/* A LINK, which is the fourth way somebody gets a seat
              (a person you name, a bot, the community, or a link).
              The code is on the table for reading aloud down a
              telephone, and the button hands the same thing to
              WhatsApp. LTR-pinned so the digits do not reverse. */}
          {isBot && iAmHost && soft && joinCode && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <p
                dir="ltr"
                aria-label={joinCode.split("").join(" ")}
                style={{ margin: "2px 0 8px", fontSize: ts(34), fontWeight: 800, letterSpacing: "0.3em", color: GAME.ink }}
              >
                {joinCode}
              </p>
              <ShareTableButton code={joinCode} compact />
            </div>
          )}

          {isBot && iAmHost && soft && (
            <Row disabled={busy} onClick={openAsk}>
              {t("ludo.table.askSomeone")}
            </Row>
          )}

          {/* AND THE COMMUNITY, which is the fourth way into a seat
              and the last one still missing from this table: a
              person you name, a bot, a link, or anybody who sees
              it. It posts an open invitation to the feed; the seat
              stays a bot's until somebody takes it, so the table
              does not stall while the post sits there.

              Icons post and everyone else reads (CLAUDE.md), so
              this is offered to an Icon and not to a Fam member
              who happens to be hosting — the same rule the other
              games' lobby already follows, rather than a new one
              invented here. */}
          {isBot && iAmHost && soft && canPost && !posted && (
            <Row
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await createShare(myId, "game_open", sessionId, {
                    game_key: "ludo",
                    seats_total: seatsTotal,
                    seats_taken: seats.filter((x) => !x.is_bot).length,
                  });
                  setPosted(true);
                })
              }
            >
              {t("games.lobby.openPostCta")}
            </Row>
          )}
          {posted && (
            <p style={{ margin: "6px 2px 0", fontSize: ts(16), color: GAME.inkMuted }}>
              {t("games.lobby.openPosted")}
            </p>
          )}

          {/* My own seat: what I wear on my four. Not gated on the
              soft window — see GotiMarks. */}
          {row?.profile_id && row.profile_id === myId && (
            <GotiMarks seat={seat} myId={myId} onSaved={onChanged} />
          )}

          {iAmHost && soft && <HouseRules sessionId={sessionId} rules={rules} onChanged={onChanged} />}

          {iAmHost && soft && (
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
