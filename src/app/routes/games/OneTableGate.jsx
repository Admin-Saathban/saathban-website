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
   gameName: its human name. onCleared: called once the way is clear. */
export default function OneTableGate({ live, gameName, onCleared, onDismiss }) {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await leaveSession(live.id);
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
