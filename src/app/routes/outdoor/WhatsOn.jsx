/* ════════════════════════════════════════════════
   What's on — PRODUCT_DECISIONS §12.

   "Out & about and Events are ONE screen. To a senior deciding what to
   do today, a Saathban gathering and a neighbour's chai invitation are
   the same question."

   So this screen holds all four kinds of happening in one list:
   somebody checked in RIGHT NOW, a neighbour's "who's up for chai?",
   a planned outing, and a Saathban event. They are grouped by how far
   away they are and then by which day — never by which table they came
   out of, because that is the app's problem and not the person's.

   Top to bottom, exactly as §12 orders it:
     1. "Ask who's up for something" — permanent, never only-when-empty
     2. anyone checked in right now, at the very top of Walkable, with
        a distinct border, since-when, and a one-tap "I'll come"
     3. the happenings, Walkable → Nearby → Across the city,
        then Tomorrow / Coming up, time order within each
     4. one quiet "Places near you" link at the very bottom

   PLACES HAVE NO LIST OF THEIR OWN. They exist inside happenings. A
   directory of parks answers a question nobody asked; "who is at the
   park" is the question.

   §0.6 — every empty section is ABSENT. There is no "no happenings
   nearby" box, because a heading over nothing is a scoreboard reading
   nil. What an empty day gets is the ask-button that was always there.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { TYPE_ICONS } from "./outdoorCopy.js";
import {
  canUseCommunity,
  fetchPlaces,
  fetchLiveCheckins,
  fetchUpcomingOutingsAll,
  fetchPlacedActivities,
  fetchActivityJoins,
  fetchAuthors,
  activityIsCurrent,
  dropMirroredOutings,
  joinPlacedActivity,
} from "./outdoorData.js";
import { fetchAppEvents, isUpcoming } from "../events/eventsStore.js";
import { bandFor, dayBucket, sinceLabel, BAND_ORDER, TODAY, TOMORROW, LATER } from "./bands.js";
import { OutdoorScreen, Card, BodyText, SectionLabel, PrimaryBtn } from "./ui.jsx";
import StartSomething from "./StartSomething.jsx";
import AddPlace from "./AddPlace.jsx";

const DAY_ORDER = [TODAY, TOMORROW, LATER];

export default function WhatsOn() {
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const myId = profile?.id ?? null;

  const [access, setAccess] = useState(null);
  const [places, setPlaces] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [outings, setOutings] = useState([]);
  const [activities, setActivities] = useState([]);
  const [joins, setJoins] = useState({ counts: {}, mine: new Set() });
  const [events, setEvents] = useState([]);
  const [names, setNames] = useState({});
  const [asking, setAsking] = useState(false);
  const [addingPlace, setAddingPlace] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [failed, setFailed] = useState(false);

  const me = { city: profile?.city, area: profile?.area };

  const load = useCallback(async () => {
    const ok = await canUseCommunity();
    setAccess(ok);
    if (!ok) return;
    const [pl, ci, ou, ac, ev] = await Promise.all([
      fetchPlaces().catch(() => []),
      fetchLiveCheckins().catch(() => []),
      fetchUpcomingOutingsAll().catch(() => []),
      fetchPlacedActivities().catch(() => []),
      fetchAppEvents().catch(() => []),
    ]);
    const live = ac.filter((p) => activityIsCurrent(p));
    setPlaces(pl);
    setCheckins(ci);
    setOutings(dropMirroredOutings(ou, live));
    setActivities(live);
    setEvents(ev.filter((e) => isUpcoming(e)));
    const ids = [...new Set([...ci.map((c) => c.profile_id), ...live.map((a) => a.author_id)].filter(Boolean))];
    setNames(await fetchAuthors(ids).catch(() => ({})));
    setJoins(await fetchActivityJoins(live.map((p) => p.id), myId).catch(() => ({ counts: {}, mine: new Set() })));
  }, [myId]);

  useEffect(() => {
    let alive = true;
    load().catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [load]);

  const placeById = useMemo(() => Object.fromEntries(places.map((p) => [p.id, p])), [places]);

  /* Every kind of happening, flattened into one shape. The list does
     not care which table a row came from — that is exactly the merge
     §12 asks for. */
  const happenings = useMemo(() => {
    const rows = [];

    for (const a of activities) {
      const place = placeById[a.payload?.place_id];
      rows.push({
        key: `a:${a.id}`,
        kind: "activity",
        what: a.payload?.activity || t("whatson.kind.activity"),
        where: place?.name || a.payload?.place_name || "",
        when: a.payload?.starts_at ? new Date(a.payload.starts_at) : null,
        who: names[a.author_id] || t("whatson.someone"),
        place,
        joinable: true,
        joined: joins.mine.has(a.id),
        others: joins.counts[a.id] || 0,
        id: a.id,
      });
    }
    for (const o of outings) {
      const place = placeById[o.place_id];
      rows.push({
        key: `o:${o.id}`,
        kind: "outing",
        what: t("whatson.kind.outing"),
        where: place?.name || "",
        when: o.starts_at ? new Date(o.starts_at) : null,
        who: "",
        place,
        joinable: false,
        id: o.id,
      });
    }
    for (const e of events) {
      rows.push({
        key: `e:${e.id}`,
        kind: "event",
        what: e.title,
        where: e.venue || "",
        when: e.when || null,
        who: "",
        /* An event's band comes from its venue's city, which is the
           only geography an event row carries. */
        place: { city: e.city || profile?.city, area: e.area || null },
        joinable: false,
        /* TONIGHT §3.1 — this said `/app/events`, and /app/events is a
           redirect to /app/outdoor (§12 merged the events screen into
           What's on). So tapping a gathering here bounced you back to
           the page you were already looking at: a door onto the room
           you were standing in. /app/events/all is the gatherings list
           that actually renders. */
        to: `/app/events/all`,
        id: e.id,
      });
    }
    return rows;
  }, [activities, outings, events, placeById, names, joins, t, profile]);

  /* Live check-ins are their own thing and sit above everything, per
     §12.4 — not folded into the bands. */
  const liveRows = useMemo(
    () =>
      checkins
        .filter((c) => c.profile_id !== myId)
        .map((c) => ({ ...c, place: placeById[c.place_id] }))
        .filter((c) => c.place)
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)),
    [checkins, placeById, myId]
  );

  const grouped = useMemo(() => {
    const out = new Map();
    for (const h of happenings) {
      const band = bandFor(me, h.place || {});
      const day = dayBucket(h.when);
      const k = `${band}|${day}`;
      if (!out.has(k)) out.set(k, []);
      out.get(k).push(h);
    }
    for (const list of out.values()) {
      list.sort((a, b) => (a.when?.getTime() ?? Infinity) - (b.when?.getTime() ?? Infinity));
    }
    const ordered = [];
    for (const band of BAND_ORDER)
      for (const day of DAY_ORDER) {
        const k = `${band}|${day}`;
        if (out.has(k)) ordered.push({ band, day, rows: out.get(k) });
      }
    return ordered;
  }, [happenings, me.city, me.area]);

  const canStart = profile?.role === "saath_icon";

  const join = async (h) => {
    if (busyId) return;
    setBusyId(h.id);
    try {
      await joinPlacedActivity(h.id);
      await load();
      /* §11 — the action ends where its result lives: the row itself,
         now showing you among the people coming. No toast saying
         "Joined ✓" that tells you nothing about what you joined. */
      pushToast(t("whatson.joined", { what: h.what }), { tone: "success", key: "whatson" });
    } catch {
      pushToast(t("whatson.joinFailed"), { tone: "error", key: "whatson" });
    }
    setBusyId(null);
  };

  if (access === false) {
    return (
      <OutdoorScreen backTo="/app" backLabel={t("whatson.back")}>
        <Card>
          <BodyText style={{ margin: 0 }}>{t("whatson.noAccess")}</BodyText>
        </Card>
      </OutdoorScreen>
    );
  }

  const timeOf = (d) =>
    d
      ? d.toLocaleTimeString(lang === "ur" ? "ur-PK" : "en-GB", { hour: "numeric", minute: "2-digit" })
      : t("whatson.anytime");

  return (
    <OutdoorScreen backTo="/app" backLabel={t("whatson.back")}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(28),
          fontWeight: 800,
          color: C.brown,
          lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
          margin: "0 0 14px",
        }}
      >
        {t("whatson.title")}
      </h1>

      {/* ── 1. The ask, permanently at the top ──
          §12: "a large primary button, permanently at the top. Never
          hidden, never only-when-empty." Initiation is Icon-only, and
          the ineligible state is a warm one-liner rather than a dead
          button (§12, end). */}
      {canStart ? (
        <PrimaryBtn onClick={() => setAsking(true)} style={{ width: "100%", marginBottom: 18 }}>
          {t("whatson.askCta")}
        </PrimaryBtn>
      ) : (
        <BodyText muted style={{ margin: "0 0 18px" }}>
          {t("whatson.askIsIcons")}
        </BodyText>
      )}

      {asking && (
        <StartSomething
          places={places}
          me={me}
          onClose={() => setAsking(false)}
          onStarted={async (created) => {
            setAsking(false);
            await load();
            /* §11 again: land on the thing that now exists. */
            pushToast(t("whatson.started", { what: created?.what || "" }), { tone: "success", key: "whatson" });
          }}
        />
      )}

      {/* ── 2. Anyone here right now ── */}
      {liveRows.length > 0 && (
        <>
          <SectionLabel>{t("whatson.rightNow")}</SectionLabel>
          {liveRows.map((c) => (
            <Card
              key={c.id}
              style={{
                borderColor: C.green,
                borderWidth: 2.5,
                borderStyle: "solid",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span aria-hidden="true" style={{ fontSize: 26 }}>
                  {TYPE_ICONS[c.place.place_type] || "📍"}
                </span>
                <span style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>
                    {t("whatson.isAt", { name: names[c.profile_id] || t("whatson.someone"), place: c.place.name })}
                  </span>
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                    {t("whatson.since", { time: sinceLabel(c.created_at, lang) })}
                  </span>
                </span>
                <Link
                  to={`/app/outdoor/${c.place.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: A11Y.minTapTargetPx,
                    padding: "0 18px",
                    borderRadius: 50,
                    background: C.green,
                    color: C.white,
                    fontSize: ts(A11Y.minBodyPx),
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {t("whatson.illCome")}
                </Link>
              </div>
            </Card>
          ))}
        </>
      )}

      {/* ── 3. The happenings, by distance then by day ── */}
      {grouped.map(({ band, day, rows }) => (
        <div key={`${band}|${day}`}>
          <SectionLabel>
            {t(`whatson.band.${band}`)}
            {day !== TODAY ? ` · ${t(`whatson.day.${day}`)}` : ""}
          </SectionLabel>
          {rows.map((h) => (
            <Card key={h.key} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span aria-hidden="true" style={{ fontSize: 24 }}>
                  {h.kind === "event" ? "🎪" : TYPE_ICONS[h.place?.place_type] || "📍"}
                </span>
                <span style={{ flex: "1 1 170px", minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>
                    {h.what}
                  </span>
                  {/* what · where · when · who, on one quiet line */}
                  <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                    {[h.where, timeOf(h.when), h.who].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {h.joinable && !h.joined && (
                  <button
                    type="button"
                    onClick={() => join(h)}
                    disabled={busyId === h.id}
                    style={{
                      minHeight: A11Y.minTapTargetPx,
                      padding: "0 18px",
                      borderRadius: 50,
                      border: `2px solid ${C.green}`,
                      background: C.white,
                      color: C.green,
                      fontFamily: "inherit",
                      fontSize: ts(A11Y.minBodyPx),
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {t("whatson.illCome")}
                  </button>
                )}
                {h.joinable && h.joined && (
                  <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.green }}>
                    ✓ {t("whatson.coming")}
                  </span>
                )}
                {h.to && (
                  <Link
                    to={h.to}
                    style={{
                      minHeight: A11Y.minTapTargetPx,
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0 16px",
                      borderRadius: 50,
                      border: `2px solid ${C.warmGray}`,
                      color: C.textMain,
                      fontSize: ts(A11Y.minBodyPx),
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    {t("whatson.open")}
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      ))}

      {failed && (
        <Card>
          <BodyText style={{ margin: 0 }}>{t("whatson.failed")}</BodyText>
        </Card>
      )}

      {/* ── 4. Places, quietly, at the very bottom ──
          §12: "Places have no list of their own — they exist inside
          happenings, plus one quiet 'Places near you' link." */}
      <div style={{ marginTop: 26, paddingTop: 14, borderTop: `1px solid ${C.warmGray}` }}>
        <Link
          to="/app/outdoor/places"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: A11Y.minTapTargetPx,
            color: C.greenMuted,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          {t("whatson.placesNearYou")}
        </Link>
        {canStart && (
          <>
            <span aria-hidden="true" style={{ color: C.textMuted, padding: "0 8px" }}>·</span>
            <button
              type="button"
              onClick={() => setAddingPlace((v) => !v)}
              aria-expanded={addingPlace}
              style={{
                minHeight: A11Y.minTapTargetPx,
                background: "none",
                border: "none",
                color: C.greenMuted,
                fontFamily: "inherit",
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {t("whatson.addPlace")}
            </button>
          </>
        )}
      </div>
      {addingPlace && (
        <div style={{ marginTop: 12 }}>
          <AddPlace
            defaultCity={profile?.city}
            onAdded={async () => {
              setAddingPlace(false);
              await load();
            }}
          />
        </div>
      )}
    </OutdoorScreen>
  );
}
