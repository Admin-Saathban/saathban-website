-- ============================================================================
-- 0108 — game_reform_table stops believing every game seats four.
--
-- Found by the ludo lane while checking the seat-cap widening in
-- 0106/0107, and it is the FOURTH home of "how many may sit here":
--
--     v_want := greatest(p_seats::int, greatest(v_people, 2));
--     if v_want > 4 then v_want := 4; end if;
--
-- The literal was true when it was written, because every game seated
-- four or fewer. Snakes now seats eight, and game_reform_table is the
-- GENERIC resize RPC — nothing in it is ludo-specific. A host asking
-- for eight through that path would get four, with no error at all,
-- and would silently lose the bot seats above four on the way.
--
-- NOTHING REACHES IT TODAY: every caller is in routes/games/ludo/, and
-- snakes resizes through snakes_set_table, which validates 2..8
-- itself. This is a trap being disarmed before anything falls into it
-- rather than a bug being fixed — but it is exactly the shape that
-- costs an afternoon later, because it fails quietly and the number
-- that comes back looks deliberate.
--
-- games.min_seats/max_seats is already the per-game authority that
-- create_game_session enforces. Reading it here makes this function
-- give the same answer as the front door instead of a second opinion.
--
-- Per game: ludo 4, unchanged, and it is the only real caller today.
-- Snakes 8. Carrom clamps to 2 rather than 4, which is what its
-- registry row has always said and what its create path has always
-- enforced — a four-seat carrom table could never legitimately exist.
-- ============================================================================

create or replace function public.game_reform_table(
  p_session uuid,
  p_seats smallint default null,
  p_house_rules jsonb default null,
  p_title text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.game_sessions%rowtype;
  v_people int;
  v_have int;
  v_want int;
  v_max int;
  i int;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found then
    raise exception 'No such table';
  end if;
  if s.created_by <> auth.uid() then
    raise exception 'Only the person who opened the table can change it';
  end if;
  if not public.game_table_is_soft(p_session) then
    raise exception 'The game has begun - this cannot be changed now';
  end if;

  if p_title is not null then
    update public.game_sessions
    set title = nullif(btrim(p_title), ''), updated_at = now()
    where id = p_session;
  end if;

  if p_house_rules is not null then
    update public.game_sessions
    set house_rules = coalesce(house_rules, '{}'::jsonb) || p_house_rules,
        updated_at = now()
    where id = p_session;
  end if;

  if p_seats is not null then
    -- the floor is the highest seat a PERSON occupies, not how many
    select coalesce(max(seat_no), 0) into v_people
    from public.game_seats
    where session_id = p_session and not is_bot;

    -- THE CEILING IS THIS GAME'S, not a number from when every game
    -- seated four. Falls back to 4 only if the registry row is gone,
    -- which would mean a session for a game that no longer exists.
    select max_seats into v_max from public.games where key = s.game_key;
    v_max := coalesce(v_max, 4);

    v_want := greatest(p_seats::int, greatest(v_people, 2));
    if v_want > v_max then v_want := v_max; end if;

    delete from public.game_seats
    where session_id = p_session and is_bot and seat_no > v_want;

    select count(*) into v_have from public.game_seats where session_id = p_session;
    for i in (v_have + 1) .. v_want loop
      insert into public.game_seats (session_id, seat_no, profile_id, is_bot)
      values (p_session, i, null, true);
    end loop;

    update public.game_sessions
    set seats_total = v_want::smallint, updated_at = now()
    where id = p_session;
  end if;
end;
$$;
