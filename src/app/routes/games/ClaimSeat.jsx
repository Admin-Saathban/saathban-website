/* ════════════════════════════════════════════════
   /app/seat/:token — PRODUCT_DECISIONS §17.

   The other end of "send a link". Someone taps a WhatsApp message and
   arrives here. If they are signed in they take the seat and land AT
   THE TABLE (§11 — the action ends where its result lives, never on a
   "you have joined" screen). If they have no account they sign up,
   and the token is waiting for them when they come back.

   Deliberately OUTSIDE RequireAuth, exactly like join/:code: the whole
   point is a link that works for a person who is not on Saathban yet.

   The refusals are worth reading, because each one is a real thing
   that happens with a forwarded link and each deserves its own
   sentence rather than a generic failure:
     · somebody else got there first
     · the link is older than 48 hours
     · the token is nonsense
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { claimSeatLink } from "../../lib/games.js";
import { stashPendingJoin } from "./joinLink.js";
import { GamesScreen, Card, BodyText, PrimaryBtn } from "./ui.jsx";

export default function ClaimSeat() {
  const { token } = useParams();
  const { t, ts } = useI18n();
  const { session, profile } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return undefined;
    /* No account yet: keep the token and send them to sign in. It is
       stashed in localStorage rather than sessionStorage because the
       sign-in email opens a NEW TAB, and a per-tab stash dies there. */
    if (!session) {
      stashPendingJoin(`seat:${token}`);
      navigate("/app/auth", { replace: true });
      return undefined;
    }
    if (!profile) return undefined; // wait for the profile to load
    tried.current = true;
    claimSeatLink(token)
      .then((sessionId) => navigate(`/app/games/s/${sessionId}`, { replace: true }))
      .catch((e) => {
        const m = String(e?.message || "");
        setError(
          /already taken/i.test(m) ? t("games.seatLink.taken")
            : /expired/i.test(m) ? t("games.seatLink.expired")
            : t("games.seatLink.invalid")
        );
      });
    return undefined;
  }, [session, profile, token, navigate, t]);

  return (
    <GamesScreen backTo="/app/games" backLabel={t("games.board.backHome")}>
      <Card>
        {error ? (
          <>
            <BodyText style={{ margin: "0 0 14px", fontWeight: 700 }}>{error}</BodyText>
            <PrimaryBtn onClick={() => navigate("/app/games")} style={{ width: "100%" }}>
              {t("games.seatLink.findAnother")}
            </PrimaryBtn>
          </>
        ) : (
          <BodyText role="status" style={{ margin: 0 }}>
            {t("games.seatLink.taking")}
          </BodyText>
        )}
      </Card>
    </GamesScreen>
  );
}
