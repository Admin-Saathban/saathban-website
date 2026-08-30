/* ═══════════════════════════════════════════════════════════════
   0065 — an access note says whether anybody actually checked
   (OUT_AND_ABOUT_SPEC §4, §4.1 now ruled)

   The owner's ruling: admin-seeded is what launches, and admins can
   edit the notes later. 0064 already built exactly that. What is
   missing is honesty about where a note came from.

   ── Why this column exists ──

   The notes seeded in 0064 are MINE, and they are guesses. I have not
   stood at the gate of Hill Park. §4 is blunt about the cost of
   getting this wrong: "if it says 'flat walk' and there are steps,
   someone made a trip they could not complete."

   A guess and a survey are not the same claim, and a green chip makes
   them look identical. So the row now records which it is.

   ── And why unverified notes do not reach a place row ──

   `verified` is not decoration for an admin table. An unverified note
   is withheld from the public place rows entirely, because a chip
   cannot say "probably". The alternative — showing a guess in the
   same green as a checked fact — is the exact harm §4 names, and no
   wording on the chip fixes it, since the person reading it is
   deciding whether they can physically get in.

   The consequence is deliberate and visible: at launch the seeded
   places show NO chips until an admin confirms them, which takes a
   few taps per place on the new admin screen. The feature arrives
   when somebody has actually looked. That is the honest order.
   ═══════════════════════════════════════════════════════════════ */

alter table public.outdoor_place_access
  add column if not exists verified boolean not null default false;

alter table public.outdoor_place_access
  add column if not exists verified_by uuid references public.profiles (id) on delete set null;

alter table public.outdoor_place_access
  add column if not exists verified_at timestamptz;

comment on column public.outdoor_place_access.verified is
  'Has a person actually checked this on the ground? FALSE means seeded or guessed, and unverified notes are withheld from public place rows — a chip cannot say "probably", and OUT_AND_ABOUT_SPEC §4 holds that a wrong note is worse than none.';

/* Everything seeded in 0064 was mine and unverified. Said explicitly
   rather than relying on the column default, so that re-running this
   file cannot quietly promote a guess to a fact. */
update public.outdoor_place_access
   set verified = false
 where verified_at is null;

/* One place to ask "may this note be shown to a person deciding
   whether to go?", so the public list and the place screen cannot
   drift apart on the answer. */
create or replace function public.access_note_public(p_verified boolean)
returns boolean
language sql
immutable
as $function$
  select coalesce(p_verified, false);
$function$;
