/* ════════════════════════════════════════════════
   A person's profile, seen from inside a connection: their public
   (safe_profiles) fields, when the circle connection began, and the
   permissions the membership carries — worded from whichever side the
   viewer stands on. Nothing here shows data the membership doesn't
   grant; RLS would return nothing anyway.

   The Message button opens the DM thread (0019: circle pairs are
   already trusted, so no request dance between them).
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Card, SectionLabel, BodyText, Pill, PrimaryBtn, GhostBtn } from "../circle/ui.jsx";
import { fetchPerson, fetchMembershipsWith, openDmWith } from "./peopleStore.js";
import InviteWelcome from "./InviteWelcome.jsx";
import {
  fetchMyPeople,
  fetchPersonMoments,
  fetchPersonPresence,
  fetchMyGroupsLite,
  inviteToGroup,
  blockPerson,
} from "./myPeopleStore.js";
import {
  fetchGames,
  createSession,
  inviteToGame,
  personWarmth,
  riddleTouch,
  fetchGamesTogether,
} from "../../lib/games.js";

/* ─── Warmth (together lane, 0029/0029b): per-person riddle chip +
   last-7-days badge celebrations, connection-gated server-side.
   solved_today is NULL until the CALLER has solved today's riddle
   (the anti-answer-fishing veil) — the chip hides on null. A failed
   probe (not connected / feature off) hides the whole strip. ─── */
async function probeWarmth(personId) {
  try {
    return await personWarmth(personId);
  } catch {
    return null;
  }
}

/* One shared moment → a warm one-liner (0018 payload snapshots). */
function momentLine(m, t, lang) {
  switch (m.post_type) {
    case "badge": {
      const name = (lang === "ur" ? m.payload?.name_ur : m.payload?.name_en) || m.payload?.name_en || "";
      return t("people.moments.badge", { emoji: m.payload?.emoji || "🏅", badge: name });
    }
    case "score": return t("people.moments.score");
    case "walk": return t("people.moments.walk");
    case "activity": return t("people.moments.walk");
    case "event": return t("people.moments.event");
    default: {
      const body = (m.body || "").trim();
      return body ? `“${body.length > 90 ? body.slice(0, 90) + "…" : body}”` : null;
    }
  }
}

const PERM_ROWS = [
  ["can_see_mood", "people.perms.mood"],
  ["can_see_health", "people.perms.health"],
  ["can_manage_reminders", "people.perms.reminders"],
  ["is_sos_contact", "people.perms.sos"],
];

