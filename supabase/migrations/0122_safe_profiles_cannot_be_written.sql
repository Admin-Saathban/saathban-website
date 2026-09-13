/* ═══════════════════════════════════════════════════════════════
   0122 — safe_profiles cannot be written through

   FOUND WHILE INVESTIGATING WHO CAN READ safe_profiles, and worse than
   what was being investigated. The view is owned by postgres with no
   security_invoker, so it reads profiles with the owner's rights and row
   security never applies to it. It is a simple one-table view, so
   Postgres makes it auto-updatable — and `authenticated` held INSERT,
   UPDATE and DELETE on it (Supabase's default grants).

   Proved on the live database inside a transaction that was forced to
   roll back: signed in as smoke-icon, an UPDATE through safe_profiles on
   test-icon's row matched 1 row, and a DELETE matched 1 row. Any
   signed-in person could rewrite another person's name, photo, city and
   "about", or delete their profile (and everything that cascades from
   it). The protect_profile_columns trigger only guards role, level,
   pause and block.

   Nothing in the app writes through this view — every one of its 52 uses
   is a read — so reading is all that stays. Applied on its own, ahead of
   the read restriction (0123), because it is the more dangerous of the
   two and needs no design.
   ═══════════════════════════════════════════════════════════════ */

revoke insert, update, delete, truncate, references, trigger
  on public.safe_profiles from authenticated, anon, public;

grant select on public.safe_profiles to authenticated;
