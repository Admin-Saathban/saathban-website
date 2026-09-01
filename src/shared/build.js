/* ════════════════════════════════════════════════
   What is actually running, readable by a person and by a script.

   Defined at build time in vite.config.js. In `vite dev` the defines
   are absent, so this reports "dev" rather than throwing — a stamp
   that white-screens the app it is meant to identify would be a poor
   joke.

   ALSO ON window. Reports must state the hash they tested against,
   and a probe reading window.__SB_BUILD gets it from the bundle
   itself rather than from whoever wrote the report. That closes the
   gap where a report and a build disagree without anybody noticing.
   ════════════════════════════════════════════════ */

/* eslint-disable no-undef */
const HASH = typeof __SB_BUILD_HASH__ === "string" ? __SB_BUILD_HASH__ : "dev";
const TIME = typeof __SB_BUILD_TIME__ === "string" ? __SB_BUILD_TIME__ : "";
/* eslint-enable no-undef */

export const BUILD = { hash: HASH, time: TIME };

/* Digits and a dash in a fixed order, in the viewer's own timezone.
   Deliberately NOT localised: this is the one string in the app that
   must read identically in both languages, because its whole job is
   to be compared against another copy of itself. */
export function buildStamp() {
  if (!TIME) return HASH;
  const d = new Date(TIME);
  if (Number.isNaN(d.getTime())) return HASH;
  const p = (n) => String(n).padStart(2, "0");
  return (
    HASH + " · " + d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
    " " + p(d.getHours()) + ":" + p(d.getMinutes())
  );
}

if (typeof window !== "undefined") window.__SB_BUILD = { ...BUILD, stamp: buildStamp() };
