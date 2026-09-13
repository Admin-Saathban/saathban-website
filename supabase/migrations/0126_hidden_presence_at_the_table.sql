/* ═══════════════════════════════════════════════════════════════
   0126 — hidden presence stays hidden at the table

   The owner: a person who has turned presence off has said so once, for
   everywhere. game_seats carried two presence signals readable by
   everyone who can view a table — `presence` ('away' after missed turns,
   shown as "a bot is keeping their seat") and `last_seen_at` (when they
   last looked at the table) — and "in a game" chips on a person's page
   and the family card read their live seats directly.

   The game itself still needs the truth (game_tick plays for an absent
   seat), and it reads the table as its owner, so nothing about play
   changes. What changes is what OTHER PEOPLE can read:
   · game_table_seats(session): the seats of a table the caller may view,
     with presence null for anyone (not a bot, not the caller) whose
     show_presence is off. last_seen_at is not returned at all.
   · person_in_game(profile): the live table a person is at, only when
     the caller may view that table AND the person shows presence (or is
     the caller).
   0127 closes the direct column reads once the app has moved.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.game_table_seats(p_session uuid)
returns table (seat_no smallint, profile_id uuid, is_bot boolean, presence text, missed_turns smallint, score integer)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select gs.seat_no, gs.profile_id, gs.is_bot,
         case when gs.is_bot or gs.profile_id = auth.uid() or coalesce(p.show_presence, true) then gs.presence end,
         gs.missed_turns, gs.score
  from public.game_seats gs
  left join public.profiles p on p.id = gs.profile_id
  where gs.session_id = p_session
    and auth.uid() is not null
    and public.can_view_game(p_session)
  order by gs.seat_no;
$$;

create or replace function public.person_in_game(p_profile uuid)
returns table (session_id uuid, game_key text)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select gs.session_id, s.game_key
  from public.game_seats gs
  join public.game_sessions s on s.id = gs.session_id
  join public.profiles p on p.id = gs.profile_id
  where gs.profile_id = p_profile
    and s.status in ('lobby', 'active')
    and auth.uid() is not null
    and (p_profile = auth.uid() or coalesce(p.show_presence, true))
    and public.can_view_game(gs.session_id)
  order by s.created_at desc
  limit 1;
$$;

revoke all on function public.game_table_seats(uuid) from public, anon;
revoke all on function public.person_in_game(uuid) from public, anon;
grant execute on function public.game_table_seats(uuid) to authenticated;
grant execute on function public.person_in_game(uuid) to authenticated;
