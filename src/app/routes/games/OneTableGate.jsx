/* ════════════════════════════════════════════════
   One live table at a time.

   A person may be at exactly one game — waiting for players counts,
   because a table with empty seats is still a promise to somebody.
   When they try to start or join a second, this is the choice they
   get: finish the one they have, or leave it and start this one.
   Both buttons do what they say — "leave" goes through
   leave_game_session (0040), which cancels a lobby they host, frees
   their seat in a lobby they joined, and hands their seat to a bot in
   a game already in play so nobody is left staring at a hole.

   Written as a shared component because the refusal has to appear
   everywhere a second table can begin: the setup screen's Start, the
   home's join-by-code, and any open-table tap.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { leaveSession } from "../../lib/games.js";
import { Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";
import BoardThumb from "./BoardThumb.jsx";

/* live: the session standing in the way (with .game_key, .status).
   gameName: its human name. all: every live table, when there is more
   than one. onCleared: called once the way is clear.

   TONIGHT §3.3 — "the user had to cancel the same game repeatedly
   before it went." They were not cancelling the same game. Leaving
   cleared ONE table, the caller immediately re-checked, found the next
   one, and put up a card that looked identical — same title, same
   words, and in the setup screen's case the same raw game key. Four
   tables meant four rounds of a dialog that gave no sign anything had
   happened. Nothing was failing; the screen was just refusing to say
   how many there were.

   So: one tap clears them all, and if there is more than one the card
   says so before it is tapped. */
export default function OneTableGate({ live, gameName, all, onCleared, onDismiss }) {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const queue = all && all.length ? all : [live];

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      /* In series, not in parallel: leaving a lobby you host cancels it
         and notifies everyone, and firing four of those at once is a
         burst of writes for no gain. One failure stops the rest rather
         than half-clearing the way and reporting success. */
      for (const s of queue) {
        await leaveSession(s.id);
      }
      onCleared();
    } catch {
      setError(t("games.actionError"));
      setBusy(false);
    }
  };

  return (
    <Card style={{ borderColor: C.brown, borderWidth: 2 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 10 }}>
        <BoardThumb gameKey={live.game_key} size={56} />
        <p style={{ fontSize: ts(20), fontWeight: 700, margin: 0 }}>
          {t("games.oneTable.title", { game: gameName })}
        </p>
      </div>
      <BodyText muted>{t("games.oneTable.body")}</BodyText>
      {/* Said before the tap, so one press clearing four tables is not
          a surprise — and so the person knows why the card came back
          the last four times. */}
      {queue.length > 1 && (
        <BodyText style={{ fontWeight: 700, color: C.brown }}>
          {t("games.oneTable.several", { n: queue.length })}
        </BodyText>
      )}
      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {error}
        </BodyText>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <PrimaryBtn disabled={busy} onClick={() => navigate(`/app/games/s/${live.id}`)}>
          {t("games.oneTable.finishCta")}
        </PrimaryBtn>
        <GhostBtn disabled={busy} onClick={leave}>
          {t("games.oneTable.leaveCta")}
        </GhostBtn>
        {onDismiss && (
          <GhostBtn disabled={busy} onClick={onDismiss}>
            {t("outdoor.place.formCancel")}
          </GhostBtn>
        )}
      </div>
    </Card>
  );
}
