/* ════════════════════════════════════════════════
   0096 — a code still opens a table

   A REGRESSION I CAUSED, found by running the smoke suite rather
   than by reading anything.

   join_by_code looks for `status = 'lobby'`. That was right for as
   long as a table waited empty before it started. GAMES_IMMERSION
   §8 means a table is 'active' from the instant it is tapped into
   existence — so after that change NO code ever matched, for any
   table, and "Have a code?" on the games home became a door to
   nothing. Every table still carries a six-digit code; not one of
   them could be used.

   The fix is the one 0093 already made for invitations: a person
   arriving at a table nobody has played takes over a seat a bot is
   holding. Same window (game_table_is_soft), same reasoning — the
   bot keeps the table alive while somebody is on their way, and
   taking over a position the bot has already built would be handing
   them a different game from the one they were called to.

   WHAT IS DELIBERATELY NOT CHANGED: a table that has been PLAYED
   still refuses a code. Walking into a game in progress is a
   different feature (spectating, LANE C) and it is not this one.

   The function is restated whole from the live definition read
   immediately before the change. The only addition is the branch
   marked NEW; the rate limit, the already-seated shortcut and the
   'filled' path are untouched.
   ════════════════════════════════════════════════ */

create or replace function public.join_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_code text;
  v_session uuid;
  v_tries int;
  v_seat int;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;

  delete from public.code_tries
  where profile_id = auth.uid() and tried_at < now() - interval '1 hour';
  select count(*) into v_tries from public.code_tries
  where profile_id = auth.uid() and tried_at > now() - interval '5 minutes';
  if v_tries >= 12 then
    raise exception 'That''s a lot of codes — take a breath and try again in a few minutes';
  end if;
  insert into public.code_tries (profile_id) values (auth.uid());

  v_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');

  /* Already at this table: the code just takes you back to it. */
  select s.id into v_session
  from public.game_sessions s
  join public.game_seats gs on gs.session_id = s.id and gs.profile_id = auth.uid()
  where s.join_code = v_code and s.status in ('lobby', 'active')
  order by s.created_at desc limit 1;
  if v_session is not null then
    return jsonb_build_object('result', 'joined', 'session_id', v_session);
  end if;

  /* NEW (0096) — A TABLE THAT IS PLAYING BUT HAS NOT BEEN PLAYED.
     Every §8 table is one of these from the moment it exists. The
     lowest seat a bot is holding becomes theirs. */
  select s.id into v_session
  from public.game_sessions s
  where s.join_code = v_code
    and s.status = 'active'
    and public.game_table_is_soft(s.id)
  order by s.created_at desc limit 1;
  if v_session is not null then
    select min(seat_no) into v_seat
    from public.game_seats
    where session_id = v_session and is_bot;
    if v_seat is null then
      return jsonb_build_object('result', 'filled');
    end if;
    update public.game_seats
    set profile_id = auth.uid(), is_bot = false, presence = 'active', missed_turns = 0
    where session_id = v_session and seat_no = v_seat;
    return jsonb_build_object('result', 'joined', 'session_id', v_session);
  end if;

  select id into v_session from public.game_sessions
  where join_code = v_code and status = 'lobby';
  if v_session is null then
    return jsonb_build_object('result', 'no_table');
  end if;

  begin
    perform public.claim_open_seat(v_session);
  exception when others then
    return jsonb_build_object('result', 'filled');
  end;
  return jsonb_build_object('result', 'joined', 'session_id', v_session);
end;
$function$;
