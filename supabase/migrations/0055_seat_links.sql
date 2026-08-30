/* ═══════════════════════════════════════════════════════════════
   0055 — "send a link" as a seat option (PRODUCT_DECISIONS §17)

   Seat options become person · bot · open to community · SEND A LINK.

   "Send a link holds that seat and produces a link for WhatsApp. The
   first person to open it takes the seat; with no account they sign up
   and land straight in it, already connected to the host.
   **Single-use and time-limited**, so a forwarded link cannot let
   three strangers into a family game."

   ── Why this is not the join code ──

   The table already has a six-digit join code, and it is deliberately
   the opposite of this: reusable, spoken aloud, shared with a room.
   That is right for "anyone from the community" and wrong for a link
   sent to one person on WhatsApp, because WhatsApp links get
   forwarded. A code that seats whoever types it cannot hold a chair
   for your daughter.

   So this is a distinct object with two properties the code does not
   have and must not gain: it is consumed by its first use, and it
   dies on its own.

   ── The seat is HELD, not merely reserved in the UI ──

   `game_seats` gains no row until someone claims. What holds the chair
   is this row: a link exists for (session, seat), so the setup screen
   and the table both show that seat as waiting on a link. The seat is
   therefore held by a fact, not by a client remembering to.

   ── Single-use, enforced where it cannot be argued with ──

   `used_at` is set inside the same statement that seats the claimer,
   under a row lock. Two people opening a forwarded link at the same
   moment are serialised by the database: one is seated, the other is
   told the seat is taken. A check in the client would let both in.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.game_seat_links (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.game_sessions (id) on delete cascade,
  seat_no     smallint not null check (seat_no between 1 and 4),
  token       text not null unique,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  /* 48 hours, the same window the circle invites use. Long enough for
     "I'll play tonight", short enough that a link found in a forwarded
     chat next month is already dead. */
  expires_at  timestamptz not null default now() + interval '48 hours',
  used_at     timestamptz,
  used_by     uuid references public.profiles (id) on delete set null
);

/* One live link per seat: a second "send a link" on the same chair
   must replace the first, never quietly create a second way in. */
create unique index if not exists game_seat_links_one_live
  on public.game_seat_links (session_id, seat_no)
  where used_at is null;

create index if not exists game_seat_links_token_idx on public.game_seat_links (token);

alter table public.game_seat_links enable row level security;

/* Participants of the table may SEE its links — that is how the setup
   screen knows a seat is being held, and how anyone at the table can
   re-share the link (a guest inviting the fourth player is the point,
   exactly as the join code already works). Nobody may write directly:
   creation and claiming both go through the functions below, because
   the single-use rule lives there. */
drop policy if exists "table can see its seat links" on public.game_seat_links;
create policy "table can see its seat links"
  on public.game_seat_links for select
  using (
    exists (
      select 1 from public.game_seats s
      where s.session_id = game_seat_links.session_id
        and s.profile_id = auth.uid()
    )
  );

/* ── Create ──
   Anyone already at the table may hold a chair with a link. Replaces
   any unused link for that seat, so the old one dies the moment a new
   one is made — a person who re-shares should not leave a second key
   in circulation. */
/* p_seat is INTEGER, not smallint, and that is not cosmetic:
   PostgREST resolves RPC arguments from JSON and does not reliably
   match a JSON number to a smallint parameter. The symptom is a bare
   404 that reads exactly like "this function does not exist", which
   sent me looking at the schema cache for a while. */
create or replace function public.create_seat_link(p_session uuid, p_seat integer)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_token text;
begin
  if not exists (
    select 1 from public.game_seats
    where session_id = p_session and profile_id = auth.uid()
  ) then
    raise exception 'Not your table';
  end if;
  if exists (
    select 1 from public.game_seats
    where session_id = p_session and seat_no = p_seat
  ) then
    raise exception 'That seat is taken';
  end if;

  delete from public.game_seat_links
  where session_id = p_session and seat_no = p_seat and used_at is null;

  /* gen_random_bytes lives in pgcrypto, which is NOT on this
     function's search_path — it raised "function does not exist",
     surfacing as another 404. Two uuids give 256 bits and depend on
     no extension. */
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.game_seat_links (session_id, seat_no, token, created_by)
  values (p_session, p_seat::smallint, v_token, auth.uid());
  return v_token;
end;
$function$;

/* ── Claim ──
   The first caller wins and the link is spent. Returns the session id
   so the client can land the person AT THE TABLE (§11 — the action
   ends where its result lives), never on a confirmation screen. */
create or replace function public.claim_seat_link(p_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  link public.game_seat_links%rowtype;
  v_host uuid;
begin
  select * into link from public.game_seat_links
  where token = p_token
  for update;                          -- serialises two simultaneous opens

  if link.id is null then raise exception 'This link is not valid'; end if;

  /* ORDER MATTERS, and the first version had it wrong. The person who
     ALREADY holds a seat here must be sent to it before any other
     test runs — otherwise the very person who claimed the link is
     told "someone has already taken this seat" when they re-open
     their own WhatsApp message. Their own success is what spent it. */
  if exists (select 1 from public.game_seats where session_id = link.session_id and profile_id = auth.uid()) then
    return link.session_id;            -- already seated: idempotent, not an error
  end if;

  if link.used_at is not null then raise exception 'Someone has already taken this seat'; end if;
  if link.expires_at < now() then raise exception 'This link has expired'; end if;
  if exists (select 1 from public.game_seats where session_id = link.session_id and seat_no = link.seat_no) then
    raise exception 'Someone has already taken this seat';
  end if;

  insert into public.game_seats (session_id, seat_no, profile_id)
  values (link.session_id, link.seat_no, auth.uid());

  update public.game_seat_links
  set used_at = now(), used_by = auth.uid()
  where id = link.id;

  /* "already connected to the host" (§17). A game you were invited
     into by name should not leave you strangers afterwards. Recorded
     as an accepted friendship both ways round, and only if there is
     nothing between them already — this must never overwrite a
     declined or blocked state. */
  v_host := link.created_by;
  if v_host is not null and v_host <> auth.uid()
     and not exists (
       select 1 from public.friend_requests
       where (requester_id = v_host and recipient_id = auth.uid())
          or (requester_id = auth.uid() and recipient_id = v_host)
     )
     and not exists (
       select 1 from public.user_blocks
       where kind = 'block'
         and ((blocker_id = v_host and blocked_id = auth.uid())
           or (blocker_id = auth.uid() and blocked_id = v_host))
     )
  then
    insert into public.friend_requests (requester_id, recipient_id, status, decided_at)
    values (v_host, auth.uid(), 'accepted', now());
  end if;

  return link.session_id;
end;
$function$;

revoke all on table public.game_seat_links from anon;
revoke execute on function public.create_seat_link(uuid, integer) from public, anon;
revoke execute on function public.claim_seat_link(text) from public, anon;
grant execute on function public.create_seat_link(uuid, integer) to authenticated;
grant execute on function public.claim_seat_link(text) to authenticated;
