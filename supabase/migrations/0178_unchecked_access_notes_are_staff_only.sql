/* ═══════════════════════════════════════════════════════════════
   0178 — An unchecked access note is readable by staff only

   0065 decided that an unverified access note is a GUESS and must not
   reach a person deciding whether they can physically get into a
   place. But it made that decision in the app (fetchAccessNotes adds
   .eq("verified", true)), not in the database: the read policy from
   0064 only asked whether the place was hidden. Any signed-in account
   could ask the table directly and read every guess — test-icon read
   all 17. That is the safe_profiles shape again: the screen enforcing
   what the database does not.

   ── The rule now ──

     everyone signed in   confirmed notes only, on places that are not
                          hidden (and that the caller may see at all:
                          the place lookup runs under the caller's own
                          outdoor_places policy, can_use_community)
     admins (is_admin())  every note, confirmed or not, on any place —
                          the Access notes screen exists to settle
                          which is which

   "Confirmed" is asked through access_note_public(verified), the one
   place 0065 made for that question, so the policy and the app cannot
   drift apart on it.

   ── Moderators ──

   Not given the unchecked notes. is_admin() already excludes the
   moderator level, and a moderator does not work places: the Access
   notes screen is support/super only, and a "something wrong here?"
   report about a place (target_kind 'place_access') carries the place
   name in the report itself. A moderator reads confirmed notes like
   anyone else.

   ── Anon ──

   Unchanged: anon holds no grant on this table at all, so it is
   refused before any policy is consulted.

   ── Nothing else reads the table ──

   Checked before writing this: no view selects from
   outdoor_place_access, and the only function that did (admin_dashboard,
   a count) stopped in 0177. The app reads it in three places — the
   place list and the place screen (confirmed only, unaffected) and the
   admin Access notes screen (every note, as an admin, unaffected). The
   write policy ("place access: admin writes", is_admin()) is unchanged.
   ═══════════════════════════════════════════════════════════════ */

drop policy if exists "place access: read" on public.outdoor_place_access;
drop policy if exists "place access: read confirmed" on public.outdoor_place_access;
drop policy if exists "place access: admins read all" on public.outdoor_place_access;

create policy "place access: read confirmed"
  on public.outdoor_place_access
  for select
  to authenticated
  using (
    public.access_note_public(verified)
    and exists (
      select 1 from public.outdoor_places p
       where p.id = outdoor_place_access.place_id
         and p.is_hidden = false
    )
  );

create policy "place access: admins read all"
  on public.outdoor_place_access
  for select
  to authenticated
  using (public.is_admin());
