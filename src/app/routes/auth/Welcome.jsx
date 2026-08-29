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

/* ⚠ TEMPORARY hardcoded English. The locales/ files are owned by
   another active session, so these strings could not be added there.
   i18n lane: move these to en.js + ur.js under auth.welcome.* and
   swap the lookups to t(). Keys and copy are ready to lift as-is. */
const STRINGS = {
  title: "Welcome, {name}",
  bodyBuddy:
    "Your account is ready. The next step — your volunteer application — will open from here soon.",
  bodyFam:
    "Your account is ready. This is where staying close to your Saath-Icon's world will begin.",
  signOut: "Sign out",
};

export default function Welcome() {
  const { ts } = useI18n();
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

  const body = who.role === "saath_buddy" ? STRINGS.bodyBuddy : STRINGS.bodyFam;

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
      <Title>{STRINGS.title.replace("{name}", who.name)}</Title>
      <Intro>{body}</Intro>
      <Button type="button" onClick={signOut} style={{ width: "auto", padding: "0 40px" }}>
        {STRINGS.signOut}
      </Button>
    </AuthScreen>
  );
}
