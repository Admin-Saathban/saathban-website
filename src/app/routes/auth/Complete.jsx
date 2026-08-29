/* ════════════════════════════════════════════════
   /app/auth/complete — every way in converges here.

   Magic links, confirmation links, and password sign-ins all land on
   this screen. The Supabase client consumes the tokens from the URL
   (detectSessionInUrl); we wait for the session, then ensureProfile()
   creates the profile row from the stashed signup fields if it does
   not exist yet. A session with nothing stashed (assisted signup, or
   a bare sign-in link) goes to the finish-mode forms instead.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C } from "../../../shared/tokens.js";
import { AuthScreen, Title, Button } from "../../components/ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { ensureProfile } from "../../lib/authFlow.js";
import { consumePostLoginPath } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";

const STALL_AFTER_MS = 8000;

export default function Complete() {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const [stalled, setStalled] = useState(
    // An expired/used link comes back with an error in the URL fragment
    // instead of tokens — no point waiting for a session that won't come.
    () => window.location.hash.includes("error=")
  );

  useEffect(() => {
    if (stalled) return undefined;
    let done = false;

    const finish = async (session) => {
      if (done || !session) return;
      done = true;
      try {
        const result = await ensureProfile(session);
        if (result.status === "ok") {
          // Back to the page that bounced them here if their role may
          // see it, else their role's home.
          navigate(consumePostLoginPath(result.role), { replace: true });
        } else {
          navigate("/app/auth?finish=1", { replace: true });
        }
      } catch {
        setStalled(true);
      }
    };

    supabase.auth.getSession().then(({ data }) => finish(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => finish(session));

    const timer = setTimeout(() => {
      if (!done) setStalled(true);
    }, STALL_AFTER_MS);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [stalled, navigate]);

  return (
    <AuthScreen>
      {stalled ? (
        <>
          <Title>{t("auth.complete.stalled")}</Title>
          <Button type="button" onClick={() => navigate("/app/auth", { replace: true })}>
            {t("auth.complete.stalledCta")}
          </Button>
        </>
      ) : (
        <p
          role="status"
          style={{ fontSize: ts(22), color: C.textMuted, textAlign: "center", marginTop: 64 }}
        >
          {t("auth.complete.working")}
        </p>
      )}
    </AuthScreen>
  );
}
