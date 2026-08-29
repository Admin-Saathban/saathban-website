/* ════════════════════════════════════════════════
   New game — ONE compact setup screen (the chess.com pattern).

   Seat count as chips (only when the game allows a choice), then the
   three ways to fill the table, then one Start. No paragraphs: a
   single short line of copy, and every option row says what it does
   in three words. The board is the destination — Start goes straight
   there and the waiting happens ON it (SessionPage's waiting room).
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import {
  fetchGames,
  createSession,
  fetchMySessions,
  liveSessionOf,
  inviteToGame,
  startWithBots,
} from "../../lib/games.js";
import { createShare } from "../community/communityData.js";
import PeoplePicker from "./PeoplePicker.jsx";
import OneTableGate from "./OneTableGate.jsx";
import { GamesScreen, Card, BodyText, PrimaryBtn } from "./ui.jsx";

/* One big tappable row: emoji, label, and a ✓ when chosen. Selection
   is border weight + the mark, never colour alone. */
function OptionRow({ emoji, label, chosen, onClick, disabled }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        minHeight: 68,
        padding: "0 18px",
        marginBottom: 10,
        borderRadius: 18,
        border: chosen ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: chosen ? "#eef3e8" : C.white,
        color: C.textMain,
        fontFamily: "inherit",
        fontSize: ts(20),
        fontWeight: 700,
        textAlign: "start",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: ts(26) }}>{emoji}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span aria-hidden="true" style={{ color: C.green, fontSize: ts(22), visibility: chosen ? "visible" : "hidden" }}>✓</span>
    </button>
  );
}

