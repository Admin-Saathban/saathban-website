/* ════════════════════════════════════════════════
   /app/hello/<code> — arriving on somebody's invitation.

   Deliberately OUTSIDE RequireAuth, for the reason /app/join is: the
   person tapping a link in WhatsApp may never have opened Saathban.
   The screen remembers the code, sends them to sign in, and resumes
   the moment they come back — including after a brand-new sign-up, and
   including when the magic-link email opens a fresh tab (which is why
   the code waits in localStorage, not sessionStorage).

   This screen NEVER connects anybody. PRODUCT_DECISIONS §7 is explicit
   that the recipient "lands on the inviter's profile, where they
   choose to connect. Never auto-connected." So all it does is ask the
   server whose link this is and hand over to that profile, where a
   person taps a button that says what it will do. The server enforces
   the same thing independently — opening a link writes no friendship —
   so this is the polite half of a rule that holds without it.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession, rememberPostLoginPath } from "../../lib/session.jsx";
import { Card, BodyText, PrimaryBtn } from "../circle/ui.jsx";
import {
  cleanCode,
  openInvite,
  stashPendingInvite,
  clearPendingInvite,
} from "../../lib/invites.js";

export default function HelloInvite() {
  const { code: raw } = useParams();
  const code = cleanCode(raw);
  const { t, ts, meta } = useI18n();
  const { session, profile } = useSession();
  const navigate = useNavigate();

  const [state, setState] = useState("working"); // working | gone | own | blocked
  const tried = useRef(false);

  useEffect(() => {
    if (code.length < 6) {
      setState("gone");
      return;
    }
    if (session === undefined) return;          // still resolving — wait, don't guess

    if (!session) {
      stashPendingInvite(code);
      rememberPostLoginPath(`/app/hello/${code}`);
      navigate("/app/auth/login", { replace: true, state: { from: `/app/hello/${code}` } });
      return;
    }
    if (!profile) return;
    if (tried.current) return;
    tried.current = true;

    (async () => {
      try {
        const r = await openInvite(code);
        clearPendingInvite();
        if (r.result === "ok") {
          /* The invitation travels in the URL so the profile can offer
             the right button and act on it. It grants nothing by being
             there: every check runs again, server-side, on the tap. */
          navigate(`/app/people/${r.inviter_id}?invite=${code}`, { replace: true });
          return;
        }
        setState(r.result === "own" ? "own" : r.result === "blocked" ? "blocked" : "gone");
      } catch {
        clearPendingInvite();
        setState("gone");
      }
    })();
  }, [code, session, profile, navigate]);

  if (state === "working") {
    return (
      <main style={{ minHeight: "100vh", background: C.bg, padding: "40px 16px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <BodyText muted role="status" style={{ fontSize: ts(A11Y.minBodyPx) }}>
            {t("people.hello.working")}
          </BodyText>
        </div>
      </main>
    );
  }

  const title =
    state === "own" ? "people.hello.ownTitle"
      : state === "blocked" ? "people.hello.blockedTitle"
      : "people.hello.goneTitle";
  const body =
    state === "own" ? "people.hello.ownBody"
      : state === "blocked" ? "people.hello.blockedBody"
      : "people.hello.goneBody";

  return (
    <main style={{ minHeight: "100vh", background: C.bg, padding: "40px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(26),
            fontWeight: 700,
            color: C.green,
            margin: "0 0 12px",
          }}
        >
          {t(title)}
        </h1>
        <Card>
          <BodyText style={{ marginTop: 0 }}>{t(body)}</BodyText>
          <PrimaryBtn onClick={() => navigate("/app")}>
            {t("people.hello.backHome")}
          </PrimaryBtn>
          {state === "own" && (
            <div style={{ marginTop: 12 }}>
              <Link
                to="/app/people/invite"
                style={{ color: C.green, fontWeight: 600, fontSize: ts(A11Y.minBodyPx) }}
              >
                {t("people.invite.title")}
              </Link>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
