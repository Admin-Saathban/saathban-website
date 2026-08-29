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
import { useSession } from "../../lib/session.jsx";
import { fetchMembershipsAsMember } from "../../lib/circle.js";
import { TYPE_ICONS, firstNameOf } from "./outdoorCopy.js";
import {
  canUseCommunity,
  fetchPlaces,
  fetchLiveCheckins,
  fetchUpcomingOutingsAll,
  fetchPlacedActivities,
  activityIsCurrent,
  dropMirroredOutings,
} from "./outdoorData.js";
import { OutdoorScreen, Card, BodyText, SectionLabel } from "./ui.jsx";

const cityKey = (profileId) => `saathban.app.outdoorCity.${profileId || "anon"}`;

export default function OutdoorHome() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const [access, setAccess] = useState(null);
  const [places, setPlaces] = useState([]);
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
        const [rows, live] = await Promise.all([fetchPlaces(), fetchLiveCheckins()]);
        if (cancelled) return;
        setPlaces(rows);
        const counts = {};
        for (const ci of live) counts[ci.place_id] = (counts[ci.place_id] || 0) + 1;
        setLiveCounts(counts);

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
      <BodyText muted style={{ marginBottom: 12 }}>{t("outdoor.home.intro")}</BodyText>
      {/* Thumb test: say what a tap on a place does. */}
      <BodyText style={{ marginBottom: 12, fontWeight: 600 }}>👉 {t("outdoor.home.tapHint")}</BodyText>

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
          {cities.length > 1 && (
            <div
              role="group"
              aria-label={t("outdoor.home.cityChips")}
              style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}
            >
              {cities.map((c) => {
                const on = c === city;
                const person = personCities[c];
                const label = person
                  ? `${c} · ${t("outdoor.home.personCity", { name: person })}`
                  : c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickCity(c)}
                    style={{
                      minHeight: A11Y.minTapTargetPx,
                      padding: "0 20px",
                      borderRadius: 50,
                      border: `2px solid ${on ? C.green : C.warmGray}`,
                      background: on ? C.green : C.white,
                      color: on ? C.cream : C.textMain,
                      fontSize: ts(A11Y.minBodyPx),
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {on ? `✓ ${label}` : label}
                  </button>
                );
              })}
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
                        {n > 0 && (
                          <span style={{ display: "block", fontSize: ts(16), color: C.olive, fontWeight: 600 }}>
                            {n === 1 ? t("outdoor.home.hereNowOne") : t("outdoor.home.hereNowMany", { n })}
                          </span>
                        )}
                        {h > 0 && (
                          <span style={{ display: "block", fontSize: ts(16), color: C.brown, fontWeight: 600 }}>
                            {h === 1
                              ? t("outdoor.home.happeningOne")
                              : t("outdoor.home.happeningMany", { n: h })}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </>
      )}
    </OutdoorScreen>
  );
}
