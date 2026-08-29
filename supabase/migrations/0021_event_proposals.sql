-- ============================================================================
-- 0021 — Event proposals ("Suggest a gathering")
--
-- An Icon suggests a gathering — a title, a place (picked from outdoor_places
-- or typed freely), a date/time, and a note. It lands here as `pending`. An
-- admin reviews it in the events Manage screen and either:
--   - approves  → a published event is created, crediting the proposer in its
--                 description ("Suggested by Iqbal"), and the proposer is told;
--   - declines  → with a kind, required message, delivered to the proposer as
--                 an in-app notification.
--
-- Submitting is a direct insert (RLS-guarded). Approve/decline are admin-only
-- SECURITY DEFINER RPCs so the status flip, the event creation, and the
-- notification happen atomically and cannot be raced or half-applied.
-- ============================================================================

create table public.event_proposals (
  id               uuid primary key default gen_random_uuid(),
  proposer_id      uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 200),
  -- A place picked from the outdoor list, OR free text — at least one.
  place_id         uuid references public.outdoor_places (id) on delete set null,
  place_text       text check (place_text is null or char_length(place_text) <= 200),
  event_date       date not null,
  start_time       time,
  note             text check (note is null or char_length(note) <= 2000),
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'declined')),
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  decline_message  text,
  -- Set when approved: the published event this became.
  created_event_id uuid references public.events (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint proposal_has_a_place
    check (place_id is not null or nullif(btrim(place_text), '') is not null)
);

create index event_proposals_pending_idx
  on public.event_proposals (created_at) where status = 'pending';
create index event_proposals_proposer_idx
  on public.event_proposals (proposer_id, created_at desc);

create trigger event_proposals_updated_at
  before update on public.event_proposals
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.event_proposals enable row level security;
revoke all on public.event_proposals from anon;

-- The proposer sees their own proposals (status, and any decline message).
create policy "proposer reads own proposals"
  on public.event_proposals for select
  using (proposer_id = auth.uid());

-- Admins see every proposal (the Manage queue).
create policy "admins read all proposals"
  on public.event_proposals for select
  using (public.is_admin());

-- An Icon in good standing submits their own proposal, always as pending and
-- unreviewed. Editing/withdrawing after submission is not offered in v1, so
-- there is deliberately no update/delete policy — approve/decline run through
-- the definer RPCs below.
create policy "icon submits a proposal"
  on public.event_proposals for insert
  with check (
    proposer_id = auth.uid()
    and public.app_role() = 'saath_icon'
    and public.account_ok()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and created_event_id is null
    and decline_message is null
  );

-- ----------------------------------------------------------------------------
-- Approve: create the published event (crediting the proposer) and tell them.
-- ----------------------------------------------------------------------------
create or replace function public.approve_event_proposal(p_proposal uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_p       public.event_proposals%rowtype;
  v_first   text;
  v_place   public.outdoor_places%rowtype;
  v_venue   text;
  v_city    text;
  v_desc    text;
  v_event   uuid;
begin
  if not public.is_admin() then
    raise exception 'Only Saathban staff can review proposals';
  end if;

  select * into v_p from public.event_proposals
  where id = p_proposal for update;
  if not found then
    raise exception 'That proposal no longer exists';
  end if;
  if v_p.status <> 'pending' then
    raise exception 'That proposal has already been reviewed';
  end if;

  -- Proposer's first name for the credit (definer read; names are safe).
  select split_part(btrim(full_name), ' ', 1) into v_first
  from public.profiles where id = v_p.proposer_id;
  v_first := coalesce(nullif(v_first, ''), 'a member');

  -- Place → venue/city, from the listed place or the free text.
  if v_p.place_id is not null then
    select * into v_place from public.outdoor_places where id = v_p.place_id;
    if found then
      v_venue := v_place.name || case when v_place.area is not null then ', ' || v_place.area else '' end;
      v_city  := v_place.city;
    end if;
  end if;
  if v_venue is null then
    v_venue := nullif(btrim(v_p.place_text), '');
  end if;

  -- Description carries the proposer's note (if any) plus the credit line.
  v_desc := coalesce(nullif(btrim(v_p.note), '') || E'\n\n', '')
            || 'Suggested by ' || v_first || '.';

  insert into public.events
    (title, description, venue, city, event_date, start_time, is_published, created_by)
  values
    (v_p.title, v_desc, v_venue, v_city, v_p.event_date, v_p.start_time, true, auth.uid())
  returning id into v_event;

  update public.event_proposals
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      created_event_id = v_event
  where id = p_proposal;

  -- Let the proposer know their gathering is live.
  insert into public.notifications (profile_id, title, body, kind, created_by)
  values (
    v_p.proposer_id,
    'Your gathering is happening!',
    'Thank you for suggesting “' || v_p.title || '”. It''s now on the events page for everyone to join.',
    'general',
    auth.uid()
  );

  return v_event;
end;
$$;

revoke execute on function public.approve_event_proposal(uuid) from public, anon;
grant execute on function public.approve_event_proposal(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Decline: with a required, kind message, delivered as a notification.
-- ----------------------------------------------------------------------------
create or replace function public.decline_event_proposal(p_proposal uuid, p_message text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.event_proposals%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only Saathban staff can review proposals';
  end if;
  if coalesce(char_length(btrim(p_message)), 0) < 1 then
    raise exception 'A short message to the proposer is required';
  end if;

  select * into v_p from public.event_proposals
  where id = p_proposal for update;
  if not found then
    raise exception 'That proposal no longer exists';
  end if;
  if v_p.status <> 'pending' then
    raise exception 'That proposal has already been reviewed';
  end if;

  update public.event_proposals
  set status = 'declined', reviewed_by = auth.uid(), reviewed_at = now(),
      decline_message = btrim(p_message)
  where id = p_proposal;

  insert into public.notifications (profile_id, title, body, kind, created_by)
  values (
    v_p.proposer_id,
    'About your gathering suggestion',
    'About “' || v_p.title || '”: ' || btrim(p_message),
    'general',
    auth.uid()
  );
end;
$$;

revoke execute on function public.decline_event_proposal(uuid, text) from public, anon;
grant execute on function public.decline_event_proposal(uuid, text) to authenticated;
