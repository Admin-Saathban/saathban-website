/* ════════════════════════════════════════════════
   The setup room — owner-specified in the live designer.

   ESPRESSO, NOT MIDNIGHT. The room and the table are two PLACES, and
   the way a person knows they have gone through a door is that the
   light changed: warm brown here, dark blue lacquer on the other
   side. Same damask on both, so they are recognisably the same
   evening.

   PLUM IS THE ONLY ACCENT, and it means "chosen". The stepper's
   current number, a colour you hold, the Start bar. Nothing else on
   this screen is plum, so plum always answers the same question.

   A SEAT IS A ROW, AND AN EMPTY SEAT IS STILL A ROW. Not a grid of
   avatars with gaps in it, not "3 of 5 joined" — every seat the table
   has is on screen from the moment the table exists, and the ones
   nobody is in yet say "waiting" with three dots moving. An empty
   seat that is drawn is an invitation. An empty seat that is absent
   is a number a person has to do arithmetic on.

   AND IT STARTS BY ITSELF. There is no Start button to press at the
   right moment — game_start_if_full() has always fired the instant
   the last seat fills, so the bar says what will happen ("Start when
   full") rather than pretending to be the thing that causes it. A
   button that looks like the cause of something it does not cause is
   a button people press twice.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../lib/i18n.jsx";
import { startWithBots, createSeatLink } from "../../../lib/games.js";
import { setTable, pickColor } from "./snakesData.js";
import { DEFAULTS, LIMITS, PLAYERS, boardFor, seatColorIdx, freeColors } from "./design.js";
import { colorOf } from "./skins.js";
import { DAMASK_CSS } from "./SnakesBoard.jsx";
import Icon from "../../../components/Icon.jsx";
import useBackToClose from "../../../components/useBackToClose.js";

const PLUM = "#9A4A8E";
const GLASS = "rgba(255,255,255,.07)";

const CSS = `
@keyframes sb-snk-wait {
  0%, 60%, 100% { opacity: .25; transform: translateY(0); }
  30%           { opacity: 1;   transform: translateY(-3px); }
}
.sb-snk-dot { animation: sb-snk-wait 1.25s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .sb-snk-dot { animation: none; opacity: .6; } }
`;

const roomStyle = {
  height: "100dvh",
  minHeight: "100vh",
  maxHeight: "100dvh",
  overflowY: "auto",
  background: `${DAMASK_CSS}, linear-gradient(168deg, #3A2418 0%, #160C07 100%)`,
  backgroundColor: "#160C07",
  color: "#F2ECDF",
  boxSizing: "border-box",
};

/* ── the three animated dots ─────────────────────────────────────── */
function Waiting() {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", gap: 3, alignItems: "flex-end", height: 10 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="sb-snk-dot"
          style={{
            width: 4, height: 4, borderRadius: "50%", background: "#C9BBA8",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

/* ── 2–8, big enough to hit ──────────────────────────────────────── */
function Stepper({ value, min, max, onChange, label, busy }) {
  const { ts } = useI18n();
  const Btn = ({ to, sign, aria }) => (
    <button
      type="button"
      onClick={() => onChange(to)}
      disabled={busy || to < min || to > max}
      aria-label={aria}
      style={{
        width: 56, height: 56, borderRadius: 18, flexShrink: 0,
        background: to < min || to > max ? "rgba(255,255,255,.04)" : GLASS,
        border: "1px solid rgba(255,255,255,.14)",
        color: to < min || to > max ? "#6E6357" : "#F2ECDF",
        fontSize: 30, fontWeight: 700, lineHeight: 1,
        cursor: to < min || to > max ? "default" : "pointer",
      }}
    >
      {sign}
    </button>
  );
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: ts(15), color: "#C9BBA8", textAlign: "center" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Btn to={value - 1} sign="−" aria={`${label} −`} />
        <span style={{
          minWidth: 84, textAlign: "center",
          fontSize: 48, fontWeight: 800, lineHeight: 1,
          color: PLUM,
          fontVariantNumeric: "tabular-nums",
        }}>
          {value}
        </span>
        <Btn to={value + 1} sign="+" aria={`${label} +`} />
      </div>
    </div>
  );
}

function Row({ children, onClick, as = "div" }) {
  const El = onClick ? "button" : as;
  return (
    <El
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", boxSizing: "border-box",
        minHeight: 64, padding: "10px 14px",
        background: GLASS,
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 20,
        color: "#F2ECDF",
        textAlign: "start",
        font: "inherit",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </El>
  );
}

/* ══ HOUSE RULES, on their own screen ════════════════════════════ */
function HouseRules({ board, snakes, ladders, onSnakes, onLadders, canEdit, onBack, busy }) {
  const { t, ts } = useI18n();

  /* THE OTHER SHAPE OF OPEN SURFACE, and the one no audit for
     role="dialog" can see: this is not a sheet over the setup room,
     it REPLACES it. A boolean decides which of two screens renders,
     the trigger only exists while it is closed, and there is no
     dialog, no scrim and no menu anywhere in it.

     So back had no entry to spend and did what it does — left the
     game world altogether, from a screen whose entire visible
     affordance is a back arrow that goes somewhere else. Mounted only
     while open, so the hook takes true. */
  useBackToClose(true, onBack);
  return (
    <div style={{ ...roomStyle, padding: "14px 16px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{CSS}</style>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          minHeight: 48, padding: "0 14px 0 8px", marginBottom: 12,
          background: "none", border: "none", color: "#F2ECDF",
          fontSize: ts(17), fontWeight: 700, cursor: "pointer",
        }}
      >
        <Icon name="back" size={22} />
        {t("snakes.setup.back")}
      </button>

      <h1 style={{ margin: "0 0 16px", fontSize: ts(26), fontWeight: 800 }}>{t("snakes.rules.title")}</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginBottom: 24 }}>
        <Stepper
          value={snakes} min={LIMITS.snakes[0]} max={LIMITS.snakes[1]}
          onChange={onSnakes} busy={busy || !canEdit}
          label={t("snakes.rules.snakeCount")}
        />
        <Stepper
          value={ladders} min={LIMITS.ladders[0]} max={LIMITS.ladders[1]}
          onChange={onLadders} busy={busy || !canEdit}
          label={t("snakes.rules.ladderCount")}
        />
      </div>

      <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.65, fontSize: ts(16), color: "#D8CDBC" }}>
        <li>{t("snakes.rules.dragon")}</li>
        <li>{t("snakes.rules.exact")}</li>
        <li>{t("snakes.rules.walk")}</li>
        <li>{t("snakes.rules.noChain")}</li>
      </ul>

      {!canEdit && (
        <p style={{ marginTop: 18, fontSize: ts(15), color: "#A99C8C" }}>{t("snakes.rules.hostOnly")}</p>
      )}
    </div>
  );
}

