/* ════════════════════════════════════════════════
   /app/auth/welcome — the after-login landing for Saath-Fam and
   Saath-Buddy until their real dashboards exist (build step 6).
   roleHomePath() in lib/session.jsx points their roles here; when a
   real dashboard lands, retarget the role there and delete this file.

   Guards itself directly against Supabase (not via useSession) so it
   works whether or not AuthProvider is wired into AppRoot yet — see
   SESSION_WIRING.md. Icons and admins who wander in are forwarded to
   their own homes.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C } from "../../../shared/tokens.js";
import { AuthScreen, Title, Intro, Button } from "../../components/ui.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { useI18n } from "../../lib/i18n.jsx";
import { roleHomePath } from "../../lib/session.jsx";
import supabase from "../../lib/supabase.js";

export default function Welcome() {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const [who, setWho] = useState(null); // { name, role }

  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!alive) return;
      if (!session) return navigate("/app/auth", { replace: true });

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!alive) return;
      if (!profile) return navigate("/app/auth?finish=1", { replace: true });

      // This screen is only for the roles without a dashboard yet.
      const home = roleHomePath(profile.role);
      if (home !== "/app/auth/welcome") return navigate(home, { replace: true });

      setWho({ name: profile.full_name.split(" ")[0], role: profile.role });
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (!who) return <AuthScreen> </AuthScreen>;

  const isBuddy = who.role === "saath_buddy";
  const body = isBuddy
    ? t("auth.welcome.bodyBuddy")
    : t("auth.welcome.bodyFam", { icon: ROLE_DISPLAY.saath_icon });

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* already gone — fine */
    }
    navigate("/app/auth", { replace: true });
  };

  return (
    <AuthScreen>
      <p
        style={{
          fontSize: ts(16),
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: C.greenMuted,
          margin: "0 0 8px",
        }}
      >
        {ROLE_DISPLAY[who.role]}
      </p>
      <Title>{t("auth.welcome.title", { name: who.name })}</Title>
      <Intro>{body}</Intro>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {/* The vetting application is the Buddy's actual next step
            (VETTING_WIRING.md: this screen is its entry point). */}
        {isBuddy && (
          <Button
            type="button"
            onClick={() => navigate("/app/vetting")}
            style={{ width: "auto", padding: "0 40px" }}
          >
            {t("auth.welcome.startVetting")}
          </Button>
        )}
        <Button
          type="button"
          onClick={signOut}
          style={{
            width: "auto",
            padding: "0 40px",
            ...(isBuddy
              ? { background: "transparent", color: C.green, border: `2px solid ${C.green}` }
              : {}),
          }}
        >
          {t("auth.welcome.signOut")}
        </Button>
      </div>
    </AuthScreen>
  );
}
