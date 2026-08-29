/* ════════════════════════════════════════════════
   /app/community/messages/:requestId — a REDIRECT, kept for old links.

   The one canonical DM surface is /app/people/<profileId>/chat
   (MIGRATIONS.md, "Canonical DM surface"): carrom inline board,
   stickers, money warning, report, bell-consistent unread — all live
   there now. Notifications and bookmarks minted before the
   unification still point here, so this route resolves the request to
   the other participant and forwards. Nothing renders beyond a
   loading line; nothing is lost.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { fetchThread } from "./communityData.js";
import { CommunityScreen, BodyText } from "./ui.jsx";

export default function Thread() {
  const { requestId } = useParams();
  const { t } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [otherId, setOtherId] = useState(undefined); // undefined loading, null missing

  useEffect(() => {
    if (!myId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { request } = await fetchThread(requestId);
        if (cancelled) return;
        if (!request) {
          setOtherId(null);
          return;
        }
        setOtherId(
          request.requester_id === myId ? request.recipient_id : request.requester_id
        );
      } catch {
        if (!cancelled) setOtherId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, myId]);

  if (otherId === null) return <Navigate to="/app/community/messages" replace />;
  if (otherId) return <Navigate to={`/app/people/${otherId}/chat`} replace />;

  return (
    <CommunityScreen backTo="/app/community/messages" backLabel={t("community.dm.title")}>
      <BodyText muted role="status">…</BodyText>
    </CommunityScreen>
  );
}
