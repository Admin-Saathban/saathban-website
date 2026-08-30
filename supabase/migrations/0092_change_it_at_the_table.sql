/* ════════════════════════════════════════════════
   0092 — change it at the table

   GAMES_IMMERSION_SPEC §8: "Seats, invites, colour, one-die-or-two
   and the table name are all changed AT THE TABLE, by tapping the
   thing itself."

   §8's first half — tapping a game opens a playable table with no
   form — landed in the commit before this one. It only holds up if
   the questions the form used to ask can still be answered, and the
   place to answer them is the table.

   WHY THIS IS SAFE, AND WHERE THE LINE IS. Ludo's state is built
   LAZILY: ludo_roll calls ludo_state_init(seats_total, house_rules)
   on the first roll of the table and not before. So until somebody
   rolls, seats_total and house_rules are not a record of a game in
   progress — they are still the description of a game about to
   start, exactly as they were on the setup screen. Editing them then
   rewrites nothing, because there is nothing yet to rewrite.

   The moment a die is thrown that stops being true, and both
   functions below refuse. The test is deliberately doubled: the
   state must carry no pieces AND the session must have no recorded
   moves. Either alone would be enough today; together they still
   hold if a future game_exec writes its state before its first move,
   or records a move before its state.

   NO CONFIRM DIALOGS, NO "ARE YOU SURE". Nothing here can destroy
   anything — a table nobody has played is worth exactly what it
   costs to make another one — so the tap does the thing.
   ════════════════════════════════════════════════ */

/* ── Is this table still soft? ──────────────────────────────────
   One place, so the two functions below cannot drift apart on the
   meaning of "not started yet". */
create or replace function public.game_table_is_soft(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    coalesce(
      (select not (gs.state ? 'pieces')
         and not exists (select 1 from public.game_moves m where m.session_id = gs.id)
       from public.game_sessions gs
       where gs.id = p_session
         and gs.status in ('lobby', 'active')),
      false
    );
$function$;

comment on function public.game_table_is_soft(uuid) is
  'True while a table has been set but not played: no state pieces and no recorded moves. The window in which §8 edits are free.';

/* ── Re-form the table ──────────────────────────────────────────
   Seats, dice count, name. Called by the host, from the board.

   Every argument is optional and null means "leave it". A caller
   that wants to change one thing sends one thing — the shape of the
   tap, rather than the shape of a form that submits all its fields
   whether or not you touched them. */
create or replace function public.game_reform_table(
  p_session uuid,
  p_seats smallint default null,
  p_house_rules jsonb default null,
  p_title text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.game_sessions%rowtype;
  v_people int;
  v_have int;
  v_want int;
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
    raise exception 'The game has begun — this cannot be changed now';
  end if;

  if p_title is not null then
    update public.game_sessions
    set title = nullif(btrim(p_title), ''), updated_at = now()
    where id = p_session;
  end if;

  if p_house_rules is not null then
    /* MERGED, not replaced. The caller sends the one key it is
       changing; turn_seconds, table_theme and everything else the
       table was opened with survive a tap on the dice. */
    update public.game_sessions
    set house_rules = coalesce(house_rules, '{}'::jsonb) || p_house_rules,
        updated_at = now()
    where id = p_session;
  end if;

  if p_seats is not null then
    /* THE FLOOR IS WHERE THE PEOPLE ARE SITTING, not how many there
       are. Counting them was wrong in a way that only shows up after
       somebody changes colour: a host who has moved to the yellow
       seat is one person, so a count-based floor of 2 would happily
       set seats_total to 2 and leave their row sitting at seat 3 —
       a table of two with a player outside it, which the board
       cannot draw and the turn order cannot reach. The highest seat
       a person actually occupies is the real floor. */
    select coalesce(max(seat_no), 0) into v_people
    from public.game_seats
    where session_id = p_session and not is_bot;

    v_want := greatest(p_seats::int, greatest(v_people, 2));
    if v_want > 4 then v_want := 4; end if;

    /* Bots come off the END, so nobody's colour moves under them
       because somebody else left. A seat with a person in it is
       never taken away here — the way to remove a person is for
       that person to leave. */
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
$function$;

comment on function public.game_reform_table(uuid, smallint, jsonb, text) is
  '§8: the host changes seats / house rules / name AT THE TABLE, while it is still soft (game_table_is_soft).';

/* ── Take a different seat ──────────────────────────────────────
   THIS IS WHAT "CHANGE YOUR COLOUR" ACTUALLY IS.

   A ludo board's four quadrants are blue, red, yellow and green in
   that order, always — the owner's instruction was explicit that the
   colour assigned to a seat stays the colour of that seat. So the
   colour picker on the old setup form was choosing a SEAT and
   calling it a colour, and it wrote house_rules.seat_colours, which
   the ludo board has never read.

   Here you tap the red corner and you are sitting in it. The bot
   that was there takes the seat you left, so the table stays the
   size it was and no one has to think about seat numbers. */
create or replace function public.game_take_seat(p_session uuid, p_seat smallint)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.game_sessions%rowtype;
  v_mine int;
  v_target public.game_seats%rowtype;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found then
    raise exception 'No such table';
  end if;
  if not public.game_table_is_soft(p_session) then
    raise exception 'The game has begun — seats are settled now';
  end if;

  select seat_no into v_mine
  from public.game_seats
  where session_id = p_session and profile_id = auth.uid();
  if v_mine is null then
    raise exception 'You are not at this table';
  end if;
  if v_mine = p_seat then
    return;
  end if;

  select * into v_target
  from public.game_seats
  where session_id = p_session and seat_no = p_seat
  for update;
  if not found then
    raise exception 'There is no such seat at this table';
  end if;
  if not v_target.is_bot then
    raise exception 'Someone is sitting there';
  end if;

  /* VACATE, THEN CLAIM — in that order, and never as one statement.
     game_seats carries a unique index on (session_id, profile_id),
     so any write that has my id in two seats at once fails, and a
     single UPDATE touching both rows is exactly that write for as
     long as it takes to reach the second row. Emptying my old seat
     first means the id is never in two places. */
  update public.game_seats
  set profile_id = null, is_bot = true
  where session_id = p_session and seat_no = v_mine;

  update public.game_seats
  set profile_id = auth.uid(), is_bot = false
  where session_id = p_session and seat_no = p_seat;
end;
$function$;

comment on function public.game_take_seat(uuid, smallint) is
  '§8: swap into a bot''s seat before the first roll. This is the colour picker — on a ludo board the colour IS the seat.';

revoke all on function public.game_table_is_soft(uuid) from public;
revoke all on function public.game_reform_table(uuid, smallint, jsonb, text) from public;
revoke all on function public.game_take_seat(uuid, smallint) from public;
grant execute on function public.game_table_is_soft(uuid) to authenticated;
grant execute on function public.game_reform_table(uuid, smallint, jsonb, text) to authenticated;
grant execute on function public.game_take_seat(uuid, smallint) to authenticated;
