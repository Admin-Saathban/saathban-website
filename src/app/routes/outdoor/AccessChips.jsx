/* ════════════════════════════════════════════════
   Access notes — OUT_AND_ABOUT_SPEC §4.

   "Green chips for what is there: Shade · Benches · Toilet · Flat
    walk. Grey chips for what to know: Steps at gate · No shade.
    Grey is NOT red and NOT a warning. 'Steps at gate' is information,
    not a hazard. For a 70-year-old this is the difference between
    going and not going, and no map app tells them."

   TONE IS DERIVED FROM THE KEY, HERE, ONCE. Not stored per row and
   not decided at each call site, so no place can ever end up showing
   "Benches" in the colour that means "be careful".

   ON GREY NOT BEING RED. The greys are the same shape, the same
   weight and the same size as the greens; only the colour differs,
   and it differs towards *quiet*, not towards alarm. No ⚠, no red, no
   exclamation. A person reading "Steps at gate" should think "I'll
   take the other entrance", not "this place is dangerous".

   NEVER COLOUR ALONE (CLAUDE.md, a hard requirement). The green chips
   carry a ✓ and the grey ones a · , and each chip's text says the
   whole thing by itself — "No shade" is not "Shade" in a different
   colour, it is a different sentence. Someone who cannot tell the two
   colours apart loses nothing.
   ════════════════════════════════════════════════ */

import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";

/* The only definition of which way round a note reads. */
export const ACCESS_PRESENT = ["shade", "benches", "toilet", "flat_walk"];
export const ACCESS_KNOW = ["steps_at_gate", "no_shade"];
export const ACCESS_FEATURES = [...ACCESS_PRESENT, ...ACCESS_KNOW];

export const accessTone = (feature) => (ACCESS_PRESENT.includes(feature) ? "present" : "know");

export default function AccessChips({ features, size = 15, style }) {
  const { t, ts } = useI18n();
  if (!features || features.length === 0) return null;

  /* Present first: what a place HAS is the reason to go, and it
     should be the first thing read. */
  const ordered = ACCESS_FEATURES.filter((f) => features.includes(f));

  return (
    <span
      style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, ...style }}
      /* One label for the set, so a screen reader announces "access:
         shade, benches" rather than six unexplained words. */
      aria-label={t("outdoor.access.listLabel")}
    >
      {ordered.map((f) => {
        const present = accessTone(f) === "present";
        return (
          <span
            key={f}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: ts(size),
              fontWeight: 600,
              lineHeight: 1.5,
              background: present ? "#EAF2E3" : C.cream,
              color: present ? C.green : C.textMuted,
              border: `1px solid ${present ? "#C6DCB4" : C.warmGray}`,
            }}
          >
            <span aria-hidden="true">{present ? "✓" : "·"}</span>
            {t(`outdoor.access.f.${f}`)}
          </span>
        );
      })}
    </span>
  );
}

/* "Something wrong here?" — §4 requires this on EVERY place, notes or
   no notes, because the place with no notes is exactly where a person
   knows something the app doesn't. Deliberately quiet: small, plain,
   below the chips, never competing with the reason to go. */
export function AccessWrongLink({ onClick }) {
  const { t, ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: A11Y.minTapTargetPx,
        padding: 0,
        marginTop: 4,
        background: "none",
        border: "none",
        color: C.textMuted,
        fontFamily: "inherit",
        fontSize: ts(15),
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      {t("outdoor.access.wrong")}
    </button>
  );
}
