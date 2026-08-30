/* ════════════════════════════════════════════════
   0095 — your own gotis

   GAMES_BACKLOG LANE B, and the owner's own words twice over:
   "YOU CANNOT TELL WHICH GOTI IS WHICH… you can name each goti if you
   want, also one should be able to change or design their own emojis
   but color should mainly be the same respective ie blue red yellow
   green which was assigned originally."

   Two halves, and only the second one is here. The first — that a
   goti is large enough to carry a mark at all, and that the mark is
   drawn where a numeral used to be — is already in Pawn.jsx, which
   has taken a `mark` prop since the crown landed and has had nobody
   to pass it one. This is the somewhere to store that choice.

   WHAT IS AND IS NOT STORED. Four short marks, in seat order of that
   player's own four pieces, and nothing else. Explicitly NOT a
   colour: the colour is the seat, the owner was explicit that it
   stays the one originally assigned, and a table where two people
   could both choose red is a table where nobody can read the board.

   PER PERSON, NOT PER TABLE. Your gotis are yours — you set them
   once and they are the pieces you play with at every table after,
   the way a family's carrom men are the same men every Sunday. That
   also means a mark cannot be used to say something at one table and
   deny it at another.

   READABLE BY ANYONE SIGNED IN, on purpose. These are four emoji
   drawn on a game piece: everyone at the table has to see them or
   they do not do their job, and a policy narrowed to "people at a
   table with you" would need a join per goti per frame. Nothing
   private is in this table; the private thing is the profile it
   points at, which has its own policies.
   ════════════════════════════════════════════════ */

create table if not exists public.game_piece_marks (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  /* Exactly four, short. The length cap is what stops this becoming a
     second display name — a goti has room for one glyph, and a
     sentence squeezed onto a token is unreadable rather than
     expressive. Emptiness is allowed: "" means the default mark. */
  marks jsonb not null default '["","","",""]'::jsonb,
  updated_at timestamptz not null default now(),
  /* Exactly four, and each of them short. POSTGRES WILL NOT TAKE
     THIS AS A CHECK CONSTRAINT: per-element validation needs
     jsonb_array_elements, a check may not contain a subquery, and
     the error is 0A000 rather than anything about JSON. So the
     shape that CAN be a check is one, and the rest is a trigger
     below. Both are enforced on every write, including a direct
     insert that bypasses set_piece_marks. */
  constraint game_piece_marks_four check (
    jsonb_typeof(marks) = 'array' and jsonb_array_length(marks) = 4
  )
);

/* The per-element rule the check could not hold. The length cap is
   what stops a goti becoming a second display name: a token has room
   for one glyph, and a sentence squeezed onto it is unreadable rather
   than expressive. Emptiness is allowed and means the default mark. */
create or replace function public.game_piece_marks_guard()
returns trigger
language plpgsql
as $function$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from jsonb_array_elements(new.marks) m
  where jsonb_typeof(m) <> 'string' or length(m #>> '{}') > 4;
  if v_bad > 0 then
    raise exception 'A goti wears one short mark, not a sentence';
  end if;
  return new;
end;
$function$;

drop trigger if exists game_piece_marks_guard on public.game_piece_marks;
create trigger game_piece_marks_guard
  before insert or update on public.game_piece_marks
  for each row execute function public.game_piece_marks_guard();
alter table public.game_piece_marks enable row level security;

drop policy if exists game_piece_marks_read on public.game_piece_marks;
create policy game_piece_marks_read
  on public.game_piece_marks for select
  to authenticated
  using (true);

drop policy if exists game_piece_marks_write on public.game_piece_marks;
create policy game_piece_marks_write
  on public.game_piece_marks for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists game_piece_marks_update on public.game_piece_marks;
create policy game_piece_marks_update
  on public.game_piece_marks for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists game_piece_marks_delete on public.game_piece_marks;
create policy game_piece_marks_delete
  on public.game_piece_marks for delete
  to authenticated
  using (profile_id = auth.uid());

comment on table public.game_piece_marks is
  'Four short marks a person wears on their own gotis, in piece order. Per person, not per table. Never a colour — the colour is the seat.';

/* One call, so the client never has to think about insert-or-update.
   A person setting their gotis for the first time and a person
   changing them are doing the same thing and should not be two code
   paths, one of which is only exercised once per account. */
create or replace function public.set_piece_marks(p_marks jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.game_piece_marks (profile_id, marks, updated_at)
  values (auth.uid(), p_marks, now())
  on conflict (profile_id)
  do update set marks = excluded.marks, updated_at = now();
end;
$function$;

revoke all on function public.set_piece_marks(jsonb) from public;
grant execute on function public.set_piece_marks(jsonb) to authenticated;