export default function NewGame() {
  const { gameKey } = useParams();
  // Ludo is the one game here with a house rule worth asking about at
  // setup: one die, or the two-dice Desi table. It rides house_rules,
  // exactly as turn_seconds does, and freezes into the game state at
  // start — so a table never changes rules mid-play.
  const [diceCount, setDiceCount] = useState(1);
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [seats, setSeats] = useState(2);
  const [mode, setMode] = useState(null); // people | bots | open
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  // One live table at a time. The refusal belongs HERE, on Start —
  // the moment the second table would actually come into being — not
  // on the way into this screen.
  const [blockedBy, setBlockedBy] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchGames()
      .then((gs) => {
        if (!alive) return;
        const g = gs.find((x) => x.key === gameKey) || null;
        setGame(g);
        if (g) setSeats(g.min_seats);
      })
      .catch(() => alive && setGame(null));
    return () => { alive = false; };
  }, [gameKey]);

  const seatChoices = useMemo(() => {
    if (!game) return [];
    const out = [];
    for (let n = game.min_seats; n <= game.max_seats; n++) out.push(n);
    return out;
  }, [game]);

  // Carrom passes turns rather than playing itself: a bot seat there
  // would be an empty chair with a clock.
  const botsAllowed = game && game.timeout_style !== "pass_turn";
  const canPostOpen = profile.role === "saath_icon" || profile.is_org;
  const pickedStates = Object.fromEntries(picked.map((p) => [p.id, "picked"]));
  const canStart = mode === "bots" || mode === "open" || (mode === "people" && picked.length > 0);

  const start = async () => {
    const inTheWay = liveSessionOf(await fetchMySessions(profile.id).catch(() => []));
    if (inTheWay) {
      setBlockedBy(inTheWay);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (busy || !game || !canStart) return;
    setBusy(true);
    try {
      const id = await createSession(
        game.key,
        seats,
        game.key === "ludo" ? { dice_count: diceCount } : {}
      );
      try { sessionStorage.setItem("saathban.app.freshTable", id); } catch { /* fine */ }

      if (mode === "people") {
        for (const p of picked.slice(0, seats - 1)) {
          try { await inviteToGame(id, p.id); } catch { /* one refusal must not strand the table */ }
        }
      } else if (mode === "bots") {
        await startWithBots(id);
      } else if (mode === "open") {
        await createShare(profile.id, "game_open", id, {
          game_key: game.key,
          name_en: game.name_en,
          name_ur: game.name_ur,
          seats_total: seats,
          seats_taken: 1,
        });
      }
      navigate(`/app/games/s/${id}`, { replace: true });
    } catch {
      pushToast(t("games.actionError"), { tone: "error", key: "games" });
      setBusy(false);
    }
  };

  if (game === null) {
    return (
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
        <BodyText muted role="status">…</BodyText>
      </GamesScreen>
    );
  }

  const name = lang === "ur" ? game.name_ur : game.name_en;

  return (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
      {/* Nastaliq hangs far below the baseline: the heading needs the
          language its own line-height or the descenders hit the line under it. */}
      <h1
        style={{
          fontSize: ts(28),
          fontWeight: 800,
          color: C.brown,
          // Nastaliq descends far below the baseline: give the heading the
          // language's own line-height in RTL (a trimmed one clips into the
          // line beneath), and room under it either way.
          lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
          margin: meta.dir === "rtl" ? "0 0 14px" : "0 0 6px",
        }}
      >
        {name}
      </h1>
      {/* The single line of copy on this screen. */}
      <BodyText muted style={{ margin: "0 0 16px" }}>{t("games.new.hint")}</BodyText>

      {/* One live table at a time: the choice appears here, where the
          second table would have begun. */}
      {blockedBy && (
        <OneTableGate
          live={blockedBy}
          gameName={blockedBy.game_key}
          onCleared={() => {
            setBlockedBy(null);
            start();
          }}
          onDismiss={() => setBlockedBy(null)}
        />
      )}

      {/* Seat chips — only when the game leaves the choice open. */}
      {seatChoices.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <BodyText style={{ fontWeight: 700, margin: "0 0 8px" }}>{t("games.new.players")}</BodyText>
          <div role="radiogroup" aria-label={t("games.new.players")} style={{ display: "flex", gap: 10 }}>
            {seatChoices.map((n) => {
              const on = seats === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setSeats(n);
                    setPicked((cur) => cur.slice(0, n - 1));
                  }}
                  style={{
                    minWidth: 64,
                    minHeight: A11Y.minTapTargetPx + 8,
                    borderRadius: 16,
                    border: on ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
                    background: on ? C.green : C.white,
                    color: on ? C.cream : C.textMain,
                    fontFamily: "inherit",
                    fontSize: ts(22),
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ludo's one setup choice: how many dice. Two dice changes
          the whole feel of the game, so it belongs here, before the
          table exists — not buried in a menu on the board. */}
      {game.key === "ludo" && (
        <div style={{ marginBottom: 18 }}>
          <BodyText style={{ fontWeight: 700, margin: "0 0 4px" }}>{t("ludo.rules.diceCount")}</BodyText>
          <BodyText muted style={{ margin: "0 0 8px" }}>{t("ludo.rules.diceCountHint")}</BodyText>
          <div role="radiogroup" aria-label={t("ludo.rules.diceCount")} style={{ display: "flex", gap: 10 }}>
            {[1, 2].map((n) => {
              const on = diceCount === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDiceCount(n)}
                  style={{
                    flex: 1,
                    minHeight: A11Y.minTapTargetPx + 12,
                    borderRadius: 16,
                    border: on ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
                    background: on ? "#eef3e8" : C.white,
                    color: C.textMain,
                    fontFamily: "inherit",
                    fontSize: ts(19),
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span aria-hidden="true">{n === 2 ? "🎲🎲" : "🎲"}</span>
                  {n === 2 ? t("ludo.rules.diceTwo") : t("ludo.rules.diceOne")}
                  <span aria-hidden="true" style={{ color: C.green, visibility: on ? "visible" : "hidden" }}>✓</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* The three ways to fill a table. */}
      <div role="radiogroup" aria-label={t("games.new.hint")}>
        <OptionRow
          emoji="🫶"
          label={t("games.new.people")}
          chosen={mode === "people"}
          onClick={() => setMode(mode === "people" ? null : "people")}
        />
        {mode === "people" && (
          <Card style={{ marginTop: -4 }}>
            <PeoplePicker
              searchable
              states={pickedStates}
              maxPick={seats - 1}
              pickedCount={picked.length}
              onToggle={(p) =>
                setPicked((cur) =>
                  cur.some((x) => x.id === p.id)
                    ? cur.filter((x) => x.id !== p.id)
                    : cur.length >= seats - 1
                      ? cur
                      : [...cur, p]
                )
              }
            />
          </Card>
        )}

        {botsAllowed && (
          <OptionRow
            emoji="🤖"
            label={t("games.new.bots")}
            chosen={mode === "bots"}
            onClick={() => setMode(mode === "bots" ? null : "bots")}
          />
        )}

        {canPostOpen && (
          <OptionRow
            emoji="🪷"
            label={t("games.new.open")}
            chosen={mode === "open"}
            onClick={() => setMode(mode === "open" ? null : "open")}
          />
        )}
      </div>

      <PrimaryBtn disabled={busy || !canStart} onClick={start} style={{ width: "100%", marginTop: 8 }}>
        {t("games.new.start")}
      </PrimaryBtn>
    </GamesScreen>
  );
}
