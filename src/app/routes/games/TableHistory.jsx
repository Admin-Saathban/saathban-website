/* ═════════════════════════════════════════════════
   D2 — the tables you have played.

   The backlog's constraint is the whole design: "warm, never a
   performance record." So this page shows WHO was there, WHEN, and
   WHICH GAME — and never who won, never a total, never a streak.
   Nothing on it can be read as a scoreboard, because a person who
   loses most Sundays should be able to open this page and see eleven
   afternoons with their daughter rather than eleven defeats.

   Tapping a row opens that table again, which for a finished game is
   its celebration screen — and that is where the boast card lives, so
   the card D2 asks for is one tap away rather than duplicated here.

   The empty state is a door, not a scoreboard (SPEC): somebody who
   has played nothing yet is offered a game, not told they have none.
   ═════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { fetchTableHistory, fetchGames } from "../../lib/games.js";
import BoardThumb from "./BoardThumb.jsx";
import { GamesScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn } from "./ui.jsx";

const PAGE = 20;

function gameName(g, lang) {
  if (!g) return null;
  return lang === "ur" ? g.name_ur : g.name_en;
}

/* "You and Fatima", "You, Fatima and Iqbal", "You and a friendly bot".
   Names, in the order they sat. A bot is named warmly rather than
   labelled, because "Bot" in a memory of an afternoon reads as a
   person who wasn't there. */
function whoPlayed(players, t, lang) {
  /* You first, always. Seat order is the board's business; this is
     your own history, and "a friendly bot and You" reads like a list
     someone else wrote about you. */
  const ordered = [...players].sort((a, b) => (a.is_me === b.is_me ? 0 : a.is_me ? -1 : 1));
  const parts = ordered.map((p) =>
    p.is_me ? t("games.history.you") : p.is_bot ? t("games.history.aBot") : p.name || t("games.history.someone")
  );
  if (parts.length <= 1) return parts[0] || "";
  const last = parts[parts.length - 1];
  // Urdu lists separate with the Arabic comma, not the Latin one.
  const sep = lang === "ur" ? "، " : ", ";
  return t("games.history.and", { list: parts.slice(0, -1).join(sep), last });
}

export default function TableHistory() {
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();

  const [rows, setRows] = useState(null);
  const [games, setGames] = useState([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchTableHistory(profile.id, { limit: PAGE }), fetchGames().catch(() => [])])
      .then(([list, gs]) => {
        if (!alive) return;
        setRows(list);
        setGames(gs);
        setMore(list.length === PAGE);
      })
      /* A history that will not load says so and offers a retry. It
         must never render as "you have played nothing", which is a
         different and much sadder sentence. */
      .catch(() => alive && (setRows([]), setFailed(true)));
    return () => {
      alive = false;
    };
  }, [profile.id]);

  const loadMore = async () => {
    if (busy || !rows?.length) return;
    setBusy(true);
    try {
      const last = rows[rows.length - 1];
      const next = await fetchTableHistory(profile.id, { limit: PAGE, before: last.finished_at });
      setRows((cur) => [...cur, ...next]);
      setMore(next.length === PAGE);
    } catch {
      setMore(false);
    }
    setBusy(false);
  };

  const byKey = Object.fromEntries(games.map((g) => [g.key, g]));
  const when = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(28),
          fontWeight: 800,
          color: C.brown,
          lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
          margin: "0 0 4px",
        }}
      >
        {t("games.history.title")}
      </h1>
      <BodyText muted style={{ margin: "0 0 18px" }}>
        {t("games.history.subtitle")}
      </BodyText>

      {rows === null && <BodyText muted role="status">…</BodyText>}

      {rows !== null && rows.length === 0 && (
        <Card>
          <BodyText style={{ margin: "0 0 14px", fontWeight: 600 }}>
            {failed ? t("games.history.failed") : t("games.history.emptyTitle")}
          </BodyText>
          {!failed && (
            <BodyText muted style={{ margin: "0 0 16px" }}>
              {t("games.history.emptyBody")}
            </BodyText>
          )}
          <PrimaryBtn onClick={() => navigate(failed ? 0 : "/app/games")} style={{ width: "100%" }}>
            {failed ? t("games.history.retry") : t("games.history.emptyCta")}
          </PrimaryBtn>
        </Card>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <SectionLabel>{t("games.history.sectionLabel")}</SectionLabel>
          {rows.map((s) => {
            const g = byKey[s.game_key];
            const name = gameName(g, lang);
            return (
              <button
                key={s.id}
                type="button"
                data-testid="history-row"
                onClick={() => navigate(`/app/games/s/${s.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  minHeight: 76,
                  padding: "14px 16px",
                  marginBottom: 10,
                  background: C.white,
                  border: `1px solid ${C.warmGray}`,
                  borderRadius: 18,
                  fontFamily: "inherit",
                  textAlign: "start",
                  cursor: "pointer",
                }}
              >
                <BoardThumb gameKey={s.game_key} size={48} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: ts(20),
                      fontWeight: 700,
                      color: C.textMain,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {s.title || name || s.game_key}
                  </span>
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                    {whoPlayed(s.players, t, lang)}
                  </span>
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                    {[s.title ? name : null, when(s.finished_at)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {/* Points the way the language reads. A "›" left as-is
                    in RTL lands as a stray mark rather than an arrow. */}
                <span aria-hidden="true" style={{ fontSize: ts(22), color: C.green, fontWeight: 700 }}>
                  {meta.dir === "rtl" ? "‹" : "›"}
                </span>
              </button>
            );
          })}

          {more && (
            <GhostBtn onClick={loadMore} disabled={busy} style={{ width: "100%", marginTop: 4 }}>
              {busy ? "…" : t("games.history.more")}
            </GhostBtn>
          )}
        </>
      )}
    </GamesScreen>
  );
}
