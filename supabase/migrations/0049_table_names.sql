/* ═══════════════════════════════════════════════════════════════
   0049 — a table can have a name

   "Sunday chai match" is not decoration. A table that is only ever
   "Ludo" is indistinguishable from every other table in a history
   list, and the thing a person actually remembers about a game is
   never the game — it is the occasion. So the name is stored once,
   on the session, and every screen that shows a table reads it.

   NULLABLE ON PURPOSE. Naming is optional and always will be: a
   table opened in ten seconds because somebody wanted to play right
   now must not stop to be titled. Everywhere it renders, absent
   means the screen simply shows what it showed before — never an
   empty slot, a placeholder, or "Untitled table".

   WHO CAN SEE IT. The title lives on game_sessions and inherits that
   table's existing RLS exactly: participants, and anyone holding the
   join code for an open table. That last group can include people
   the host has never met, so the name of an OPEN table is public to
   whoever joins it. The setup screen says so in the one place it
   matters — beside the field, only when the table is open — rather
   than in a policy nobody reads.

   Normalisation happens HERE, not in the client, because there are
   two doors into session creation (the setup screen and the ludo
   rails) and a rule enforced in one of them is not a rule.
   ═══════════════════════════════════════════════════════════════ */

alter table public.game_sessions
  add column if not exists title text;

/* 60 characters is a name, not a paragraph. The constraint is on the
   stored value, so it holds against any writer — including a future
   one that forgets to trim. */
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_sessions_title_len'
  ) then
    alter table public.game_sessions
      add constraint game_sessions_title_len
      check (title is null or char_length(title) between 1 and 60);
  end if;
end
$$;

/* One place that decides what a title IS: trimmed, inner runs of
   whitespace collapsed (so a name pasted with a newline in it does
   not render as a gap), empty becomes NULL rather than an empty
   string, and hard-capped. Immutable so it can be used in a check or
   an index later without surprises. */
create or replace function public.normalise_table_title(p_title text)
returns text
language sql
immutable
as $function$
  select nullif(
    left(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), 60),
    ''
  );
$function$;

/* THE OVERLOAD TRAP — read before editing.

   "create or replace function" with a DIFFERENT number of parameters
   does not replace anything: it creates a second function beside the
   first. Both then match a three-argument call, PostgREST refuses it
   as not unique, and every existing caller — the ludo rails, the
   setup screen, the smoke suite — starts failing at once on a change
   that looked additive. The old signature must be dropped explicitly,
   AFTER the new one exists so there is no window with neither.

   create_game_session gains the title as a LAST parameter with a
   default, so every existing 3-argument caller — the ludo rails, the
   smoke suite, anything else — keeps working untouched and simply
   creates unnamed tables. */
create or replace function public.create_game_session(
  p_game text,
  p_seats smallint,
  p_house_rules jsonb default '{}'::jsonb,
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  g public.games%rowtype;
  v_id uuid;
begin
  if not public.can_use_community() then
    raise exception 'Community access required';
  end if;
  select * into g from public.games where key = p_game and enabled and kind = 'turns';
  if g.key is null then raise exception 'Unknown game'; end if;
  if p_seats < g.min_seats or p_seats > g.max_seats then
    raise exception 'This game seats % to % players', g.min_seats, g.max_seats;
  end if;

  insert into public.game_sessions (game_key, seats_total, house_rules, created_by, join_code, title)
  values (
    p_game, p_seats, coalesce(p_house_rules, '{}'), auth.uid(),
    lpad(floor(random() * 1000000)::int::text, 6, '0'),
    public.normalise_table_title(p_title)
  )
  returning id into v_id;

  insert into public.game_seats (session_id, seat_no, profile_id)
  values (v_id, 1, auth.uid());
  return v_id;
end;
$function$;

/* Now, and only now, remove the three-argument version. Callers that
   pass three named arguments resolve to the four-argument function
   and get p_title => null, which is exactly an unnamed table. */
drop function if exists public.create_game_session(text, smallint, jsonb);

revoke execute on function public.normalise_table_title(text) from public, anon;
grant execute on function public.normalise_table_title(text) to authenticated;
grant execute on function public.create_game_session(text, smallint, jsonb, text) to authenticated;
