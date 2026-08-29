/* ════════════════════════════════════════════════
   Outdoor — /app/outdoor. A clean list grouped by city and area
   (SPEC.md; no map API in v1). Each place shows how many people the
   CALLER may know are there right now — the count is personal by
   construction, because RLS only returns check-ins this account is
   allowed to see.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { TYPE_ICONS } from "./outdoorCopy.js";
import { canUseCommunity, fetchPlaces, fetchLiveCheckins } from "./outdoorData.js";
import { OutdoorScreen, Card, BodyText, SectionLabel } from "./ui.jsx";

export default function OutdoorHome() {
  const { t, ts, meta } = useI18n();
  const [access, setAccess] = useState(null);
  const [places, setPlaces] = useState([]);
  const [liveCounts, setLiveCounts] = useState({});
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
  }, []);

  // city → area → places
  const byCity = {};
  for (const p of places) {
    byCity[p.city] = byCity[p.city] || {};
    byCity[p.city][p.area] = byCity[p.city][p.area] || [];
    byCity[p.city][p.area].push(p);
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
        Object.entries(byCity).map(([city, areas]) => (
          <div key={city}>
            <h2
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(25),
                fontWeight: 700,
                color: C.brown,
                margin: "26px 0 4px",
              }}
            >
              {city}
            </h2>
            {Object.entries(areas).map(([area, list]) => (
              <div key={area}>
                <SectionLabel>{area}</SectionLabel>
                {list.map((p) => {
                  const n = liveCounts[p.id] || 0;
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
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        ))
      )}
    </OutdoorScreen>
  );
}
