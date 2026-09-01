/* ════════════════════════════════════════════════
   A face for everybody who has not uploaded one.

   A coloured disc with a letter in it is what a system shows when it
   has nothing. At a table of four that is three or four systems
   admitting they do not know who is playing, which is a poor way to
   open a game between people who came to be together.

   TWELVE DRAWN FACES, not emoji: an emoji is a different picture on
   every phone, and half of them render as a box on the devices this
   app is actually used on. These are a few circles and paths each —
   a head, a hairline, and one thing that makes it a person rather
   than a shape.

   ASSIGNED, NOT CHOSEN, until somebody chooses. The assignment is
   deterministic from the profile id, so the same person is the same
   face on every table and everybody at that table sees the same one.
   The SEAT is folded in as well, so four people at one table can
   never be handed the same face — which a hash alone would do
   eventually, and would look like a bug the one time it happened.

   Changeable from the profile card: pick another, or upload a real
   photo, which always wins.
   ════════════════════════════════════════════════ */

/* Warm, distinguishable at 40px, and none of them the seat colours —
   a face the colour of somebody's gotis reads as a team badge. */
const SKIN = ["#E8B98A", "#C98B5E", "#A9683F", "#F0CBA4"];
const HAIR = ["#2B2118", "#4A3222", "#1A1A1E", "#6B4A2A"];
const GROUND = [
  "#4E6E8E", "#7E5A86", "#4F7F6A", "#8A6242",
  "#5F6BA0", "#8A5560", "#4C7A85", "#7A6A3E",
  "#67557E", "#3F6D57", "#8B6B4E", "#5B7093",
];

export const SAMPLE_COUNT = 12;

/* Which face this person wears, when they have not chosen. Stable
   for a person, and never twice at one table. */
export function sampleFor(profileId, seat = 0) {
  const id = String(profileId || "");
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h + seat * 5) % SAMPLE_COUNT;
}

/* One face, drawn to fill whatever circle it is put in. */
export default function SampleAvatar({ index = 0, size = 48 }) {
  const i = ((index % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;
  const skin = SKIN[i % SKIN.length];
  const hair = HAIR[(i >> 1) % HAIR.length];
  const ground = GROUND[i];
  /* Four hairlines and three extras, which multiply out to more
     distinct faces than there are seats at any table. */
  const style = i % 4;
  const extra = i % 3;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="24" cy="24" r="24" fill={ground} />
      {/* shoulders, so the head is not floating */}
      <path d="M6 48c0-9 8-14 18-14s18 5 18 14Z" fill={skin} opacity="0.95" />
      <circle cx="24" cy="20" r="11" fill={skin} />
      {/* hair */}
      {style === 0 && <path d="M13 19a11 11 0 0 1 22 0c0-6-4-9-11-9s-11 3-11 9Z" fill={hair} />}
      {style === 1 && (
        <path d="M13 20c0-7 5-11 11-11s11 4 11 11c0-4-3-5-6-4-3 1-7 1-10 0-3-1-6 0-6 4Z" fill={hair} />
      )}
      {style === 2 && (
        <>
          <path d="M13 20a11 11 0 0 1 22 0v-1c0-6-5-10-11-10s-11 4-11 10Z" fill={hair} />
          {/* a plait over one shoulder */}
          <path d="M34 20c3 4 3 10 2 15" stroke={hair} strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      )}
      {style === 3 && (
        /* a cap, for the ones who wear one */
        <path d="M12 19a12 12 0 0 1 24 0Zm24 0h4a2 2 0 0 1 0 4h-6Z" fill={hair} />
      )}
      {/* eyes, and one small thing each */}
      <circle cx="20" cy="21" r="1.5" fill="#241A12" />
      <circle cx="28" cy="21" r="1.5" fill="#241A12" />
      <path d="M21 26q3 2 6 0" stroke="#241A12" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {extra === 1 && (
        /* spectacles */
        <g stroke="#241A12" strokeWidth="1.2" fill="none">
          <circle cx="20" cy="21" r="3.4" />
          <circle cx="28" cy="21" r="3.4" />
          <path d="M23.4 21h1.2" />
        </g>
      )}
      {extra === 2 && (
        /* a moustache */
        <path d="M20 24.4q4 -1.6 8 0" stroke="#241A12" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}
