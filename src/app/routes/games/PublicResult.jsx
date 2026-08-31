/* ════════════════════════════════════════════════
   The shared game, seen by somebody with no account — A1.

   This is the page a WhatsApp link lands on. The person opening it may
   never have heard of Saathban, may be sixty-eight, and is one tap
   from closing it. So: the picture first, who played, and one warm
   route in. No sign-in wall, no cookie banner, no app-store
   interstitial.

   IT ASSUMES NO SESSION. Everything here reads from one SECURITY
   DEFINER rpc that returns names and the final board and nothing else
   — see the public_game_result migration for what was deliberately
   left out and why. useSession is never called, because there may be
   no session and a page that throws for a stranger is worse than no
   page.

   THE CARD IS DRAWN THE SAME WAY IT IS FOR A PLAYER, from the same
   module, so what a stranger sees is what the sender saw. The one
   difference is faces: the public payload carries no photo urls, so
   the card falls back to initials — which boastCard already does for
   anyone without a photo, and needs no branch here.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { supabase } from "../../lib/supabase.js";
import { renderBoastCard, blobToUrl } from "./boastCard.js";

export async function fetchPublicResult(sessionId) {
  const { data, error } = await supabase.rpc("public_game_result", { p_session: sessionId });
  if (error) throw error;
  return data || null;
}

export default function PublicResult() {
  const { id } = useParams();
  const { t, ts, meta, lang } = useI18n();
  const [state, setState] = useState({ status: "loading", game: null, card: null });

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    (async () => {
      let game = null;
      try {
        game = await fetchPublicResult(id);
      } catch {
        game = null;
      }
      if (!alive) return;
      if (!game) {
        setState({ status: "missing", game: null, card: null });
        return;
      }

      const seats = Array.isArray(game.seats) ? game.seats : [];
      const players = seats.map((s) => ({
        seat: (s.seat_no ?? 1) - 1,
        name: s.is_bot ? t("ludo.seat.bot") : s.name || t("ludo.seat.someone"),
        photoUrl: null, // never public — see the migration
        isWinner: game.winner_seat != null && s.seat_no === game.winner_seat,
      }));

      /* The card is nice-to-have; the names are the point. A canvas
         that fails must not cost a stranger the whole page. */
      let card = null;
      try {
        const blob = await renderBoastCard({
          players,
          pieces: game.pieces || [],
          seatsInPlay: game.seats_total || 4,
          fonts: meta.fonts,
          text: {
            title: t("ludo.boast.cardTitle"),
            winnerLine: t("ludo.boast.cardLine"),
            date: game.finished_at
              ? new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(game.finished_at))
              : "",
            mark: t("ludo.boast.mark"),
          },
        });
        objectUrl = blobToUrl(blob);
        card = objectUrl;
      } catch {
        card = null;
      }
      if (!alive) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      setState({ status: "ready", game: { ...game, players }, card });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lang]);

  const shell = (children) => (
    <main
      dir={meta.dir}
      style={{
        minHeight: "100vh",
        background: C.cream,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "32px 20px calc(32px + env(safe-area-inset-bottom, 0px))",
        textAlign: "center",
        fontFamily: meta.fonts.body,
      }}
    >
      {children}
    </main>
  );

  if (state.status === "loading") {
    return shell(
      <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0 }}>
        {t("ludo.boast.preparing")}
      </p>
    );
  }

  if (state.status === "missing") {
    return shell(
      <>
        <p style={{ fontSize: ts(22), color: C.textMain, margin: 0, maxWidth: 420 }}>
          {t("ludo.boast.publicMissing")}
        </p>
        <JoinCta t={t} ts={ts} meta={meta} />
      </>
    );
  }

  const { game, card } = state;
  const winner = game.players.find((p) => p.isWinner);

  return shell(
    <>
      {card ? (
        <img
          src={card}
          alt={t("ludo.boast.cardAlt")}
          style={{ width: "100%", maxWidth: 380, borderRadius: 20, border: `2px solid ${C.warmGray}` }}
        />
      ) : (
        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(34),
            fontWeight: 700,
            color: C.green,
            margin: 0,
          }}
        >
          {t("ludo.boast.cardTitle")}
        </h1>
      )}

      {winner && (
        <p style={{ fontSize: ts(21), fontWeight: 600, color: C.textMain, margin: 0, maxWidth: 460 }}>
          {t("ludo.boast.publicIntro", { name: winner.name })}
        </p>
      )}

      <section style={{ width: "100%", maxWidth: 380 }}>
        <h2 style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMuted, margin: "0 0 8px" }}>
          {t("ludo.boast.publicPlayers")}
        </h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {game.players.map((p) => (
            <li
              key={p.seat}
              dir="auto"
              style={{
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                color: C.textMain,
                background: C.white,
                border: `2px solid ${C.warmGray}`,
                borderRadius: 50,
                padding: "8px 14px",
              }}
            >
              {p.isWinner ? "👑 " : ""}
              {p.name}
            </li>
          ))}
        </ul>
      </section>

      <JoinCta t={t} ts={ts} meta={meta} />
    </>
  );
}

function JoinCta({ t, ts, meta }) {
  return (
    <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0, lineHeight: 1.55 }}>
        {t("ludo.boast.publicBlurb")}
      </p>
      <Link
        to="/app"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 60,
          padding: "0 28px",
          borderRadius: 50,
          background: C.green,
          color: C.cream,
          fontSize: ts(19),
          fontWeight: 700,
          fontFamily: meta.fonts.body,
          textDecoration: "none",
        }}
      >
        {t("ludo.boast.publicCta")}
      </Link>
    </div>
  );
}
