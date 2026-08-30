/* ════════════════════════════════════════════════
   Messages — one list. (PRODUCT_DECISIONS §6.)

   NO TABS. The old screen sorted people into Requests / Sent /
   Conversations before you could find anyone, which asks a person to
   categorise someone in order to talk to them. One scrolling list,
   newest first, and the relationship is a CHIP on the row rather than
   a bucket you had to guess.

   STRANGERS NEVER ENTER THE LIST. A first message from someone
   unconnected does not appear here as a conversation; it waits as one
   quiet row at the bottom — "1 message request" — and opens the guarded
   request screen. Nothing a stranger writes is shown on this screen,
   not even a preview, because the list is for people you know.

   GROUPS get their own labelled section below the people, rather than
   being mixed in. A group is a different kind of thing to talk to and
   the eye should not have to sort them apart.

   Empty sections are ABSENT (§0.6): no groups means no groups heading,
   no requests means no request row. A heading over nothing announces a
   gap rather than offering a door.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { fetchThreadSummaries, fetchDmOverview, fetchAuthors } from "./communityData.js";
import { fetchMyPeople, fetchMyGroupsLite } from "../people/myPeopleStore.js";
import { CommunityScreen, BodyText } from "./ui.jsx";

/* Which chip a person wears. Circle first: family outranks the other
   two, and somebody can hold all three at once. */
function chipFor(person, t) {
  if (!person) return null;
  if (person.in_circle) return t("community.dm.chipCircle");
  if (person.role === "saath_buddy") return t("community.dm.chipBuddy");
  if (person.is_friend) return t("community.dm.chipFriend");
  return null;
}

function Chip({ label, ts }) {
  if (!label) return null;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: ts(14),
        fontWeight: 700,
        color: C.olive,
        background: "#EEF3E8",
        border: `1px solid ${C.warmGray}`,
        borderRadius: 50,
        padding: "2px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Face({ name, size = 46 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: C.olive,
        color: C.cream,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      {initial}
    </span>
  );
}

function SectionLabel({ children, ts }) {
  return (
    <p
      style={{
        fontSize: ts(15),
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.olive,
        margin: "26px 0 10px",
      }}
    >
      {children}
    </p>
  );
}

/* What the row says under the name. A picture, a voice note or a game
   is described rather than quoted — "Photo" is the honest summary of a
   thing with no words in it, and a withdrawn message says so instead
   of showing what it used to say. */
function previewOf(last, myId, t) {
  if (!last) return t("community.dm.previewNew");
  if (last.deleted_at) return t("community.dm.previewDeleted");
  const mine = last.sender_id === myId;
  let text;
  if (last.game_session_id) text = t("community.dm.previewGame");
  else if (last.image_path) text = t("community.dm.previewPhoto");
  else text = (last.body || "").trim() || t("community.dm.previewPhoto");
  return mine ? t("community.dm.previewYou", { text }) : text;
}

