/* ════════════════════════════════════════════════
   Messages — /app/community/messages.

   Request-gated (SPEC.md): a request must be accepted before any
   message lands. Declines are silent — the other side sees "waiting"
   forever, exactly like a request to someone who blocked them. RLS
   already hides incoming requests from people this account blocked.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  fetchDmOverview,
  fetchAuthors,
  respondToRequest,
  fetchUnreadThreadIds,
} from "./communityData.js";
import { CommunityScreen, Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";

export default function Messages() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [overview, setOverview] = useState(null);
  const [people, setPeople] = useState({});
  const [unread, setUnread] = useState(new Set());
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const o = await fetchDmOverview(myId);
      setOverview(o);
      setUnread(await fetchUnreadThreadIds(myId));
      const ids = [...o.incoming, ...o.outgoing, ...o.threads].flatMap((r) => [
        r.requester_id,
        r.recipient_id,
      ]);
      setPeople(await fetchAuthors(ids));
    } catch {
      setError(t("community.dm.loadError"));
      setOverview({ incoming: [], outgoing: [], threads: [] });
    }
  }, [myId]);

  useEffect(() => {
    if (myId) load();
  }, [myId, load]);

  const nameOf = (id) => people[id]?.full_name || "…";
  const otherOf = (r) => (r.requester_id === myId ? r.recipient_id : r.requester_id);

  const respond = async (id, status) => {
    try {
      await respondToRequest(id, status);
      await load();
    } catch {
      setError(t("community.dm.loadError"));
    }
  };

  const sectionLabel = (label) => (
    <p
      style={{
        fontSize: ts(15),
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.olive,
        margin: "24px 0 10px",
      }}
    >
      {label}
    </p>
  );

  return (
    <CommunityScreen backTo="/app/community" backLabel={t("community.dm.backToFeed")}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 8px",
        }}
      >
        {t("community.dm.title")}
      </h1>
      <BodyText muted>{t("community.dm.intro")}</BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {error}
        </BodyText>
      )}

      {overview === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : (
        <>
          {overview.incoming.length > 0 && (
            <>
              {sectionLabel(t("community.dm.requestsLabel"))}
              {overview.incoming.map((r) => (
                <Card key={r.id}>
                  <BodyText>
                    <strong>{nameOf(r.requester_id)}</strong> {t("community.dm.requestLine")}
                  </BodyText>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PrimaryBtn onClick={() => respond(r.id, "accepted")}>{t("community.dm.accept")}</PrimaryBtn>
                    <GhostBtn onClick={() => respond(r.id, "declined")}>{t("community.dm.decline")}</GhostBtn>
                  </div>
                </Card>
              ))}
            </>
          )}

          {sectionLabel(t("community.dm.threadsLabel"))}
          {overview.threads.length === 0 ? (
            <>
              <BodyText muted>{t("community.dm.emptyThreads")}</BodyText>
              {/* An empty inbox is a door: the Connect page is where
                  conversations begin. */}
              <Link
                to="/app/community/connect"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 48,
                  padding: "0 22px",
                  borderRadius: 50,
                  border: `2px solid ${C.green}`,
                  color: C.green,
                  background: C.white,
                  fontSize: ts(A11Y.minBodyPx),
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {t("community.dm.emptyThreadsCta")}
              </Link>
            </>
          ) : (
            overview.threads.map((r) => {
              const isNew = unread.has(r.id);
              return (
                /* Canonical DM surface — person-keyed, one thread per
                   pair (MIGRATIONS.md). This inbox lists, /app/people
                   talks. */
                <Link
                  key={r.id}
                  to={`/app/people/${otherOf(r)}/chat`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minHeight: A11Y.minTapTargetPx + 16,
                    background: C.white,
                    border: isNew ? `2px solid ${C.green}` : `1px solid ${C.warmGray}`,
                    borderRadius: 16,
                    padding: "12px 18px",
                    marginBottom: 10,
                    textDecoration: "none",
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: ts(24) }}>💬</span>
                  <span style={{ fontSize: ts(19), fontWeight: 700, color: C.green, flex: 1 }}>
                    {nameOf(otherOf(r))}
                  </span>
                  {isNew && (
                    <span
                      style={{
                        fontSize: ts(16),
                        fontWeight: 700,
                        color: C.cream,
                        background: C.green,
                        borderRadius: 50,
                        padding: "4px 14px",
                      }}
                    >
                      {t("community.dm.unreadBadge")}
                    </span>
                  )}
                </Link>
              );
            })
          )}

          {overview.outgoing.length > 0 && (
            <>
              {sectionLabel(t("community.dm.outgoingLabel"))}
              {overview.outgoing.map((r) => (
                <BodyText key={r.id} muted>
                  <strong>{nameOf(r.recipient_id)}</strong> {t("community.dm.outgoingLine")}
                </BodyText>
              ))}
            </>
          )}

          {overview.incoming.length === 0 &&
            overview.threads.length === 0 &&
            overview.outgoing.length === 0 && <BodyText muted>{t("community.dm.empty")}</BodyText>}
        </>
      )}
    </CommunityScreen>
  );
}
