-- ============================================================================
-- 0016 — Outdoor v1 (SPEC.md, Outdoor)
--
-- Places (seeded, enriched by Saathban over time), MANUAL check-ins
-- only — never background tracking — with first-name display handled
-- client-side, ~2h auto-expiry, and a per-check-in visibility choice:
-- connections-only (default) or announce to the park board. Planned
-- outings share the same visibility semantics. Park boards are an
-- open chat per place with report/block one tap away; reports land in
-- community_reports (target_kind 'park_board').
--
-- Privacy positions taken (QUESTIONS.md, Outdoor section):
--   - "Connections" = the Icon's circle members — the only explicit
--     grant system that exists today.
--   - EVERYTHING outdoors sits behind can_use_community(): an
--     inactive Buddy sees nothing even if an Icon added them to a
--     circle (vetting outranks the circle grant).
--   - No admin bypass on check-ins: presence is location-adjacent
--     data, and admin is scoped, not omniscient. Boards are
--     admin-visible (they moderate them).
--   - "No history of who was where": expired or ended check-ins are
--     invisible to everyone but their owner, at the database level.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Places — reference data. Read by the community; written by admins
-- (Saathban's own records enrich this over time). Coordinates are
-- stored for the later map/geocoding step but unused in the v1 list UI.
-- ----------------------------------------------------------------------------
create table public.outdoor_places (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text not null,
  area       text not null,
  place_type text not null check (
    place_type in ('park', 'mosque', 'market', 'community_centre', 'walking_track', 'seafront')
  ),
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);

alter table public.outdoor_places enable row level security;
revoke all on public.outdoor_places from anon;

-- Any community member can browse places.
create policy "places: community reads" on public.outdoor_places
  for select using (public.can_use_community());
-- Admins maintain the list.
create policy "places: admins write" on public.outdoor_places
  for insert with check (public.is_admin());
create policy "places: admins update" on public.outdoor_places
  for update using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Check-ins — manual, expiring, visibility chosen per check-in.
-- Created only through the outdoor_check_in() RPC (which closes any
-- previous active check-in: one place at a time).
-- ----------------------------------------------------------------------------
create table public.outdoor_checkins (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.outdoor_places (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  visibility text not null default 'connections' check (visibility in ('connections', 'board')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  ended_at   timestamptz            -- "I've left", before the auto-expiry
);

create index outdoor_checkins_live_idx on public.outdoor_checkins (place_id, expires_at);

-- Is the caller a member of this Icon's circle?
create or replace function public.member_of_circle(p_icon uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.circle_members
    where icon_id = p_icon and member_id = auth.uid()
  );
$$;

alter table public.outdoor_checkins enable row level security;
revoke all on public.outdoor_checkins from anon;

-- Owners always see their own rows (their own record, their business).
-- Everyone else sees a check-in only while it is LIVE (not expired,
-- not ended), only through the community gate, and only per its
-- visibility: board → any community member; connections → the
-- checker's circle members. Never admins-as-such: presence is not
-- admin browsing material.
create policy "checkins: read" on public.outdoor_checkins
  for select using (
    profile_id = auth.uid()
    or (
      public.can_use_community()
      and ended_at is null
      and expires_at > now()
      and not public.caller_hides(profile_id)
      and (
        visibility = 'board'
        or (visibility = 'connections' and public.member_of_circle(profile_id))
      )
    )
  );

-- No direct insert: outdoor_check_in() below is the only door.

-- "I've left" — the owner ends their own check-in early.
create policy "checkins: owner ends own" on public.outdoor_checkins
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "checkins: owner deletes own" on public.outdoor_checkins
  for delete using (profile_id = auth.uid());

-- Check in: Icons only, one live check-in at a time.
create or replace function public.outdoor_check_in(p_place uuid, p_visibility text default 'connections')
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if public.app_role() is distinct from 'saath_icon' or not public.account_ok() then
    raise exception 'Only a Saath-Icon can check in';
  end if;
  if p_visibility not in ('connections', 'board') then
    raise exception 'Unknown visibility';
  end if;
  if not exists (select 1 from public.outdoor_places where id = p_place) then
    raise exception 'Unknown place';
  end if;

  -- One presence at a time: leaving is implied by arriving elsewhere.
  update public.outdoor_checkins
  set ended_at = now()
  where profile_id = auth.uid() and ended_at is null and expires_at > now();

  insert into public.outdoor_checkins (place_id, profile_id, visibility)
  values (p_place, auth.uid(), p_visibility)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.outdoor_check_in(uuid, text) from public, anon;
grant execute on function public.outdoor_check_in(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Planned outings — "I'll be at the park Tuesday morning". Same
-- visibility semantics as check-ins; no expiry row-logic (the UI
-- shows upcoming ones), creator can cancel.
-- ----------------------------------------------------------------------------
create table public.outdoor_outings (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.outdoor_places (id) on delete cascade,
  creator_id  uuid not null references public.profiles (id) on delete cascade,
  starts_at   timestamptz not null,
  note        text check (note is null or char_length(note) <= 300),
  visibility  text not null default 'connections' check (visibility in ('connections', 'board')),
  canceled_at timestamptz,
  created_at  timestamptz not null default now()
);

create index outdoor_outings_place_idx on public.outdoor_outings (place_id, starts_at);

alter table public.outdoor_outings enable row level security;
revoke all on public.outdoor_outings from anon;

create policy "outings: read" on public.outdoor_outings
  for select using (
    creator_id = auth.uid()
    or (
      public.can_use_community()
      and canceled_at is null
      and not public.caller_hides(creator_id)
      and (
        visibility = 'board'
        or (visibility = 'connections' and public.member_of_circle(creator_id))
      )
    )
  );

-- Icons plan outings for themselves.
create policy "outings: icon creates" on public.outdoor_outings
  for insert with check (
    creator_id = auth.uid()
    and public.app_role() = 'saath_icon'
    and public.account_ok()
  );
create policy "outings: creator updates" on public.outdoor_outings
  for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "outings: creator deletes" on public.outdoor_outings
  for delete using (creator_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Park boards — one open chat per place (SPEC.md). Any community
-- member writes; report and block are one tap in the UI; admins see
-- hidden messages (they moderate) and can soft-hide.
-- ----------------------------------------------------------------------------
create table public.park_board_messages (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.outdoor_places (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  hidden_at  timestamptz,
  hidden_by  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index park_board_place_idx on public.park_board_messages (place_id, created_at desc);

alter table public.park_board_messages enable row level security;
revoke all on public.park_board_messages from anon;

create policy "board: read" on public.park_board_messages
  for select using (
    public.is_admin()
    or (
      public.can_use_community()
      and hidden_at is null
      and not public.caller_hides(author_id)
    )
  );
create policy "board: community writes" on public.park_board_messages
  for insert with check (author_id = auth.uid() and public.can_use_community());
create policy "board: author deletes own" on public.park_board_messages
  for delete using (author_id = auth.uid());
create policy "board: admin moderates" on public.park_board_messages
  for update using (public.is_admin());

-- Board reports flow into the existing queue.
alter table public.community_reports drop constraint community_reports_target_kind_check;
alter table public.community_reports add constraint community_reports_target_kind_check
  check (target_kind in ('post', 'comment', 'dm_message', 'park_board'));

-- ----------------------------------------------------------------------------
-- Seed: real Lahore and Karachi spots. Coordinates approximate — good
-- enough for the later distance/geocoding step, invisible in v1.
-- ----------------------------------------------------------------------------
insert into public.outdoor_places (name, city, area, place_type, lat, lng) values
  ('Model Town Park',            'Lahore',  'Model Town',          'park',             31.4832, 74.3239),
  ('Jilani Park (Racecourse)',   'Lahore',  'Jail Road',           'park',             31.5433, 74.3262),
  ('Bagh-e-Jinnah (Lawrence Garden)', 'Lahore', 'Mall Road',       'park',             31.5497, 74.3436),
  ('Gulshan-e-Iqbal Park',       'Lahore',  'Allama Iqbal Town',   'park',             31.5122, 74.2865),
  ('Shalimar Gardens',           'Lahore',  'Baghbanpura',         'park',             31.5860, 74.3812),
  ('Badshahi Mosque courtyard',  'Lahore',  'Walled City',         'mosque',           31.5881, 74.3095),
  ('Liberty Market',             'Lahore',  'Gulberg',             'market',           31.5102, 74.3441),
  ('Alhamra Arts Centre',        'Lahore',  'Mall Road',           'community_centre', 31.5561, 74.3282),
  ('Bagh Ibne Qasim',            'Karachi', 'Clifton',             'park',             24.8076, 67.0301),
  ('Hill Park',                  'Karachi', 'PECHS',               'park',             24.8710, 67.0644),
  ('Frere Hall Gardens',         'Karachi', 'Civil Lines',         'park',             24.8467, 67.0299),
  ('Seaview Promenade',          'Karachi', 'Clifton',             'seafront',         24.7940, 67.0330),
  ('Empress Market',             'Karachi', 'Saddar',              'market',           24.8590, 67.0100),
  ('Aziz Bhatti Park',           'Karachi', 'Gulshan-e-Iqbal',     'park',             24.9180, 67.0971),
  ('Karachi Arts Council',       'Karachi', 'Saddar',              'community_centre', 24.8532, 67.0244);
