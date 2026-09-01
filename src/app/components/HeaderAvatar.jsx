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

/* ── THE SIGNED URL IS CACHED FOR THE SESSION ──

   The avatar lives in a private bucket, so showing it means asking
   Supabase to sign a URL. That is a network round trip, and it was
   happening on every remount of this component — which, until the
   header was lifted into the shell, meant every single navigation.
   The owner sees it as the avatar blinking out and back on each swipe.

   Module scope rather than a ref: the point is to survive the
   component being destroyed and rebuilt, and a ref dies with it.

   Signed URLs expire, so the entry carries the time it was made and is
   re-signed after TTL. Fifty minutes against a one-hour signature —
   the margin matters because a URL that expires while on screen is a
   broken image, which is worse than a request nobody noticed.

   Keyed by storage path: if the person changes their picture the path
   changes, so the old entry is simply never asked for again. */
const SIGNED = new Map();
const TTL_MS = 50 * 60 * 1000;

function cachedAvatar(path) {
  const hit = SIGNED.get(path);
  return hit && Date.now() - hit.at < TTL_MS ? hit.url : null;
}

export default function HeaderAvatar() {
  const { t } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  /* Seeded from the cache SYNCHRONOUSLY, so a remount paints the
     picture on the first frame instead of showing the initial and
     swapping. The swap was the blink. */
  const [src, setSrc] = useState(() =>
    profile?.avatar_url ? cachedAvatar(profile.avatar_url) : null);

  useEffect(() => {
    let alive = true;
    const path = profile?.avatar_url;
    if (!path) { setSrc(null); return undefined; }
    const hit = cachedAvatar(path);
    if (hit) { setSrc(hit); return undefined; }   // nothing to ask for
    signedAvatarUrl(path).then((u) => {
      if (u) SIGNED.set(path, { url: u, at: Date.now() });
      if (alive) setSrc(u);
    });
    return () => { alive = false; };
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
