/* Messages, top-right — NAVIGATION_SPEC §3.

   Messages left the bottom bar on purpose: it is a world with its own
   inside, not a peer of Home. It carries a count, like the bell.

   It opens FULL SCREEN from the right, because a chat is somewhere you
   stay (MOTION_SPEC §2), not a drawer you pick from. */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import Icon from "./Icon.jsx";
import { useSession } from "../lib/session.jsx";
import { fetchThreadSummaries } from "../routes/community/communityData.js";
import { openFullScreen } from "./motion.jsx";

const POLL_MS = 30000;

export default function MessagesButton() {
  const { t } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profile?.id) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const rows = await fetchThreadSummaries(profile.id);
        if (!alive) return;
        setCount((rows || []).reduce((n, r) => n + (r.unread || 0), 0));
      } catch {
        /* leave the last known count — a badge is a hint, never a
           source of truth, and an error here must not blank it. */
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [profile?.id]);

  if (!profile) return null;

  const label = count > 0 ? t("hub.messagesUnread", { n: count }) : t("hub.messages");

  return (
    <button
      type="button"
      onClick={() => openFullScreen(navigate, "/app/community/messages", "end")}
      aria-label={label}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        border: "none",
        background: "none",
        color: C.textMain,
        fontSize: 20,
        cursor: "pointer",
      }}
    >
      <Icon name="messages" size={22} />
      {count > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 3,
            insetInlineEnd: 3,
            minWidth: 18,
            height: 18,
            padding: "0 4px",
            borderRadius: 50,
            background: C.brown,
            color: C.cream,
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
