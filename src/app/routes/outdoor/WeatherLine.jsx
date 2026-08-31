/* ════════════════════════════════════════════════
   The weather line — OUT_AND_ABOUT_SPEC §2.3.

   "34° in Karachi now, cooler after 5pm."

   "This sits here because this is the moment someone decides WHEN to
    ask people out. In Lahore in June, 4pm is a bad idea and the app
    knows the time."

   ── What this deliberately is not ──

   Not a forecast widget. One sentence: how hot it is now, and the one
   fact that changes the decision — when it gets easier. A five-day
   panel would answer a question nobody asked on this screen.

   ── Advisory, so it fails silently ──

   If the call fails, is slow, or the city is unknown, this renders
   NOTHING. Nobody is stopped from asking a friend out because a
   weather service was down, and an error box here would be a louder
   version of the explainer §2 just deleted.

   ── Why open-meteo ──

   No API key, so it needs no secret in a client bundle and adds no
   budget line — unlike the geocoding and transcription APIs, which
   SPEC.md already lists as paid. Coordinates for the cities Saathban
   operates in are hardcoded rather than geocoded, for the same
   reason: a lookup that costs money to tell us where Karachi is would
   be a poor trade.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

/* The cities the app serves. Anything else renders nothing rather
   than guessing — a wrong temperature is worse than no temperature,
   the same rule the access notes follow. */
const CITY_COORDS = {
  Karachi: { lat: 24.86, lon: 67.01 },
  Lahore: { lat: 31.55, lon: 74.34 },
  Islamabad: { lat: 33.68, lon: 73.05 },
  Rawalpindi: { lat: 33.6, lon: 73.04 },
  Faisalabad: { lat: 31.42, lon: 73.08 },
  Multan: { lat: 30.2, lon: 71.47 },
  Peshawar: { lat: 34.01, lon: 71.58 },
  Quetta: { lat: 30.18, lon: 66.98 },
  Hyderabad: { lat: 25.4, lon: 68.37 },
};

export default function WeatherLine({ city }) {
  const { t, ts, lang } = useI18n();
  const [line, setLine] = useState(null);

  useEffect(() => {
    let alive = true;
    const coords = CITY_COORDS[city];
    if (!coords) { setLine(null); return; }

    (async () => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
          `&current=temperature_2m&hourly=temperature_2m&forecast_days=1&timezone=auto`;
        const r = await fetch(url);
        if (!r.ok) return;
        const j = await r.json();
        const now = Math.round(j?.current?.temperature_2m);
        if (!Number.isFinite(now)) return;

        /* "cooler after 5pm" — the first hour later today that is
           meaningfully cooler than now. Meaningfully, not merely
           lower: a 0.4° drop is not a reason to change your plans, so
           anything under three degrees is not worth a sentence. */
        let cooler = null;
        const times = j?.hourly?.time || [];
        const temps = j?.hourly?.temperature_2m || [];

        /* The API's own clock, in the place's zone: "2026-08-31T14:00".
           Everything below compares strings in that frame. */
        const nowStamp = j?.current?.time || "";
        const today = nowStamp.slice(0, 10);

        for (let i = 0; i < times.length; i++) {
          const stamp = times[i];
          if (!stamp || stamp <= nowStamp) continue;
          // Later TODAY only — a cooler hour tomorrow is not advice
          // about when to go out today.
          if (stamp.slice(0, 10) !== today) break;
          // And an hour somebody could plausibly go out in.
          const hour = Number(stamp.slice(11, 13));
          if (hour < 6 || hour > 20) continue;
          // Meaningfully cooler, not merely lower: nobody changes
          // their plans over half a degree.
          if (Number.isFinite(temps[i]) && now - temps[i] >= 3) {
            cooler = new Date(stamp);
            break;
          }
        }

        if (!alive) return;
        /* hour12, because en-GB's `hour: numeric` renders 17:00 as
           "17" and 05:00 as "05" — neither of which reads as a time
           of day to the person this line is written for. */
        const hour = cooler
          ? cooler
              .toLocaleTimeString(lang === "ur" ? "ur-PK" : "en-GB", { hour: "numeric", hour12: true })
              .replace(/\s+/g, "")
              .toLowerCase()
          : null;
        setLine(
          hour
            ? t("outdoor.weather.nowCooler", { deg: now, city, time: hour })
            : t("outdoor.weather.now", { deg: now, city })
        );
      } catch {
        /* advisory — see the header */
      }
    })();

    return () => { alive = false; };
  }, [city, lang, t]);

  if (!line) return null;

  return (
    <p
      style={{
        margin: "-8px 0 18px",
        fontSize: ts(16),
        color: C.textMuted,
        lineHeight: 1.5,
      }}
    >
      {line}
    </p>
  );
}
