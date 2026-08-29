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
import { COPY } from "./communityCopy.js";
import { fetchDmOverview, fetchAuthors, respondToRequest } from "./communityData.js";
import { CommunityScreen, Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";

const c = COPY.dm;

export default function Messages() {
  const { ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [overview, setOverview] = useState(null);
  const [people, setPeople] = useState({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const o = await fetchDmOverview(myId);
      setOverview(o);
      const ids = [...o.incoming, ...o.outgoing, ...o.threads].flatMap((r) => [
        r.requester_id,
        r.recipient_id,
      ]);
      setPeople(await fetchAuthors(ids));
    } catch {
      setError(c.loadError);
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
      setError(c.loadError);
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
    <CommunityScreen backTo="/app/community" backLabel={c.backToFeed}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 8px",
        }}
      >
        {c.title}
      </h1>
      <BodyText muted>{c.intro}</BodyText>

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
              {sectionLabel(c.requestsLabel)}
              {overview.incoming.map((r) => (
                <Card key={r.id}>
                  <BodyText>
                    <strong>{nameOf(r.requester_id)}</strong> {c.requestLine}
                  </BodyText>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PrimaryBtn onClick={() => respond(r.id, "accepted")}>{c.accept}</PrimaryBtn>
                    <GhostBtn onClick={() => respond(r.id, "declined")}>{c.decline}</GhostBtn>
                  </div>
                </Card>
              ))}
            </>
          )}

          {sectionLabel(c.threadsLabel)}
          {overview.threads.length === 0 ? (
            <BodyText muted>{c.emptyThreads}</BodyText>
          ) : (
            overview.threads.map((r) => (
              <Link
                key={r.id}
                to={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minHeight: A11Y.minTapTargetPx + 16,
                  background: C.white,
                  border: `1px solid ${C.warmGray}`,
                  borderRadius: 16,
                  padding: "12px 18px",
                  marginBottom: 10,
                  textDecoration: "none",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: ts(24) }}>💬</span>
                <span style={{ fontSize: ts(19), fontWeight: 700, color: C.green }}>
                  {nameOf(otherOf(r))}
                </span>
              </Link>
            ))
          )}

          {overview.outgoing.length > 0 && (
            <>
              {sectionLabel(c.outgoingLabel)}
              {overview.outgoing.map((r) => (
                <BodyText key={r.id} muted>
                  <strong>{nameOf(r.recipient_id)}</strong> {c.outgoingLine}
                </BodyText>
              ))}
            </>
          )}

          {overview.incoming.length === 0 &&
            overview.threads.length === 0 &&
            overview.outgoing.length === 0 && <BodyText muted>{c.empty}</BodyText>}
        </>
      )}
    </CommunityScreen>
  );
}
