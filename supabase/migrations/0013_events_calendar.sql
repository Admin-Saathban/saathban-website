-- ============================================================================
-- 0012 — Events, RSVPs with capacity, personal calendar
--
-- App-managed events (SPEC.md §Events + Calendar). The marketing site's
-- historical/announced events stay in src/shared/eventsData.js (one source
-- of truth for that content); this table holds events managed in the app,
-- with RSVP and capacity. The app lists both.
--
-- Deliberate v1 decisions (see QUESTIONS.md for the open ones):
-- - Only Saath-Icons RSVP — they are the attendees. Fam members can SEE
--   every published event (so they can bring their parent) but the RPC
--   refuses other roles; RSVP-on-behalf is an open question, not assumed.
-- - RSVPs are written ONLY through the two RPCs: capacity has to be checked
--   under a row lock, and cancelled→going must recheck it. No insert/update
--   policy could do that safely (RLS cannot compare old and new).
-- - Nobody but admins sees who else is going. Others see only a count,
--   through a definer function that refuses unpublished events.
-- ============================================================================

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  description text,
  venue       text,
  city        text,
  event_date  date not null,
  start_time  time,
  end_time    time,
  -- null = no cap
  capacity    integer check (capacity is null or capacity > 0),
  is_published boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index events_published_date_idx on public.events (event_date) where is_published;

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_rsvps (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'going' check (status in ('going', 'cancelled')),
  checked_in_at timestamptz,   -- at-event check-in, set by staff
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (event_id, profile_id)
);

create index event_rsvps_going_idx on public.event_rsvps (event_id) where status = 'going';

create trigger event_rsvps_updated_at
  before update on public.event_rsvps
  for each row execute function public.set_updated_at();

-- Personal calendar: RSVP'd events come from event_rsvps joined to events;
-- everything else — personal entries, birthdays, custom reminders — lives
-- here, strictly private to its owner.
create table public.calendar_entries (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  kind           text not null check (kind in ('personal', 'birthday', 'custom_reminder')),
  title          text not null check (char_length(title) between 1 and 200),
  entry_date     date not null,
  entry_time     time,
  -- Birthdays recur; the client projects the next occurrence.
  repeats_yearly boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index calendar_entries_owner_idx on public.calendar_entries (owner_id, entry_date);

create trigger calendar_entries_updated_at
  before update on public.calendar_entries
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — events
-- ----------------------------------------------------------------------------
alter table public.events enable row level security;
revoke all on public.events from anon;

-- Every signed-in role sees published events (Fam explicitly included —
-- SPEC.md: "Fam members can see events so they can bring their parent").
create policy "signed-in read published events"
  on public.events for select
  using (is_published or public.is_admin());

-- Event operations are support work: both admin levels manage events.
create policy "admins create events"
  on public.events for insert
  with check (public.is_admin() and created_by = auth.uid());

create policy "admins update events"
  on public.events for update
  using (public.is_admin());

create policy "admins delete events"
  on public.events for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS — event_rsvps (writes go through the RPCs only)
-- ----------------------------------------------------------------------------
alter table public.event_rsvps enable row level security;
revoke all on public.event_rsvps from anon;

create policy "read own rsvps"
  on public.event_rsvps for select
  using (profile_id = auth.uid());

-- Admins run the door list and the at-event check-in.
create policy "admins read rsvps"
  on public.event_rsvps for select
  using (public.is_admin());

create policy "admins update rsvps"
  on public.event_rsvps for update
  using (public.is_admin());

-- No insert/update policy for attendees: rsvp_to_event / cancel_event_rsvp
-- below are the only doors, so capacity can never be raced past.

-- ----------------------------------------------------------------------------
-- RLS — calendar_entries (owner-only; not even admins)
-- ----------------------------------------------------------------------------
alter table public.calendar_entries enable row level security;
revoke all on public.calendar_entries from anon;

create policy "owner reads calendar"
  on public.calendar_entries for select
  using (owner_id = auth.uid());

create policy "owner writes calendar"
  on public.calendar_entries for insert
  with check (owner_id = auth.uid() and public.account_ok());

create policy "owner updates calendar"
  on public.calendar_entries for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner deletes calendar"
  on public.calendar_entries for delete
  using (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Going-count without exposing the list: definer function, published only.
-- ----------------------------------------------------------------------------
create or replace function public.event_going_count(p_event uuid)
returns integer
language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.event_rsvps r
  join public.events e on e.id = r.event_id
  where r.event_id = p_event
    and r.status = 'going'
    and (e.is_published or public.is_admin());
$$;

revoke execute on function public.event_going_count(uuid) from public, anon;
grant execute on function public.event_going_count(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- RSVP RPCs. Capacity is enforced under a lock on the event row; a
-- cancelled RSVP flipping back to going re-checks it the same way.
-- ----------------------------------------------------------------------------
create or replace function public.rsvp_to_event(p_event uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_going integer;
  v_id    uuid;
begin
  if public.app_role() is distinct from 'saath_icon' or not public.account_ok() then
    raise exception 'Only a Saath-Icon can RSVP to an event';
  end if;

  select * into v_event from public.events
  where id = p_event and is_published
  for update;

  if not found then
    raise exception 'That event is not open for RSVPs';
  end if;

  if v_event.event_date < current_date then
    raise exception 'That event has already happened';
  end if;

  if v_event.capacity is not null then
    select count(*) into v_going from public.event_rsvps
    where event_id = p_event and status = 'going';
    if v_going >= v_event.capacity then
      raise exception 'That event is full';
    end if;
  end if;

  insert into public.event_rsvps (event_id, profile_id, status)
  values (p_event, auth.uid(), 'going')
  on conflict (event_id, profile_id)
    do update set status = 'going', checked_in_at = null
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.rsvp_to_event(uuid) from public, anon;
grant execute on function public.rsvp_to_event(uuid) to authenticated;

create or replace function public.cancel_event_rsvp(p_event uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.event_rsvps
  set status = 'cancelled'
  where event_id = p_event and profile_id = auth.uid();
end;
$$;

revoke execute on function public.cancel_event_rsvp(uuid) from public, anon;
grant execute on function public.cancel_event_rsvp(uuid) to authenticated;
