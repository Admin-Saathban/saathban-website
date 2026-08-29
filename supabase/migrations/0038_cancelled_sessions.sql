-- ============================================================================
-- 0038 — Cancelling a table that never started
--
-- Until now "Cancel" in the waiting room could only walk away: the status
-- CHECK allowed lobby/active/finished and nothing else, so there was no way to
-- say a table was called off.
--
-- Deleting the row is NOT the answer, and it is the whole reason this is a
-- migration rather than a delete: dm_messages.game_session_id references
-- game_sessions ON DELETE CASCADE, so deleting a cancelled session would
-- silently destroy a message inside someone's conversation — and a carrom
-- table started from a DM is the common case. A cancelled table therefore
-- keeps its row, its seats and its history; it simply stops being playable and
-- stops appearing anywhere a live table would.
--
-- Cancelling is host-only and lobby-only: once play has begun there is a game
-- to finish, not a plan to call off.
--
-- The guards are TRIGGERS, deliberately, not rewrites of claim_open_seat /
-- respond_game_invite: those carry eligibility and connection gates added in
-- 0025 and replaced again in 0029, and redefining them here to add one check
-- would risk regressing rules this migration has no business touching. A
-- trigger holds the invariant for EVERY path — today's RPCs, the ludo lane's,
-- and whatever is written next.
-- ============================================================================

alter table public.game_sessions drop constraint game_sessions_status_check;
alter table public.game_sessions
  add constraint game_sessions_status_check
  check (status in ('lobby', 'active', 'finished', 'cancelled'));

-- ----------------------------------------------------------------------------
-- Invariant 1: nobody sits down at a called-off table.
-- Covers claim_open_seat, invite acceptance, bots — every writer.
-- ----------------------------------------------------------------------------
create or replace function public.no_seats_at_cancelled_table()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.game_sessions
    where id = new.session_id and status = 'cancelled'
  ) then
    raise exception 'That table was called off';
  end if;
  return new;
end;
$$;

drop trigger if exists game_seats_not_cancelled on public.game_seats;
create trigger game_seats_not_cancelled
  before insert on public.game_seats
  for each row execute function public.no_seats_at_cancelled_table();

-- ----------------------------------------------------------------------------
-- Invariant 2: no new invitation to a called-off table, and none may be
-- accepted afterwards. (Moving an existing invite to 'declined' stays legal —
-- that is how cancelling closes them.)
-- ----------------------------------------------------------------------------
create or replace function public.no_invites_to_cancelled_table()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.game_sessions
    where id = new.session_id and status = 'cancelled'
  ) and coalesce(new.status, 'pending') <> 'declined' then
    raise exception 'That table was called off';
  end if;
  return new;
end;
$$;

drop trigger if exists game_invites_not_cancelled on public.game_invites;
create trigger game_invites_not_cancelled
  before insert or update on public.game_invites
  for each row execute function public.no_invites_to_cancelled_table();

-- ----------------------------------------------------------------------------
-- Call off a table. Host only, lobby only, idempotent.
-- Everyone who was invited or already seated is told once, in plain words;
-- the host isn't told what they just did. The link points at the games list,
-- not at a table that is no longer a destination.
-- ----------------------------------------------------------------------------
create or replace function public.cancel_game_session(p_session uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s      public.game_sessions%rowtype;
  v_who  text;
  v_name text;
  r      record;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if s.id is null then
    raise exception 'That table is gone';
  end if;
  if s.created_by is distinct from auth.uid() then
    raise exception 'Only the person who set the table can call it off';
  end if;
  if s.status = 'cancelled' then
    return;                        -- idempotent: a double tap is not an error
  end if;
  if s.status <> 'lobby' then
    raise exception 'This game has already started';
  end if;

  update public.game_sessions set status = 'cancelled' where id = p_session;

  select full_name into v_who from public.profiles where id = auth.uid();
  select coalesce(g.name_en, s.game_key) into v_name from public.games g where g.key = s.game_key;

  for r in
    select distinct pid from (
      select invitee_id as pid from public.game_invites
       where session_id = p_session and status = 'pending'
      union
      select profile_id from public.game_seats
       where session_id = p_session and profile_id is not null
    ) x
    where pid is not null and pid <> auth.uid()
  loop
    insert into public.notifications (profile_id, title, body, kind, link, created_by)
    values (
      r.pid,
      coalesce(v_name, 'A game') || ' — called off',
      coalesce(v_who, 'The host') || ' called off the ' || coalesce(v_name, 'game') || ' table.',
      'game',
      '/app/games',
      auth.uid()
    );
  end loop;

  -- Outstanding invitations stop standing.
  --
  -- DECLINE THEM — DO NOT DELETE THEM. This looks like tidiness and is
  -- actually load-bearing: can_view_game() (0022) grants read access to
  -- anyone holding an invite row for the session, with NO filter on that
  -- invite's status. Declining keeps the row, so the invitee can still read
  -- the session and lands on the "this table was called off" sentence.
  -- Deleting the row would revoke their read access, RLS would return
  -- nothing, and the person the message exists for would instead be told the
  -- table is "private to its players" — the exact misleading line this
  -- feature was built to replace. Seated players are covered the same way by
  -- is_game_participant. Please do not "clean this up" into a delete.
  update public.game_invites
  set status = 'declined', decided_at = now()
  where session_id = p_session and status = 'pending';
end;
$$;

revoke execute on function public.cancel_game_session(uuid) from public, anon;
grant execute on function public.cancel_game_session(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- A cancelled table must not be reachable by its join code. The code index is
-- partial on status='lobby', so a cancelled row leaves it automatically and
-- join_by_code (which matches on status='lobby') stops finding it. Recorded
-- here as a checked invariant, not an assumption.
--
-- game_tick sweeps status='active' only, so a cancelled table is never ticked.
-- ----------------------------------------------------------------------------
