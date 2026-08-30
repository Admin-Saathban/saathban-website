-- ════════════════════════════════════════════════
-- 0050 — applied 2026-08-30. Registered in supabase/MIGRATIONS.md.
-- 0050 was claimed for the rewards table and released the same day when
-- themes went derived; the registrar asked for it to be reused rather than
-- left as a hole in the sequence. A3 stickers will take the next number.
--
-- GAMES_BACKLOG A1: "Public result page at /app/g/<id>, openable with
-- no account: the card, who played, and a 'Play Ludo on Saathban'
-- route into signup. No private data beyond names already public in
-- community."
--
-- THIS IS THE FIRST DELIBERATE ANON GRANT IN THE SCHEMA, and it should
-- be read as one. Every other migration revokes from anon; the app is
-- closed to the world by construction. So the surface here is drawn as
-- small as it can be while still being the feature that was asked for:
--
--   · FINISHED GAMES ONLY. A live table is never readable by a
--     stranger — no watching someone play from outside the app.
--   · NAMES AND THE BOARD, nothing else. No profile ids, so nothing
--     can be joined back to a person. No avatar urls: a photo is a
--     storage path, and handing one to the world is a different
--     decision from handing over a first name. The public card draws
--     initials. No chat, no join code, no house rules, no seats that
--     could be claimed.
--   · THE URL IS THE KEY. A session id is a uuid4 and unguessable,
--     which is the whole security model — the same one the join link
--     already uses. Anyone the link is forwarded to can read it. That
--     is what sharing means, and it is what A1 asks for, but it should
--     be a decision somebody made rather than a side effect.
--
-- What it is NOT: an index, a listing, or anything enumerable. There
-- is no way to ask this function for "recent games" or "games by
-- person". One id in, one game out.
-- ════════════════════════════════════════════════

create or replace function public.public_game_result(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when s.id is null then null
    else jsonb_build_object(
      'game_key',    s.game_key,
      'finished_at', s.finished_at,
      'seats_total', s.seats_total,
      'winner_seat', s.winner_seat,
      -- The final board, for the mini board on the card. Positions
      -- only: the state blob also carries dice, chains and the move
      -- chatter, none of which is anyone else's business.
      'pieces',      s.state -> 'pieces',
      'seats', (
        select coalesce(jsonb_agg(
                 jsonb_build_object(
                   'seat_no', t.seat_no,
                   'is_bot',  t.is_bot,
                   -- A first name, or nothing. Never the profile id.
                   'name',    case when t.is_bot then null else p.full_name end
                 ) order by t.seat_no), '[]'::jsonb)
        from public.game_seats t
        left join public.profiles p on p.id = t.profile_id
        where t.session_id = s.id
      )
    )
  end
  from public.game_sessions s
  where s.id = p_session
    and s.status = 'finished';
$$;

-- Definer functions run as their owner, so the grant IS the boundary.
revoke all on function public.public_game_result(uuid) from public;
grant execute on function public.public_game_result(uuid) to anon, authenticated;

comment on function public.public_game_result(uuid) is
  'A finished game, for the shareable result page. Names and final '
  'board only; no ids, photos, chat or codes. Finished games only. '
  'Readable by anon BY DESIGN — the unguessable session id is the key, '
  'as with join links. Not enumerable: one id in, one game out.';
