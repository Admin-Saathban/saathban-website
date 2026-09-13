/* ═══════════════════════════════════════════════════════════════
   0124 — safe_profiles only shows your people

   WHAT IT EXPOSED BEFORE THIS. The view is owned by postgres with no
   security_invoker, so row security on profiles never applied to it, and
   its only filter was `not is_blocked`. Every signed-in person — any
   role, including a Buddy still in vetting — could read every account:
   id, role, full name, photo path, city, area, languages, interests,
   about, about_prompt, join date, show_presence, read_receipts and
   last_seen_at, and avatar_sample. That listed who the admins and Buddies
   are, and last-seen times for anyone, whether or not they had chosen to
   show when they are online. (Writing through it is closed by 0122.)

   WHAT IT SHOWS NOW. Your own row; your people, by the relationships in
   profile_related (0123) — circle and circle requests, friends and
   friend requests, conversations and conversation requests, shared
   groups, group invites and join requests, shared game tables and game
   invites, people you blocked (so you can unblock them); and everyone,
   for moderators and admins, who need names to act on reports.

   PRESENCE: last_seen_at is null unless it is your own row or the person
   shows their presence — for every viewer, admins included. A setting
   that says "hidden" and is readable anyway is worse than no setting.

   People met through content (post authors, board messages, check-ins,
   seats at public tables), an explicit search, and the stranger profile
   page go through profile_cards, search_people and public_profile (0123),
   which never carry presence. The app moved onto those before this ran.
   ═══════════════════════════════════════════════════════════════ */

create or replace view public.safe_profiles as
select
  p.id,
  p.role,
  p.full_name,
  p.avatar_url,
  p.city,
  p.languages,
  p.is_org,
  p.created_at,
  p.area,
  p.interests,
  p.about,
  p.about_prompt,
  p.show_presence,
  p.read_receipts,
  case when p.id = auth.uid() or p.show_presence then p.last_seen_at else null end as last_seen_at,
  p.avatar_sample
from public.profiles p
where not p.is_blocked
  and auth.uid() is not null
  and (p.id = auth.uid() or public.can_moderate() or public.profile_related(p.id));

revoke all on public.safe_profiles from public, anon, authenticated;
grant select on public.safe_profiles to authenticated;
