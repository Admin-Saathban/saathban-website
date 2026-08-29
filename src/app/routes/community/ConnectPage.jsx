/* ════════════════════════════════════════════════
   Connect with Saath-Icons — /app/community/connect (migration 0027).

   Search by name or city (safe_profiles fields only), one-tap
   connection requests, and the requests inbox. Privacy stance mirrors
   DMs: blocks make a request silently vanish server-side (we also
   filter blocked ids out of search results), declines are never
   announced, and the sender only ever sees "request sent".
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import {
  searchIcons,
  sendFriendRequest,
  respondFriendRequest,
  fetchFriendOverview,
  fetchMyBlockedIds,
  fetchAuthors,
} from "./communityData.js";
import { CommunityScreen, Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { useToast } from "../../lib/feedback.jsx";

export default function ConnectPage() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = untouched
  const [overview, setOverview] = useState({ incoming: [], outgoing: [], friends: [] });
  const [people, setPeople] = useState({});
  const [blocked, setBlocked] = useState(new Set());
  // Per-person pending: several people can be asked in a row, so the
  // flag is keyed by who — never a screen-wide lock.
  const [busyId, setBusyId] = useState(null);
  const { toast: raiseToast } = useToast();
  const [error, setError] = useState("");

  const showToast = (text, opts) => raiseToast(text, opts);

  const load = useCallback(async () => {
    try {
      const [ov, blk] = await Promise.all([
        fetchFriendOverview(myId),
        fetchMyBlockedIds(myId).catch(() => new Set()),
      ]);
      setOverview(ov);
      setBlocked(blk);
      const ids = [...ov.incoming, ...ov.outgoing, ...ov.friends].flatMap((r) => [
        r.requester_id,
        r.recipient_id,
      ]);
      setPeople(await fetchAuthors(ids));
    } catch {
      setError(t("community.feed.loadError"));
    }
  }, [myId]);

  useEffect(() => {
    if (myId) load();
  }, [myId, load]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      searchIcons(query)
        .then((rows) => setResults(rows.filter((r) => r.id !== myId && !blocked.has(r.id))))
        .catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(handle);
  }, [query, myId, blocked]);

  // Standing of each searchable person relative to me.
  const statusOf = (id) => {
    if (overview.friends.some((r) => r.requester_id === id || r.recipient_id === id))
      return "friend";
    if (overview.outgoing.some((r) => r.recipient_id === id)) return "asked";
    if (overview.incoming.some((r) => r.requester_id === id)) return "incoming";
    return "none";
  };

  /* Per-person pending: a row disables only itself, so several people
     can be asked one after another (FEEDBACK_WIRING.md). */
  const ask = async (id) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await sendFriendRequest(id);
      showToast(t("feedback.requestSent", { name: nameOfPerson(id) }));
      await load();
    } catch {
      showToast(t("community.connect.requestFailed"), { tone: "error" });
    }
    setBusyId(null);
  };

  const respond = async (requestId, accept, whoId) => {
    if (busyId) return;
    setBusyId(requestId);
    try {
      await respondFriendRequest(requestId, accept);
      showToast(
        accept
          ? t("feedback.requestAccepted", { name: nameOfPerson(whoId) })
          : t("feedback.requestDeclined"),
        accept ? undefined : { tone: "info" }
      );
      await load();
    } catch {
      showToast(t("community.connect.requestFailed"), { tone: "error" });
    }
    setBusyId(null);
  };

  const nameOf = (id) => people[id]?.full_name || "…";
  // Search rows carry their own name; inbox rows resolve through people.
  const nameOfPerson = (id) =>
    (results.find((r) => r.id === id)?.full_name || people[id]?.full_name || "").split(" ")[0] ||
    t("fam.setup.someone");

  const badge = (text) => (
    <span
      style={{
        fontSize: ts(15),
        fontWeight: 700,
        color: C.olive,
        border: `1.5px solid ${C.warmGray}`,
        borderRadius: 50,
        padding: "4px 14px",
      }}
    >
      {text}
    </span>
  );

  return (
    <CommunityScreen backTo="/app/community" backLabel={t("community.feed.title")} width={560}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 8px",
        }}
      >
        🤝 {t("community.connect.title")}
      </h1>
      <BodyText muted>{t("community.connect.intro")}</BodyText>
      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {error}
        </BodyText>
      )}

      {/* Search */}
      <Card>
        <label
          htmlFor="sb-connect-search"
          style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 6 }}
        >
          {t("community.connect.searchLabel")}
        </label>
        <input
          id="sb-connect-search"
          type="search"
          value={query}
          placeholder={t("community.connect.searchPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results !== null && (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {results.length === 0 && (
              <BodyText muted style={{ margin: 0 }}>
                {t("community.connect.noResults")}
              </BodyText>
            )}
            {results.map((r) => {
              const st = statusOf(r.id);
              return (
                <li
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: `1px solid ${C.warmGray}`,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, margin: 0 }}>
                      {r.full_name}
                    </p>
                    {r.city && (
                      <p style={{ fontSize: ts(16), color: C.textMuted, margin: 0 }}>{r.city}</p>
                    )}
                  </div>
                  {st === "friend" && badge(t("community.connect.friendBadge"))}
                  {st === "asked" && badge(t("community.connect.pendingBadge"))}
                  {st === "none" && (
                    <GhostBtn disabled={busyId === r.id} onClick={() => ask(r.id)}>
                      {busyId === r.id ? t("feedback.sending") : t("community.connect.requestCta")}
                    </GhostBtn>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Incoming */}
      {overview.incoming.length > 0 && (
        <Card style={{ borderColor: C.green, borderWidth: 2 }}>
          <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 10px" }}>
            {t("community.connect.incomingTitle")}
          </p>
          {overview.incoming.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 0",
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: 1, fontSize: ts(A11Y.minBodyPx), fontWeight: 700, minWidth: 140 }}>
                {nameOf(r.requester_id)}
              </span>
              <PrimaryBtn disabled={busyId === r.id} onClick={() => respond(r.id, true, r.requester_id)}>
                {busyId === r.id ? t("feedback.working") : t("community.connect.accept")}
              </PrimaryBtn>
              <GhostBtn disabled={busyId === r.id} onClick={() => respond(r.id, false, r.requester_id)}>
                {t("community.connect.decline")}
              </GhostBtn>
            </div>
          ))}
        </Card>
      )}

      {/* Outgoing */}
      {overview.outgoing.length > 0 && (
        <Card>
          <p style={{ fontSize: ts(20), fontWeight: 700, margin: "0 0 10px" }}>
            {t("community.connect.outgoingTitle")}
          </p>
          {overview.outgoing.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <span style={{ flex: 1, fontSize: ts(A11Y.minBodyPx) }}>{nameOf(r.recipient_id)}</span>
              {badge(t("community.connect.pendingBadge"))}
            </div>
          ))}
        </Card>
      )}

      {overview.incoming.length === 0 && overview.outgoing.length === 0 && (
        <BodyText muted>{t("community.connect.emptyInbox")}</BodyText>
      )}

    </CommunityScreen>
  );
}