/* ══ THE ROOM ════════════════════════════════════════════════════ */
export default function SnakesSetup({ session, myId, onChanged, onLeave }) {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const [screen, setScreen] = useState("setup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkFor, setLinkFor] = useState(null);

  const isHost = session.created_by === myId;
  const seats = session.seats || [];
  const board = useMemo(() => boardFor(session), [session]);

  const [players, setPlayers] = useState(session.seats_total || PLAYERS.default);
  const [snakes, setSnakes] = useState(session.house_rules?.snakes ?? DEFAULTS.snakes);
  const [ladders, setLadders] = useState(session.house_rules?.ladders ?? DEFAULTS.ladders);

  /* Keep the controls honest when somebody else changes the table. */
  useEffect(() => {
    setPlayers(session.seats_total || PLAYERS.default);
    setSnakes(session.house_rules?.snakes ?? DEFAULTS.snakes);
    setLadders(session.house_rules?.ladders ?? DEFAULTS.ladders);
  }, [session.seats_total, session.house_rules?.snakes, session.house_rules?.ladders]);

  const mySeat = seats.find((s) => s.profile_id === myId) || null;
  const filled = seats.filter((s) => s.profile_id || s.is_bot).length;

  /* One write for all three settings — the RPC takes them together
     because the board is derived from two of them and a half-applied
     table is a board that disagrees with its own rule sheet. */
  const push = async (next) => {
    if (!isHost) return;
    setBusy(true);
    setError("");
    try {
      await setTable(session.id, {
        players: next.players ?? players,
        snakes: next.snakes ?? snakes,
        ladders: next.ladders ?? ladders,
      });
      await onChanged();
    } catch (e) {
      setError(e.message || t("snakes.setup.failed"));
      /* Put the controls back where the server actually is. */
      setPlayers(session.seats_total || PLAYERS.default);
      setSnakes(session.house_rules?.snakes ?? DEFAULTS.snakes);
      setLadders(session.house_rules?.ladders ?? DEFAULTS.ladders);
    } finally {
      setBusy(false);
    }
  };

  if (screen === "rules") {
    return (
      <HouseRules
        board={board}
        snakes={snakes}
        ladders={ladders}
        canEdit={isHost}
        busy={busy}
        onSnakes={(v) => { setSnakes(v); push({ snakes: v }); }}
        onLadders={(v) => { setLadders(v); push({ ladders: v }); }}
        onBack={() => setScreen("setup")}
      />
    );
  }

  const free = freeColors(session, seats, mySeat?.seat_no ?? null);

  return (
    <div style={{ ...roomStyle, padding: "10px 16px calc(20px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{CSS}</style>

      {/* ── the way out, and the rules ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <button
          type="button"
          onClick={onLeave}
          aria-label={t("snakes.setup.leave")}
          style={{
            width: 48, height: 48, borderRadius: 14, background: "none",
            border: "none", color: "#F2ECDF", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="back" size={22} />
        </button>
        <button
          type="button"
          onClick={() => setScreen("rules")}
          style={{
            minHeight: 40, padding: "0 14px", borderRadius: 12,
            background: GLASS, border: "1px solid rgba(255,255,255,.12)",
            color: "#E6DCCB", fontSize: ts(14), fontWeight: 700, cursor: "pointer",
          }}
        >
          {t("snakes.rules.title")}
        </button>
      </div>

      <h1 style={{ margin: "0 0 18px", fontSize: ts(27), fontWeight: 800, textAlign: "center" }}>
        {t("snakes.title")}
      </h1>

      {/* ── how many are playing ── */}
      <div style={{ marginBottom: 22 }}>
        <Stepper
          value={players}
          min={Math.max(PLAYERS.min, filled)}
          max={PLAYERS.max}
          busy={busy || !isHost}
          onChange={(v) => { setPlayers(v); push({ players: v }); }}
          label={t("snakes.setup.players")}
        />
      </div>

      {/* ── the table ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {/* SEATS ARE 1-BASED. create_game_session sits the host in seat
            1, and game_seats refuses a seat 0 outright — which is how
            this was found. An EMPTY seat is not a row at all
            (game_seats_check makes a row with nobody in it declare
            itself a bot), so the chairs are drawn from seats_total and
            a row is looked up for each; the ones with no row are the
            ones still waiting. */}
        {Array.from({ length: players }, (_, k) => {
          const i = k + 1;
          const seat = seats.find((s) => s.seat_no === i) || null;
          const taken = seat && (seat.profile_id || seat.is_bot);
          const c = colorOf(seatColorIdx(session, i));
          const isMine = seat && seat.profile_id === myId;
          return (
            <Row key={i}>
              {taken ? (
                <span style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(150deg, ${c.light}, ${c.body} 60%, ${c.deep})`,
                  color: c.ink, fontWeight: 800, fontSize: 18,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  {(seat.name || (seat.is_bot ? t("games.board.bot") : "?")).trim().charAt(0).toUpperCase()}
                </span>
              ) : (
                <span style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  border: "2px dashed rgba(255,255,255,.28)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Waiting />
                </span>
              )}

              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: "block", fontSize: ts(17), fontWeight: 700,
                  color: taken ? "#F2ECDF" : "#A99C8C",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {taken
                    ? (seat.name || (seat.is_bot ? t("games.board.bot") : t("msg.someone")))
                    : t("snakes.setup.waiting")}
                </span>
                {isMine && <span style={{ fontSize: ts(13), color: PLUM, fontWeight: 700 }}>{t("snakes.setup.you")}</span>}
              </span>

              {/* THE ONLY PLACE COLOUR IS EVER A CHOICE. Offered on
                  your own row, when you sit down, out of what is
                  still free — never as a setting on a settings
                  screen, because it is not a preference, it is which
                  piece is yours. */}
              {isMine && (
                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {[seatColorIdx(session, i), ...free].slice(0, 4).map((ci, k) => {
                    const cc = colorOf(ci);
                    const chosen = ci === seatColorIdx(session, i);
                    return (
                      <button
                        key={`${ci}-${k}`}
                        type="button"
                        aria-label={t(`snakes.color.${cc.key}`)}
                        aria-pressed={chosen}
                        onClick={async () => {
                          try { await pickColor(session.id, ci); await onChanged(); }
                          catch (e) { setError(e.message); }
                        }}
                        style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: cc.body,
                          border: chosen ? `3px solid ${PLUM}` : "2px solid rgba(255,255,255,.25)",
                          cursor: "pointer", padding: 0,
                        }}
                      />
                    );
                  })}
                </span>
              )}
            </Row>
          );
        })}
      </div>

      {/* ── filling the empty seats ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        <Row onClick={() => navigate(`/app/games/new/snakes?session=${session.id}`)}>
          <Icon name="people" size={22} style={{ flexShrink: 0, color: "#C9BBA8" }} />
          <span style={{ fontSize: ts(17), fontWeight: 700 }}>{t("snakes.setup.fromCommunity")}</span>
        </Row>
        <Row
          onClick={async () => {
            const empty = seats.find((s) => !s.profile_id && !s.is_bot);
            if (!empty) return;
            try {
              const token = await createSeatLink(session.id, empty.seat_no);
              setLinkFor(`${window.location.origin}/app/games/join/${token}`);
            } catch (e) { setError(e.message); }
          }}
        >
          <Icon name="invite" size={22} style={{ flexShrink: 0, color: "#C9BBA8" }} />
          <span style={{ fontSize: ts(17), fontWeight: 700 }}>{t("snakes.setup.sendLink")}</span>
        </Row>
        <Row
          onClick={async () => {
            setBusy(true);
            try { await startWithBots(session.id); await onChanged(); }
            catch (e) { setError(e.message); }
            finally { setBusy(false); }
          }}
        >
          <Icon name="dice" size={22} style={{ flexShrink: 0, color: "#C9BBA8" }} />
          <span style={{ fontSize: ts(17), fontWeight: 700 }}>{t("snakes.setup.fillBots")}</span>
        </Row>
      </div>

      {linkFor && (
        <p style={{
          fontSize: ts(14), color: "#D8CDBC", wordBreak: "break-all",
          background: GLASS, padding: 12, borderRadius: 14, margin: "0 0 14px",
        }}>
          {linkFor}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: "#F0A5A5", fontSize: ts(15), margin: "0 0 12px" }}>{error}</p>
      )}

      {/* ── what happens next ── */}
      <div
        style={{
          width: "100%", boxSizing: "border-box",
          minHeight: 60, borderRadius: 20,
          background: PLUM,
          color: "#fff", fontSize: ts(19), fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: busy ? 0.6 : 1,
        }}
        role="status"
      >
        {t("snakes.setup.startWhenFull")}
      </div>
      <p style={{ textAlign: "center", fontSize: ts(14), color: "#A99C8C", margin: "8px 0 0" }}>
        {t("snakes.setup.seatsLeft", { n: Math.max(0, players - filled) })}
      </p>
    </div>
  );
}