export default function Messages() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [rows, setRows] = useState(null);
  const [people, setPeople] = useState({});
  const [groups, setGroups] = useState([]);
  const [requestCount, setRequestCount] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    try {
      const [summaries, mine, gs, overview] = await Promise.all([
        fetchThreadSummaries(myId),
        fetchMyPeople().catch(() => []),
        fetchMyGroupsLite(myId).catch(() => []),
        fetchDmOverview(myId),
      ]);
      setRows(summaries);
      setGroups(gs);
      /* Strangers' requests are COUNTED here and shown nowhere else on
         this screen — the count is the whole of what the list says
         about them. */
      setRequestCount(overview.incoming.length);

      const byId = Object.fromEntries(mine.map((p) => [p.id, p]));
      const missing = summaries.map((r) => r.otherId).filter((id) => !byId[id]);
      if (missing.length) {
        const names = await fetchAuthors(missing).catch(() => ({}));
        for (const id of missing) {
          byId[id] = byId[id] || { id, full_name: names[id]?.full_name || names[id] || "" };
        }
      }
      setPeople(byId);
      setError("");
    } catch {
      setError(t("community.dm.loadError"));
    }
  }, [myId, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <CommunityScreen backTo="/app/community" backLabel={t("community.dm.backToFeed")}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          margin: "0 0 8px",
        }}
      >
        <h1
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(30),
            fontWeight: 700,
            color: C.green,
            margin: 0,
          }}
        >
          {t("community.dm.title")}
        </h1>
        {/* The + opens the people list. A person starting a conversation
            looks for a person, not for a compose screen. */}
        <Link
          to="/app/people"
          aria-label={t("community.dm.startCta")}
          style={{
            width: A11Y.minTapTargetPx,
            height: A11Y.minTapTargetPx,
            flexShrink: 0,
            borderRadius: "50%",
            background: C.green,
            color: C.cream,
            display: "grid",
            placeItems: "center",
            fontSize: ts(26),
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true">+</span>
        </Link>
      </div>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {error}
        </BodyText>
      )}

      {rows === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : (
        <>
          {rows.length === 0 && groups.length === 0 && requestCount === 0 ? (
            /* A door, not a scoreboard: says what to do, not what is
               missing. */
            <BodyText muted>{t("community.dm.emptyDoor")}</BodyText>
          ) : null}

          {rows.map((r) => {
            const person = people[r.otherId];
            const name = person?.full_name || t("community.dm.someone");
            const bold = r.unread > 0;
            return (
              <Link
                key={r.requestId}
                to={`/app/people/${r.otherId}/chat`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  marginBottom: 8,
                  minHeight: A11Y.minTapTargetPx + 14,
                  background: C.white,
                  border: `1px solid ${C.warmGray}`,
                  borderRadius: 16,
                  textDecoration: "none",
                  color: C.textMain,
                }}
              >
                <Face name={name} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontSize: ts(20), fontWeight: bold ? 800 : 600 }}>{name}</span>
                    <Chip label={chipFor(person, t)} ts={ts} />
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: ts(16),
                      color: bold ? C.textMain : C.textMuted,
                      fontWeight: bold ? 700 : 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {previewOf(r.last, myId, t)}
                  </span>
                </span>
                {/* Unread is bold text AND a mark — never weight alone. */}
                {bold && (
                  <span
                    aria-label={t("community.dm.unreadAria", { n: r.unread })}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: C.green,
                      flexShrink: 0,
                    }}
                  />
                )}
              </Link>
            );
          })}

          {groups.length > 0 && (
            <>
              <SectionLabel ts={ts}>{t("community.dm.groupsLabel")}</SectionLabel>
              {groups.map((g) => (
                <Link
                  key={g.id}
                  to={`/app/groups/${g.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    marginBottom: 8,
                    minHeight: A11Y.minTapTargetPx + 6,
                    background: C.white,
                    border: `1px solid ${C.warmGray}`,
                    borderRadius: 16,
                    textDecoration: "none",
                    color: C.textMain,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 46,
                      height: 46,
                      flexShrink: 0,
                      borderRadius: 14,
                      background: "#EEF3E8",
                      display: "grid",
                      placeItems: "center",
                      fontSize: ts(22),
                    }}
                  >
                    ◍
                  </span>
                  <span style={{ fontSize: ts(20), fontWeight: 600 }}>{g.name}</span>
                </Link>
              ))}
            </>
          )}

          {/* One quiet row, at the bottom, saying only how many. */}
          {requestCount > 0 && (
            <Link
              to="/app/people/requests"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 18,
                padding: "12px 14px",
                minHeight: A11Y.minTapTargetPx,
                background: "transparent",
                border: `1px dashed ${C.warmGray}`,
                borderRadius: 16,
                textDecoration: "none",
                color: C.textMuted,
                fontSize: ts(A11Y.minBodyPx),
              }}
            >
              <span aria-hidden="true">✉</span>
              {requestCount === 1
                ? t("community.dm.requestOne")
                : t("community.dm.requestMany", { n: requestCount })}
            </Link>
          )}
        </>
      )}
    </CommunityScreen>
  );
}
