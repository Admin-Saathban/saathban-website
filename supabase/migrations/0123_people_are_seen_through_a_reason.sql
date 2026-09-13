/* ═══════════════════════════════════════════════════════════════
   0123 — people are seen through a reason

   safe_profiles let any signed-in person list every account, with
   last-seen times even for people who had turned "show when I'm online"
   off. 0122 already stopped anyone WRITING through it. This migration
   adds the ways a person is legitimately seen; 0124 then narrows the view
   to them. Split in two so the app can move onto these functions before
   the view closes, and no name goes blank in between.

   FOUR WAYS, and nothing else:

   1. A RELATIONSHIP (profile_related, used by the view in 0124): circle,
      a circle request either way, a friend or friend request, a
      conversation or conversation request, a shared group, a group
      invite or join request, a shared game table or game invite, and
      people you blocked yourself (the list you unblock them from).
      Presence travels only this way, and only when the person shows it.

   2. A NAME CARD FOR SOMETHING YOU CAN ALREADY SEE (profile_cards): the
      author of a post in your feed, a board message, a check-in, a seat
      at a public table. By id only — it cannot list or search — and it
      carries name, photo, city and role: never presence, never "about",
      interests, languages or join date. You need the id, and ids arrive
      only with content row security already let you read.

   3. AN EXPLICIT SEARCH (search_people): at least three letters, matched
      to the START of a word in the name, at most 20 results, never your
      own row, never someone who blocked you or whom you blocked, never
      an account that cannot use the community, never admins (except the
      organisation account). City is no longer searchable: "Lahore" would
      list everybody in Lahore.

   4. ONE STRANGER PROFILE, BY ID (public_profile): what a stranger may
      see of a person — the profile page reached from a post or a search
      result. Same by-id rule as the cards; never presence.

   Hidden presence is not readable through any of these, by anyone,
   including admins.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.profile_related(p_other uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select auth.uid() is not null and (
       p_other = auth.uid()
    or exists (select 1 from public.circle_members c
               where (c.icon_id = auth.uid() and c.member_id = p_other)
                  or (c.member_id = auth.uid() and c.icon_id = p_other))
    or exists (select 1 from public.circle_invites i
               where i.used_at is null
                 and ((i.icon_id = auth.uid() and i.created_by = p_other)
                   or (i.created_by = auth.uid() and i.icon_id = p_other)))
    or exists (select 1 from public.friend_requests f
               where (f.requester_id = auth.uid() and f.recipient_id = p_other)
                  or (f.recipient_id = auth.uid() and f.requester_id = p_other))
    or exists (select 1 from public.dm_requests d
               where (d.requester_id = auth.uid() and d.recipient_id = p_other)
                  or (d.recipient_id = auth.uid() and d.requester_id = p_other))
    or exists (select 1 from public.group_members a
               join public.group_members b on b.group_id = a.group_id
               where a.member_id = auth.uid() and b.member_id = p_other)
    or exists (select 1 from public.group_invites gi
               where (gi.inviter_id = auth.uid() and gi.invitee_id = p_other)
                  or (gi.invitee_id = auth.uid() and gi.inviter_id = p_other))
    or exists (select 1 from public.group_join_requests j
               join public.group_members m on m.group_id = j.group_id
               where (j.requester_id = p_other and m.member_id = auth.uid())
                  or (j.requester_id = auth.uid() and m.member_id = p_other))
    or exists (select 1 from public.game_seats s1
               join public.game_seats s2 on s2.session_id = s1.session_id
               where s1.profile_id = auth.uid() and s2.profile_id = p_other)
    or exists (select 1 from public.game_invites gv
               where (gv.inviter_id = auth.uid() and gv.invitee_id = p_other)
                  or (gv.invitee_id = auth.uid() and gv.inviter_id = p_other))
    or exists (select 1 from public.user_blocks ub
               where ub.blocker_id = auth.uid() and ub.blocked_id = p_other)
  );
$$;

create or replace function public.profile_cards(p_ids uuid[])
returns table (
  id            public.profiles.id%type,
  full_name     public.profiles.full_name%type,
  avatar_url    public.profiles.avatar_url%type,
  avatar_sample public.profiles.avatar_sample%type,
  role          public.profiles.role%type,
  is_org        public.profiles.is_org%type,
  city          public.profiles.city%type,
  area          public.profiles.area%type
)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.id, p.full_name, p.avatar_url, p.avatar_sample, p.role, p.is_org, p.city, p.area
  from public.profiles p
  where auth.uid() is not null
    and p.id = any ((coalesce(p_ids, '{}'::uuid[]))[1:200])
    and not p.is_blocked
    and not exists (select 1 from public.user_blocks b
                    where b.kind = 'block' and b.blocker_id = p.id and b.blocked_id = auth.uid());
$$;

create or replace function public.search_people(p_term text, p_role text default null, p_limit integer default 12)
returns table (
  id         public.profiles.id%type,
  full_name  public.profiles.full_name%type,
  city       public.profiles.city%type,
  role       public.profiles.role%type,
  is_org     public.profiles.is_org%type,
  avatar_url public.profiles.avatar_url%type
)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with q as (
    select lower(btrim(coalesce(p_term, ''))) as raw,
           replace(replace(replace(lower(btrim(coalesce(p_term, ''))), '\', '\\'), '%', '\%'), '_', '\_') as esc
  )
  select p.id, p.full_name, p.city, p.role, p.is_org, p.avatar_url
  from public.profiles p, q
  where auth.uid() is not null
    and public.account_ok()
    and char_length(q.raw) >= 3
    and p.id <> auth.uid()
    and not p.is_blocked
    and public.can_use_community_profile(p.id)
    and (p.role <> 'admin' or p.is_org)
    and (p_role is null or p.role::text = p_role)
    and (lower(p.full_name) like q.esc || '%' escape '\'
      or lower(p.full_name) like '% ' || q.esc || '%' escape '\')
    and not exists (select 1 from public.user_blocks b
                    where b.kind = 'block'
                      and ((b.blocker_id = p.id and b.blocked_id = auth.uid())
                        or (b.blocker_id = auth.uid() and b.blocked_id = p.id)))
  order by p.full_name
  limit least(greatest(coalesce(p_limit, 12), 1), 20);
$$;

create or replace function public.public_profile(p_id uuid)
returns table (
  id            public.profiles.id%type,
  role          public.profiles.role%type,
  full_name     public.profiles.full_name%type,
  avatar_url    public.profiles.avatar_url%type,
  avatar_sample public.profiles.avatar_sample%type,
  city          public.profiles.city%type,
  area          public.profiles.area%type,
  languages     public.profiles.languages%type,
  interests     public.profiles.interests%type,
  about         public.profiles.about%type,
  about_prompt  public.profiles.about_prompt%type,
  is_org        public.profiles.is_org%type,
  created_at    public.profiles.created_at%type
)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.id, p.role, p.full_name, p.avatar_url, p.avatar_sample, p.city, p.area,
         p.languages, p.interests, p.about, p.about_prompt, p.is_org, p.created_at
  from public.profiles p
  where auth.uid() is not null
    and p.id = p_id
    and not p.is_blocked
    and not exists (select 1 from public.user_blocks b
                    where b.kind = 'block' and b.blocker_id = p.id and b.blocked_id = auth.uid());
$$;

revoke all on function public.profile_related(uuid) from public, anon;
revoke all on function public.profile_cards(uuid[]) from public, anon;
revoke all on function public.search_people(text, text, integer) from public, anon;
revoke all on function public.public_profile(uuid) from public, anon;
grant execute on function public.profile_related(uuid) to authenticated;
grant execute on function public.profile_cards(uuid[]) to authenticated;
grant execute on function public.search_people(text, text, integer) to authenticated;
grant execute on function public.public_profile(uuid) to authenticated;
