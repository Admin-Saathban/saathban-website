/* ════════════════════════════════════════════════
   /app/auth/complete — every way in converges here.

   Magic links, confirmation links, and password sign-ins all land on
   this screen. The Supabase client consumes the tokens from the URL
   (detectSessionInUrl); we wait for the session, then ensureProfile()
   creates the profile row from the stashed signup fields if it does
   not exist yet. A session with nothing stashed (assisted signup, or
   a bare sign-in link) goes to the finish-mode forms instead.

   A FAILED profile fetch is never treated as "no profile": with a
   live session it renders the loading-your-account retry state — the
   "link expired" copy is reserved for genuinely absent sessions.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C } from "../../../shared/tokens.js";
import { AuthScreen, Title, Button } from "../../components/ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { ensureProfile } from "../../lib/authFlow.js";
import { AccountLoadError, consumePostLoginPath } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";

const STALL_AFTER_MS = 12000;

export default function Complete() {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  // "working" | "stalled" (no session materialised) | "fetch-error"
  // (session is live but the profile read kept failing).
  const [phase, setPhase] = useState(() =>
    // An expired/used link comes back with an error in the URL fragment
    // instead of tokens — no point waiting for a session that won't come.
    window.location.hash.includes("error=") ? "stalled" : "working"
  );
  const sessionRef = useRef(null);
  const doneRef = useRef(false);
  const [welcome, setWelcome] = useState(null); // { name, dest } — first arrival only

  const finish = useCallback(
    async (session) => {
      if (doneRef.current || !session) return;
      doneRef.current = true;
      sessionRef.current = session;
      try {
        const result = await ensureProfile(session);
        if (result.status === "ok") {
          const dest = consumePostLoginPath(result.role);
          // First arrival only: a brief confirmed-welcome before the
          // app. Marked per account+device so it never repeats.
          const arrivedKey = `saathban.app.arrived.${session.user.id}`;
          let firstArrival = false;
          try {
            firstArrival =
              !localStorage.getItem(arrivedKey) &&
              (result.created ||
                Date.now() - new Date(session.user.created_at).getTime() < 15 * 60 * 1000);
            localStorage.setItem(arrivedKey, "1");
          } catch {
            /* storage unavailable — skip the ceremony */
          }
          if (firstArrival) {
            setWelcome({ name: (result.name || "").split(" ")[0], dest });
            return;
          }
          // Back to the page that bounced them here if their role may
          // see it, else their role's home.
          navigate(dest, { replace: true });
        } else {
          // Definitive: authed reads found no row and nothing stashed.
          navigate("/app/auth?finish=1", { replace: true });
        }
      } catch {
        // The reads failed — the account may well exist. Retry state,
        // never the role picker, never "link expired".
        doneRef.current = false;
        setPhase("fetch-error");
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (phase === "stalled") return undefined;
    supabase.auth.getSession().then(({ data }) => finish(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => finish(session));

    const timer = setTimeout(() => {
      if (!doneRef.current && !sessionRef.current) setPhase("stalled");
    }, STALL_AFTER_MS);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "stalled", finish]);

  if (phase === "fetch-error") {
    // Shares the retry screen with the guards; retry re-runs finish()
    // against the session we already hold.
    return (
      <RetryWrapper
        onRetry={async () => {
          setPhase("working");
          await finish(sessionRef.current);
        }}
      />
    );
  }

  if (welcome) {
    return (
      <AuthScreen>
        <Title>
          {welcome.name
            ? t("auth.complete.confirmedTitle", { name: welcome.name })
            : t("auth.complete.confirmedTitleNoName")}
        </Title>
        <p style={{ fontSize: ts(20), color: C.textMuted, margin: "0 0 28px", lineHeight: 1.6 }}>
          {t("auth.complete.confirmedBody")}
        </p>
        <Button type="button" onClick={() => navigate(welcome.dest, { replace: true })}>
          {t("auth.complete.continueCta")}
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      {phase === "stalled" ? (
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

/* AccountLoadError's retry uses the session context; here we retry the
   local finish() instead, so wrap it with our own handler. */
function RetryWrapper({ onRetry }) {
  return <AccountLoadError onRetryOverride={onRetry} />;
}
