/* ════════════════════════════════════════════════
   /app/auth/check-email — "your link is on its way".

   Reached after any email send: a magic link (kind: "magic") or a
   Buddy signup confirmation (kind: "confirm"). Offers one resend with
   a short cooldown. Arriving here directly (no state) falls back to
   role selection.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { AuthScreen, Title, Button, NotMeExit } from "../../components/ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { sendMagicLink } from "../../lib/authFlow.js";
import supabase from "../../lib/supabase.js";

const RESEND_COOLDOWN_S = 30;

export default function CheckEmail() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email;
  const kind = state?.kind === "confirm" ? "confirm" : "magic";

  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!email) navigate("/app/auth", { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    timerRef.current = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [cooldown]);

  if (!email) return null;

  const resend = async () => {
    setCooldown(RESEND_COOLDOWN_S);
    setResent(false);
    try {
      if (kind === "confirm") {
        await supabase.auth.resend({ type: "signup", email });
      } else {
        // The user already exists by now (the first send created them),
        // so resending never needs to create anything.
        await sendMagicLink(email, {}, { createUser: false });
      }
    } catch {
      /* same generic outcome either way */
    }
    setResent(true);
  };

  return (
    <AuthScreen>
      <Title>{t("auth.checkEmail.title")}</Title>

      <p style={{ fontSize: 20, margin: "0 0 28px" }}>
        {t(kind === "confirm" ? "auth.checkEmail.bodyConfirm" : "auth.checkEmail.bodyMagic", {
          email,
        })}
      </p>

      <Button type="button" onClick={resend} disabled={cooldown > 0} busy={cooldown > 0}>
        {t("auth.checkEmail.resend")}
        {cooldown > 0 ? ` (${cooldown})` : ""}
      </Button>

      <p
        aria-live="polite"
        style={{
          textAlign: "center",
          fontSize: A11Y.minBodyPx,
          color: C.greenMuted,
          fontWeight: 600,
          minHeight: 28,
          marginTop: 14,
        }}
      >
        {resent ? t("auth.checkEmail.resent") : ""}
      </p>

      <NotMeExit />
    </AuthScreen>
  );
}
