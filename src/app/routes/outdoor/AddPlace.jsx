/* ════════════════════════════════════════════════
   "Somewhere else?" — an Icon naming their own neighbourhood.

   The places list was seeded and closed (0016 let only admins write),
   so a person whose life happens at a maidan two streets away could
   plan nothing there. 0047 opens it to Saath-Icons, and a place is
   usable by everyone the moment it is saved — no approval queue,
   because "usable immediately" would otherwise be a lie. Admins can
   hide a place that is abused; hiding keeps the row so anything
   already planned there still resolves.

   The location button is OPTIONAL and asks the browser, which asks
   the person — nothing is read without that tap, nothing is stored
   but the two numbers, and refusing costs them only the map pin.
   SPEC's rule stands: no background location, ever.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Card, BodyText, SectionLabel } from "./ui.jsx";
import { addPlace } from "./outdoorData.js";

const TYPES = ["park", "market", "mosque", "community", "cafe", "other"];

export default function AddPlace({ defaultCity = "", onAdded }) {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [placeType, setPlaceType] = useState("park");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Only an Icon may add a place — the database says so too (0047), so
  // this is navigation, not the boundary.
  if (profile?.role !== "saath_icon") return null;

  const useMyLocation = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        // Refusal is ordinary, not an error worth alarming anyone.
        setLocating(false);
        setError(t("outdoor.add.locationDeclined"));
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !city.trim()) {
      setError(t("outdoor.add.needNameCity"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const row = await addPlace({
        name: name.trim(),
        area: area.trim() || null,
        city: city.trim(),
        placeType,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
      setOpen(false);
      setName("");
      setArea("");
      setCoords(null);
      onAdded?.(row);
    } catch {
      setError(t("outdoor.add.failed"));
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        /* OUT_AND_ABOUT_SPEC section 2: "once, as a plain row with a
           plus". The dashed pill was one of the three styles the
           owner counted on this screen and matched nothing else in
           the app; a row that looks like the place rows above it
           reads as part of the same list. */
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          minHeight: A11Y.minTapTargetPx + 12,
          padding: "12px 18px",
          borderRadius: 16,
          border: `1px solid ${C.warmGray}`,
          background: C.white,
          color: C.green,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          fontFamily: "inherit",
          textAlign: "start",
          cursor: "pointer",
          marginTop: 10,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 22 }}>＋</span> {t("outdoor.add.cta")}
      </button>
    );
  }

  const field = {
    width: "100%",
    minHeight: 52,
    padding: "0 14px",
    borderRadius: 12,
    border: `1.5px solid ${C.warmGray}`,
    background: C.white,
    fontSize: ts(A11Y.minBodyPx),
    fontFamily: "inherit",
    color: C.textMain,
    marginBottom: 10,
  };

  return (
    <Card style={{ border: `2px solid ${C.green}`, marginTop: 12 }}>
      <SectionLabel>{t("outdoor.add.title")}</SectionLabel>
      <BodyText muted style={{ marginBottom: 10 }}>{t("outdoor.add.intro")}</BodyText>
      <form onSubmit={save}>
        <label style={{ display: "block", fontSize: ts(16), fontWeight: 700, marginBottom: 4 }}>
          {t("outdoor.add.nameLabel")}
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={field} maxLength={80} />

        <label style={{ display: "block", fontSize: ts(16), fontWeight: 700, marginBottom: 4 }}>
          {t("outdoor.add.areaLabel")}
        </label>
        <input value={area} onChange={(e) => setArea(e.target.value)} style={field} maxLength={80} />

        <label style={{ display: "block", fontSize: ts(16), fontWeight: 700, marginBottom: 4 }}>
          {t("outdoor.add.cityLabel")}
        </label>
        <input value={city} onChange={(e) => setCity(e.target.value)} style={field} maxLength={60} />

        <label style={{ display: "block", fontSize: ts(16), fontWeight: 700, marginBottom: 6 }}>
          {t("outdoor.add.typeLabel")}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {TYPES.map((ty) => (
            <button
              key={ty}
              type="button"
              onClick={() => setPlaceType(ty)}
              aria-pressed={placeType === ty}
              style={{
                minHeight: A11Y.minTapTargetPx,
                padding: "0 16px",
                borderRadius: 50,
                border: `2px solid ${placeType === ty ? C.green : C.warmGray}`,
                background: placeType === ty ? C.green : C.white,
                color: placeType === ty ? C.cream : C.textMain,
                fontSize: ts(16),
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {placeType === ty ? "✓ " : ""}
              {t(`outdoor.add.types.${ty}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          style={{
            minHeight: A11Y.minTapTargetPx,
            padding: "0 16px",
            borderRadius: 50,
            border: `1.5px solid ${coords ? C.green : C.warmGray}`,
            background: C.white,
            color: coords ? C.green : C.textMain,
            fontSize: ts(16),
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          📍 {coords ? t("outdoor.add.locationAdded") : t("outdoor.add.useLocation")}
        </button>
        <BodyText muted style={{ fontSize: ts(15), margin: "0 0 12px" }}>
          {t("outdoor.add.locationNote")}
        </BodyText>

        {error && (
          <BodyText role="alert" style={{ color: C.brown, fontWeight: 700 }}>⚠ {error}</BodyText>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={busy}
            style={{
              minHeight: 56,
              padding: "0 24px",
              borderRadius: 50,
              border: "none",
              background: C.green,
              color: C.cream,
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {t("outdoor.add.save")}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(""); }}
            style={{
              minHeight: 56,
              padding: "0 20px",
              borderRadius: 50,
              border: `2px solid ${C.warmGray}`,
              background: C.white,
              color: C.textMain,
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {t("outdoor.add.cancel")}
          </button>
        </div>
      </form>
    </Card>
  );
}
