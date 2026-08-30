/* ════════════════════════════════════════════════
   /app/join/<code> — arriving at a table from a shared link.

   Deliberately OUTSIDE RequireAuth, because a signed-out arrival is
   the whole point: someone taps a link in WhatsApp who may never have
   opened Saathban. The screen sends them to sign in with the code
   remembered, and seats them the moment they come back — including
   after a brand-new sign-up, and including when the sign-in email
   opens a fresh tab (the code lives in localStorage for that reason).

   Every outcome goes through join_by_code, the same RPC the typed
   code uses: same rate limit, same eligibility gates, same lobby-only
   lookup. This screen only translates its answers into sentences —
   a full table, a table that has started or been called off, and a
   code that answers to nothing all get the explanation the
   code-entry box already gives, rather than an error.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession, rememberPostLoginPath } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";
import { joinByCode } from "../../lib/games.js";
import { pushToast } from "../../lib/feedback.jsx";
import { GamesScreen, Card, BodyText, PrimaryBtn } from "./ui.jsx";
import { stashPendingJoin, clearPendingJoin, digitsOnly } from "./joinLink.js";

export default function JoinByLink() {
  const { code: rawCode } = useParams();
  const code = digitsOnly(rawCode);
  const { t, ts, meta } = useI18n();
  const { session, profile } = useSession();
  const navigate = useNavigate();

  // idle | working | full | gone | slow | blocked | bad
  const [state, setState] = useState("working");
  const attempted = useRef(false);

  useEffect(() => {
    if (code.length < 6) {
      setState("bad");
      return;
    }
    // Still resolving who this is: wait rather than guess.
    if (session === undefined) return;

    if (!session) {
      // Signed out: remember the table in BOTH places — sessionStorage
      // for the ordinary login bounce, localStorage for the sign-up
      // journey that may finish in a different tab — then send them on.
      stashPendingJoin(code);
      rememberPostLoginPath(`/app/join/${code}`);
      navigate("/app/auth/login", {
        replace: true,
        state: { from: `/app/join/${code}` },
      });
      return;
    }
    // Signed in but the profile hasn't arrived yet — RequireAuth's own
    // states handle a failure; here we simply wait for a role.
    if (!profile) return;
    if (attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const r = await joinByCode(code);
        if (r?.result === "joined" && r.session_id) {
          clearPendingJoin();
          // Name the host so the landing says whose table this is.
          let host = "";
          try {
            const { data: s } = await supabase
              .from("game_sessions")
              .select("created_by")
              .eq("id", r.session_id)
              .maybeSingle();
            if (s?.created_by) {
              const { data: p } = await supabase
                .from("safe_profiles")
                .select("full_name")
                .eq("id", s.created_by)
                .maybeSingle();
              host = (p?.full_name || "").split(" ")[0];
            }
          } catch {
            /* the toast is warmer with a name and correct without one */
          }
          /* The toast host is app-wide, so the line survives the
             navigation and lands ON the board rather than flashing here. */
          pushToast(host ? t("games.join.seatedAt", { host }) : t("games.join.seated"));
          navigate(`/app/games/s/${r.session_id}`, { replace: true });
          return;
        }
        if (r?.result === "filled") {
          clearPendingJoin();
          setState("full");
          return;
        }
        clearPendingJoin();
        setState("gone");
      } catch (err) {
        const msg = String(err?.message || "");
        // The RPC's own words, turned into the right screen.
        if (/lot of codes/i.test(msg)) setState("slow");
        else if (/Community access/i.test(msg)) setState("blocked");
        else setState("gone");
      }
    })();
  }, [code, session, profile, navigate, t]);

  const Screen = ({ title, children }) => (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(26),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 12px",
        }}
      >
        {title}
      </h1>
      <Card>{children}</Card>
    </GamesScreen>
  );

  if (state === "working") {
    return (
      <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
        <BodyText muted role="status" style={{ fontSize: ts(A11Y.minBodyPx) }}>
          {t("games.join.working")}
        </BodyText>
      </GamesScreen>
    );
  }

  if (state === "full") {
    return (
      <Screen title={t("games.join.fullTitle")}>
        <BodyText>{t("games.code.filled")}</BodyText>
        <PrimaryBtn onClick={() => navigate("/app/games")}>
          {t("games.join.openYourOwn")}
        </PrimaryBtn>
      </Screen>
    );
  }

  if (state === "slow") {
    return (
      <Screen title={t("games.join.slowTitle")}>
        <BodyText>{t("games.code.slow")}</BodyText>
        <Link to="/app/games" style={{ color: C.green, fontWeight: 600, fontSize: ts(A11Y.minBodyPx) }}>
          {t("games.board.backHome")}
        </Link>
      </Screen>
    );
  }

  if (state === "blocked") {
    return (
      <Screen title={t("games.join.notYetTitle")}>
        <BodyText>{t("games.join.notYetBody")}</BodyText>
        <Link to="/app" style={{ color: C.green, fontWeight: 600, fontSize: ts(A11Y.minBodyPx) }}>
          {t("common.backToHome")}
        </Link>
      </Screen>
    );
  }

  if (state === "bad") {
    return (
      <Screen title={t("games.join.badTitle")}>
        <BodyText>{t("games.join.badBody")}</BodyText>
        <PrimaryBtn onClick={() => navigate("/app/games")}>
          {t("games.join.openYourOwn")}
        </PrimaryBtn>
      </Screen>
    );
  }

  return (
    <Screen title={t("games.join.goneTitle")}>
      <BodyText>{t("games.code.noTable")}</BodyText>
      <PrimaryBtn onClick={() => navigate("/app/games")}>
        {t("games.join.openYourOwn")}
      </PrimaryBtn>
    </Screen>
  );
}