function PermissionList({ membership }) {
  const { t, ts } = useI18n();
  return (
    <div>
      {PERM_ROWS.map(([field, labelKey]) => {
        const on = !!membership[field];
        return (
          <div
            key={field}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderTop: `1px solid ${C.warmGray}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{ fontSize: ts(18), fontWeight: 700, color: on ? C.green : C.textMuted, width: 24, textAlign: "center" }}
            >
              {on ? "✓" : "—"}
            </span>
            <BodyText style={{ margin: 0, flex: 1 }}>{t(labelKey)}</BodyText>
            <BodyText muted style={{ margin: 0, fontSize: ts(18), fontWeight: 600 }}>
              {on ? t("circle.toggle.on") : t("circle.toggle.off")}
            </BodyText>
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 0",
          borderTop: `1px solid ${C.warmGray}`,
        }}
      >
        <span aria-hidden="true" style={{ width: 24, textAlign: "center", color: C.textMuted }}>📍</span>
        <BodyText style={{ margin: 0, flex: 1 }}>{t("people.perms.location")}</BodyText>
        <BodyText muted style={{ margin: 0, fontSize: ts(18), fontWeight: 600 }}>
          {membership.location_access === "sos_only"
            ? t("circle.perms.location.sosOnly")
            : t("circle.perms.location.never")}
        </BodyText>
      </div>
    </div>
  );
}

export default function PersonPage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  /* §7 — arriving on somebody's invitation. The code only decides
     whether the welcome banner appears; it grants nothing, and the
     server re-checks everything on the tap. */
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const [reloadKey, setReloadKey] = useState(0);
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [person, setPerson] = useState(undefined); // undefined = loading
  const [memberships, setMemberships] = useState([]);
  const [connection, setConnection] = useState(null); // my_people() row for chips/away/since
  const [moments, setMoments] = useState([]);
  const [presence, setPresence] = useState({ checkinPlace: null, inGame: null });
  const [riddle, setRiddle] = useState(null); // null = feature absent / not loaded
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  // action panels
  // D3 — games finished together. 0 until known, and 0 renders nothing.
  const [togetherCount, setTogetherCount] = useState(0);
  const [gamePick, setGamePick] = useState(null); // null | games[]
  const [groupPick, setGroupPick] = useState(null); // null | groups[]

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, m, list, mm, pr, rd, together] = await Promise.all([
          fetchPerson(profileId),
          fetchMembershipsWith(profileId).catch(() => []),
          fetchMyPeople().catch(() => []),
          fetchPersonMoments(profileId).catch(() => []),
          fetchPersonPresence(profileId).catch(() => ({ checkinPlace: null, inGame: null })),
          probeWarmth(profileId),
          /* A failure here must cost the profile nothing: the count is
             a nicety, and a page that will not load because a number
             would not is a bad trade. */
          fetchGamesTogether(myId, profileId).catch(() => 0),
        ]);
        if (cancelled) return;
        setPerson(p);
        setTogetherCount(together || 0);
        setMemberships(m);
        setConnection(list.find((x) => x.id === profileId) || null);
        setMoments(mm);
        setPresence(pr);
        setRiddle(rd);
      } catch {
        if (!cancelled) {
          setPerson(null);
          setError("people.profile.loadError");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, myId, reloadKey]);

  const inviteGame = async () => {
    if (gamePick) return setGamePick(null);
    try {
      const games = (await fetchGames()).filter((g) => g.kind === "turns" && g.enabled);
      setGamePick(games);
      setGroupPick(null);
    } catch { setError("people.profile.actionError"); }
  };
  const startGameWith = async (g) => {
    setBusy(true);
    setError("");
    try {
      // People-first creation: a table for two, this person pre-seated
      // (invited before anyone else can claim the seat).
      const sessionId = await createSession(g.key, Math.max(2, g.min_seats));
      await inviteToGame(sessionId, profileId);
      navigate(`/app/games/s/${sessionId}`);
    } catch { setError("people.profile.actionError"); setBusy(false); }
  };
  const openGroupPick = async () => {
    if (groupPick) return setGroupPick(null);
    try {
      setGroupPick(await fetchMyGroupsLite(myId));
      setGamePick(null);
    } catch { setError("people.profile.actionError"); }
  };
  const sendGroupInvite = async (g) => {
    setBusy(true);
    setError("");
    try {
      await inviteToGroup(g.id, profileId);
      setNotice("people.profile.groupInvited");
      setGroupPick(null);
    } catch { setError("people.profile.actionError"); }
    setBusy(false);
  };
  /* Cheer a solver, nudge a non-solver (the together contract). The
     daily cap is NOT an error: {sent:false} renders "once is plenty" —
     indistinguishable from a block, by design. */
  const touch = async (kind) => {
    setBusy(true);
    setError("");
    try {
      const res = await riddleTouch(profileId, kind);
      setNotice(res?.sent ? (kind === "cheer" ? "people.profile.cheered" : "people.profile.nudged") : "people.profile.oncePlenty");
    } catch {
      // e.g. caller hasn't solved today — quiet, never red.
      setNotice("people.profile.solveFirst");
    }
    setBusy(false);
  };

  const message = async () => {
    setBusy(true);
    setError("");
    try {
      await openDmWith(profileId);
      navigate("chat");
    } catch (err) {
      setError(err.message || "people.profile.loadError");
      setBusy(false);
    }
  };

  if (person === undefined) {
    return <BodyText muted role="status">···</BodyText>;
  }
  if (!person) {
    return (
      <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
        ⚠ {t(error || "people.profile.loadError")}
      </BodyText>
    );
  }

  const first = person.full_name.split(" ")[0];
  // The row where I'm the Icon (what they can see of my day), and the
  // row where they are (what I can see of theirs).
  const asIcon = memberships.find((m) => m.icon_id === myId && m.member_id === person.id);
  const asMember = memberships.find((m) => m.icon_id === person.id && m.member_id === myId);
  const since = connection?.connected_since || (asIcon || asMember)?.created_at;
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";
  const away = !!connection?.away;
  // Away accounts: no actions except what removal the profile offers.
  const showActions = !away;

  return (
    <>
      {inviteCode && (
        <InviteWelcome
          code={inviteCode}
          personId={profileId}
          personName={person.full_name}
          onConnected={() => setReloadKey((n) => n + 1)}
        />
      )}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: C.green,
              color: C.cream,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: ts(30),
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {person.full_name.trim().charAt(0)}
          </span>
          <div style={{ flex: "1 1 200px" }}>
            <h1
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(28),
                fontWeight: 700,
                color: C.green,
                margin: 0,
              }}
            >
              {person.full_name}
            </h1>
            {person.city && (
              <BodyText muted style={{ margin: "2px 0 0" }}>
                {person.city}
              </BodyText>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {person.is_org && <Pill tone="green">🏡 Saathban</Pill>}
              {away && <Pill>🌙 {t("people.list.away")}</Pill>}
              {connection?.in_circle && <Pill tone="green">🤝 {t("people.chips.circle")}</Pill>}
              {connection?.is_friend && <Pill tone="brown">🌸 {t("people.chips.friend")}</Pill>}
              {(connection?.group_names || []).map((g) => (
                <Pill key={g}>🧑‍🤝‍🧑 {t("people.chips.group", { name: g })}</Pill>
              ))}
            </div>
          </div>
        </div>

        {/* Presence — strictly what existing rules already show me:
            a check-in RLS lets me see; a game session I share; and the
            riddle chip only when person_warmth reveals it (I must have
            solved today's riddle myself — the together veil). */}
        {!away && (presence.checkinPlace || presence.inGame || riddle?.solved_today === true) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {presence.checkinPlace && (
              <Pill tone="green">📍 {t("people.presence.at", { place: presence.checkinPlace })}</Pill>
            )}
            {presence.inGame && (
              <Link to={`/app/games/s/${presence.inGame.sessionId}`} style={{ textDecoration: "none" }}>
                <Pill tone="brown">🎲 {t("people.presence.inGame")}</Pill>
              </Link>
            )}
            {riddle?.solved_today === true && (
              <Pill tone="green">💡 {t("people.presence.solvedRiddle")}</Pill>
            )}
          </div>
        )}

        {since && (
          <BodyText muted style={{ margin: "14px 0 0" }}>
            🤝{" "}
            {t("people.profile.connectedSince", {
              date: new Date(since).toLocaleDateString(dateLocale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </BodyText>
        )}
        {!since && (
          <BodyText muted style={{ margin: "14px 0 0" }}>
            {t("people.profile.noCircle")}
          </BodyText>
        )}

        {error && (
          <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
            ⚠ {t(error)}
          </BodyText>
        )}

        {notice && (
          <BodyText role="status" style={{ color: C.green, fontWeight: 600, margin: "12px 0 0" }}>
            ✓ {t(notice)}
          </BodyText>
        )}

        {/* Actions, capability-gated: what doesn't apply is ABSENT, not
            disabled. An away account gets no actions at all here (its
            connections are managed from Circle/Groups as usual). */}
        {showActions && (
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {/* Message → the ONE canonical thread (/app/people/<id>/chat,
                per the recorded DM-unification decision). */}
            <PrimaryBtn onClick={message} disabled={busy}>
              💬 {t("people.profile.messageCta")}
            </PrimaryBtn>
            {/* Game invites need the games connection rule; the person
                must not be a pre-active buddy etc. — the server enforces
                it, and we only OFFER it for community-capable roles. */}
            {(person.role !== "saath_buddy" || connection?.in_circle || connection?.is_friend) && (
              <GhostBtn onClick={inviteGame} disabled={busy}>
                🎲 {t("people.profile.gameCta")}
              </GhostBtn>
            )}
            {/* Cheer (they solved) or nudge (they haven't) — only when
                the warmth veil is lifted (I solved today's myself). */}
            {riddle?.solved_today === true && (
              <GhostBtn onClick={() => touch("cheer")} disabled={busy}>
                🎉 {t("people.profile.cheerCta")}
              </GhostBtn>
            )}
            {riddle?.solved_today === false && (
              <GhostBtn onClick={() => touch("nudge")} disabled={busy}>
                💡 {t("people.profile.nudgeCta")}
              </GhostBtn>
            )}
            <GhostBtn onClick={openGroupPick} disabled={busy}>
              🧑‍🤝‍🧑 {t("people.profile.groupCta")}
            </GhostBtn>
            {(asIcon || asMember) && (
              <Link
                to="/app/circle"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: A11Y.minTapTargetPx,
                  padding: "0 20px",
                  borderRadius: 50,
                  border: `2px solid ${C.warmGray}`,
                  color: C.textMain,
                  background: C.white,
                  fontSize: ts(A11Y.minBodyPx),
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                ⚙️ {t("people.profile.manageCta")}
              </Link>
            )}
          </div>
        )}

{/* D3 — the games you have played together. A count, warmly, and
            never a record: no wins, no split, no run. It appears only
            once there is something to remember, because "0 games
            together" on the profile of someone you have not played
            with yet is a scoreboard reading nil. */}
        {togetherCount > 0 && (
          <BodyText style={{ margin: "14px 0 0", fontWeight: 600, color: C.green }}>
            🎲{" "}
            {togetherCount === 1
              ? t("people.profile.gamesTogetherOne", { name: first })
              : t("people.profile.gamesTogether", { n: togetherCount, name: first })}
          </BodyText>
        )}

        {/* Pickers */}
        {gamePick && (
          <div style={{ marginTop: 14 }}>
            <BodyText muted>{t("people.profile.gamePickHint", { name: first })}</BodyText>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {gamePick.map((g) => (
                <GhostBtn key={g.key} onClick={() => startGameWith(g)} disabled={busy} style={{ borderColor: C.green, color: C.green }}>
                  {lang === "ur" ? g.name_ur : g.name_en}
                </GhostBtn>
              ))}
            </div>
          </div>
        )}
        {groupPick && (
          <div style={{ marginTop: 14 }}>
            <BodyText muted>
              {groupPick.length === 0 ? t("people.profile.noGroups") : t("people.profile.groupPickHint", { name: first })}
            </BodyText>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {groupPick.map((g) => (
                <GhostBtn key={g.id} onClick={() => sendGroupInvite(g)} disabled={busy} style={{ borderColor: C.green, color: C.green }}>
                  {g.name}
                </GhostBtn>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Block — quiet, beneath everything; one write that removes them
          everywhere (list, feeds, DMs both ways). No notification to
          them, ever — the circle-removal convention. */}
      <div style={{ marginTop: 4, marginBottom: 12 }}>
        <button
          type="button"
          onClick={async () => {
            try {
              await blockPerson(myId, profileId);
              /* My People is retired as a destination (§4), so blocking
                 someone returns to the conversations rather than to a
                 list nothing else points at any more. */
              navigate("/app/community/messages", { replace: true });
            } catch { setError("people.profile.actionError"); }
          }}
          style={{
            minHeight: A11Y.minTapTargetPx, background: "none", border: "none",
            color: C.textMuted, fontSize: ts(16), fontFamily: "inherit",
            textDecoration: "underline", cursor: "pointer", padding: "0 4px",
          }}
        >
          {t("people.profile.blockCta")}
        </button>
      </div>

      {/* Shared moments — their community posts (0014/0018 read policies
          are the law) + last-7-days badge celebrations from the warmth
          read (unordered celebration facts, never comparisons). */}
      {(moments.length > 0 || (riddle?.badges || []).length > 0) && (
        <>
          <SectionLabel>🎉 {t("people.moments.label", { name: first })}</SectionLabel>
          <Card>
            {(riddle?.badges || []).map((b, i) => (
              <BodyText key={`b${i}`} style={{ margin: "0 0 8px" }}>
                {t("people.moments.badge", {
                  emoji: b.emoji || "🏅",
                  badge: (lang === "ur" ? b.name_ur : b.name_en) || b.name_en || "",
                })}
              </BodyText>
            ))}
            {moments.map((m) => {
              const line = momentLine(m, t, lang);
              return line ? (
                <BodyText key={m.id} style={{ margin: "0 0 8px" }}>{line}</BodyText>
              ) : null;
            })}
          </Card>
        </>
      )}

      {asIcon && (
        <>
          <SectionLabel>{t("people.profile.canSeeTitleIcon", { name: first })}</SectionLabel>
          <Card>
            <PermissionList membership={asIcon} />
          </Card>
        </>
      )}

      {asMember && (
        <>
          <SectionLabel>{t("people.profile.canSeeTitleMember", { name: first })}</SectionLabel>
          <Card>
            <PermissionList membership={asMember} />
          </Card>
        </>
      )}
    </>
  );
}
