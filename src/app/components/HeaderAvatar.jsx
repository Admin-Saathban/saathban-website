/* ════════════════════════════════════════════════
   The person, top-left — NAVIGATION_SPEC §3.

   Profile moved out of More and onto the header, where every app this
   audience already uses keeps it. Tapping it opens the profile full
   screen, sliding FROM THE LEFT, because it was touched on the left —
   MOTION_SPEC §1 names this as the test case for the rule working in
   both directions rather than always sliding from the right.

   The soft dot from PRODUCT_DECISIONS §8 rides here now. It followed
   the profile: the dot belongs wherever the profile entry is, and
   after §6 there is no profile row in More to carry it.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import { useSession } from "../lib/session.jsx";
import { shouldPulse } from "../routes/profile/profileFields.js";
import { signedAvatarUrl } from "../routes/profile/avatar.js";
import { openFullScreen } from "./motion.jsx";

export default function HeaderAvatar() {
  const { t } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    if (profile?.avatar_url) {
      signedAvatarUrl(profile.avatar_url).then((u) => alive && setSrc(u));
    } else {
      setSrc(null);
    }
    return () => {
      alive = false;
    };
  }, [profile?.avatar_url]);

  if (!profile) return null;

  const initial = (profile.full_name || "•").trim().charAt(0).toUpperCase();
  const pulse = shouldPulse(profile);

  return (
    <button
      type="button"
      onClick={() => openFullScreen(navigate, "/app/profile", "start")}
      aria-label={pulse ? `${t("hub.profile")} — ${t("profile.somethingToAdd")}` : t("hub.profile")}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        border: "none",
        background: "none",
        padding: 0,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: src ? `center/cover url(${src})` : C.green,
          color: C.cream,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 15,
          border: `2px solid ${C.white}`,
        }}
      >
        {src ? "" : initial}
      </span>
      {pulse && (
        /* An invitation, never an error. The accessible name above
           carries it in words, so it is never colour alone. */
        <span
          className="sb-pulse-dot"
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 4,
            insetInlineEnd: 4,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: C.green,
            border: `2px solid ${C.bg}`,
          }}
        />
      )}
    </button>
  );
}
