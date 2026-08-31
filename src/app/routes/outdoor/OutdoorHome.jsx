/* ════════════════════════════════════════════════
   Outdoor — /app/outdoor. One city at a time (SPEC.md; no map API in
   v1): the list opens on the signed-in person's own city, with chips
   to visit another — never a flat all-cities dump. Each place shows
   how many people the CALLER may know are there right now (personal
   by construction — RLS only returns check-ins this account may see)
   and how many happenings — planned outings plus "who's up
   for…?" invitations — are on today or upcoming.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { supabase } from "../../lib/supabase.js";
import { useSession } from "../../lib/session.jsx";
import { fetchMembershipsAsMember } from "../../lib/circle.js";
import { TYPE_ICONS, firstNameOf } from "./outdoorCopy.js";
import {
  canUseCommunity,
  fetchPlaces,
  fetchAccessNotes,
  fetchLiveCheckins,
  fetchUpcomingOutingsAll,
  fetchPlacedActivities,
  activityIsCurrent,
  dropMirroredOutings,
} from "./outdoorData.js";
import { OutdoorScreen, Card, BodyText, SectionLabel } from "./ui.jsx";
import AddPlace from "./AddPlace.jsx";
import AccessChips from "./AccessChips.jsx";
import Faces from "./Faces.jsx";

const cityKey = (profileId) => `saathban.app.outdoorCity.${profileId || "anon"}`;

export default function OutdoorHome() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const [access, setAccess] = useState(null);
  const [places, setPlaces] = useState([]);
  /* §4 access notes, place_id → [feature]. One query for the whole
     list; a request per row is how twenty places become twenty
     requests. Failing to load them must not cost anyone the list, so
     it degrades to no chips rather than to an error. */
  const [accessNotes, setAccessNotes] = useState({});
  /* §3 — who is at each place, with the name and photo needed to show
     a face. Built from the same live check-ins that produced the old
     counts, so this costs one extra profile lookup, not one per row. */
  const [herePeople, setHerePeople] = useState({});
  const [liveCounts, setLiveCounts] = useState({});
  const [happeningCounts, setHappeningCounts] = useState({});
  const [city, setCity] = useState("");
  const [personCities, setPersonCities] = useState({}); // city → person's first name
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await canUseCommunity();
        if (cancelled) return;
        setAccess(ok);
        if (!ok) return;
        const [rows, live, notes] = await Promise.all([
          fetchPlaces(),
          fetchLiveCheckins(),
          fetchAccessNotes().catch(() => ({})),
        ]);
        setAccessNotes(notes);
        if (cancelled) return;
        setPlaces(rows);
        const counts = {};
        for (const ci of live) counts[ci.place_id] = (counts[ci.place_id] || 0) + 1;
        setLiveCounts(counts);

        /* §3 — the faces. One lookup for everybody currently checked
           in anywhere, then grouped by place, rather than a query per
           row. Best effort: if the profiles cannot be read the rows
           still render, they just fall back to "Quiet right now"
           rather than showing a broken avatar. */
        try {
          const ids = [...new Set(live.map((ci) => ci.profile_id).filter(Boolean))];
          if (ids.length) {
            const { data: profs } = await supabase
              .from("safe_profiles")
              .select("id, full_name, avatar_url")
              .in("id", ids);
            const byId = Object.fromEntries((profs || []).map((x) => [x.id, x]));
            const grouped = {};
            for (const ci of live) {
              const who = byId[ci.profile_id];
              if (!who) continue;
              (grouped[ci.place_id] ||= []).push({
                id: who.id,
                // First name only. §3 and the check-in copy both show a
                // first name; a full name at a park is more than the
                // person agreed to share by arriving.
                // firstNameOf, not a regex written here. My inline
                // version lost its backslash to shell escaping and
                // became split(/s+/) — which splits on the LETTER s,
                // so "Hassan Raza" rendered as "Ha" and "Asif Iqbal"
                // as "A". It looked correct only because the test
                // account is "Smoke Icon", with no lowercase s in it.
                name: firstNameOf(who.full_name),
                avatarUrl: who.avatar_url,
              });
            }
            if (!cancelled) setHerePeople(grouped);
          }
        } catch { /* faces are a bonus, never the reason a list fails */ }

        // A Fam member far away: their person's city gets named on its
        // chip, one obvious tap. Best-effort — the list stands alone.
        const persons = {};
        if (profile?.role === "family_member") {
          try {
            for (const m of await fetchMembershipsAsMember()) {
              const c = m.icon_profile?.city;
              if (c && !persons[c]) persons[c] = firstNameOf(m.icon_profile.full_name);
            }
            if (!cancelled) setPersonCities(persons);
          } catch {
            /* chips just go unannotated */
          }
        }

        // Open on this person's own city: their remembered choice first,
        // then the city on their profile, then (for Fam) the city of
        // someone in their circle, then the first city we have.
        const cities = [...new Set(rows.map((p) => p.city))];
        let remembered = "";
        try {
          remembered = localStorage.getItem(cityKey(profile?.id)) || "";
        } catch {
          /* storage unavailable — fall through */
        }
        const personCity = Object.keys(persons).find((c) => cities.includes(c));
        setCity(
          cities.includes(remembered) ? remembered
            : cities.includes(profile?.city) ? profile.city
            : personCity || cities[0] || ""
        );

        // Happening badges are best-effort — the list stands without them.
        try {
          const [outingsAll, activities] = await Promise.all([
            fetchUpcomingOutingsAll(),
            fetchPlacedActivities(),
          ]);
          if (cancelled) return;
          const h = {};
          for (const o of dropMirroredOutings(outingsAll, activities))
            h[o.place_id] = (h[o.place_id] || 0) + 1;
          for (const a of activities.filter((p) => activityIsCurrent(p)))
            h[a.payload.place_id] = (h[a.payload.place_id] || 0) + 1;
          setHappeningCounts(h);
        } catch {
          /* badges only */
        }
      } catch {
        if (!cancelled) {
          setError(t("outdoor.home.loadError"));
          setAccess(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const cities = [...new Set(places.map((p) => p.city))];
  const pickCity = (c) => {
    setCity(c);
    try {
      localStorage.setItem(cityKey(profile?.id), c);
    } catch {
      /* remembering is optional */
    }
  };

  // area → places, for the selected city only
  const byArea = {};
  for (const p of places) {
    if (p.city !== city) continue;
    byArea[p.area] = byArea[p.area] || [];
    byArea[p.area].push(p);
  }

  return (
    <OutdoorScreen>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(32),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 8px",
        }}
      >
        {t("outdoor.home.title")}
      </h1>
      {/* §2: the four-line explainer and the "👉 Tap a place to see
          who's there" line are BOTH gone. The explainer was the
          product describing itself to itself before a single place
          appeared; the hint existed only because the cards said
          nothing but a name, and §3 now puts the faces on the card,
          so the instruction has nothing left to explain. */}

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {error}
        </BodyText>
      )}

      {access === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : access === false ? (
        <Card>
          <BodyText muted style={{ margin: 0 }}>{t("outdoor.home.noAccess")}</BodyText>
        </Card>
      ) : (
        <>
          {profile?.city && !cities.includes(profile.city) && (
            <BodyText muted style={{ marginBottom: 8 }}>
              {t("outdoor.home.noPlacesOwnCity", { city: profile.city })}
            </BodyText>
          )}
          {/* §2: "the city stated as quiet tappable text on the right —
              NOT a toggle to answer." A person should not be asked to
              choose their own city every time they open the screen;
              the city they are in is a fact the app already has, so it
              is stated, and tapping it offers the other one. */}
          {cities.length > 1 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const i = cities.indexOf(city);
                  pickCity(cities[(i + 1) % cities.length]);
                }}
                aria-label={t("outdoor.home.cityTapLabel", {
                  city: cities[(cities.indexOf(city) + 1) % cities.length],
                })}
                style={{
                  minHeight: A11Y.minTapTargetPx,
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: C.textMuted,
                  fontFamily: "inherit",
                  fontSize: ts(16),
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {city}
                <span aria-hidden="true" style={{ textDecoration: "underline", marginInlineStart: 8 }}>
                  {t("outdoor.home.cityChange")}
                </span>
              </button>
            </div>
          )}

          {Object.keys(byArea).length === 0 ? (
            <Card>
              <BodyText muted style={{ margin: 0 }}>{t("outdoor.home.emptyCity")}</BodyText>
            </Card>
          ) : (
            Object.entries(byArea).map(([area, list]) => (
              <div key={area}>
                <SectionLabel>{area}</SectionLabel>
                {list.map((p) => {
                  const n = liveCounts[p.id] || 0;
                  const h = happeningCounts[p.id] || 0;
                  return (
                    <Link
                      key={p.id}
                      to={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        minHeight: A11Y.minTapTargetPx + 20,
                        background: C.white,
                        border: `1px solid ${C.warmGray}`,
                        borderRadius: 16,
                        padding: "12px 18px",
                        marginBottom: 10,
                        textDecoration: "none",
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: ts(26) }}>
                        {TYPE_ICONS[p.place_type] || "🌳"}
                      </span>
                      <span style={{ flex: 1 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: ts(19),
                            fontWeight: 700,
                            color: C.green,
                          }}
                        >
                          {p.name}
                        </span>
                        {/* §3: faces first, then words — and "Quiet right
                            now" rather than "0 people", which is a
                            scoreboard reading nil. Faces renders both
                            cases, so the empty park is never shown as a
                            failure. */}
                        <Faces people={herePeople[p.id] || []} />
                        {h > 0 && (
                          <span style={{ display: "block", fontSize: ts(16), color: C.brown, fontWeight: 600 }}>
                            {h === 1
                              ? t("outdoor.home.happeningOne")
                              : t("outdoor.home.happeningMany", { n: h })}
                          </span>
                        )}
                        {/* §4: what a person needs to know BEFORE
                            setting out, on the row itself. One tap in
                            is one tap too late — the decision to go is
                            made here. */}
                        <AccessChips features={accessNotes[p.id]} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))
          )}

          {/* Somewhere else? The seeded list is a starting point, not
              the world — an Icon can name their own maidan and it is
              usable by everyone at once (0047). */}
          <AddPlace
            defaultCity={city}
            onAdded={(row) => {
              /* Straight into the list rather than a refetch: the row
                 came back from the insert, and the person should see
                 the place they just named without a wait. */
              if (row) setPlaces((cur) => [...cur, row]);
            }}
          />
        </>
      )}
    </OutdoorScreen>
  );
}
