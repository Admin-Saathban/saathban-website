/* Real links behind "Copy a link".

   The share sheet copied a hardcoded string —
   https://saathban.app/s/AB12-CD34 — and told the person it showed
   their score and stopped working after 7 days. It was the same URL
   for everybody, it showed nothing, and it never expired because it
   never existed.

   SPEC.md: community sharing is score-level summary only, never
   medication or notes, and shared links expire in 7 days. Both of
   those are enforced here rather than in the client: what the link
   can reveal is decided by what read_share_link returns.

   Shape follows public_game_result / claim_seat_link — one SECURITY
   DEFINER function per direction, an unguessable key, and nothing
   enumerable. The table is never selected by token by a client. */

create table if not exists public.share_links (
  token       text primary key,
  icon_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('score')),
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);

create index if not exists share_links_owner_idx
  on public.share_links (icon_id, kind, created_at desc);

alter table public.share_links enable row level security;

/* The owner may list their own links, to see and revoke them. Nobody
   reads by token through the table — that is the function's job, and
   it is the only path that works without being the owner. */
drop policy if exists "share links: owner reads" on public.share_links;
create policy "share links: owner reads" on public.share_links
  for select using (icon_id = auth.uid());

drop policy if exists "share links: owner revokes" on public.share_links;
create policy "share links: owner revokes" on public.share_links
  for update using (icon_id = auth.uid()) with check (icon_id = auth.uid());

/* ── Mint, or hand back the one that is already live ──

   Pressing the button thirty times must not mint thirty links: each
   one would be a separate live window into the person's day, and
   revoking would become thirty jobs. A live link for the same kind is
   refreshed and returned, so the answer to "share this" is stable. */
create or replace function public.create_score_share_link(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me    uuid := auth.uid();
  v_token text;
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;

  select token into v_token
    from public.share_links
   where icon_id = v_me
     and kind = 'score'
     and revoked_at is null
     and expires_at > now()
   order by created_at desc
   limit 1;

  if v_token is not null then
    update public.share_links
       set payload = coalesce(p_payload, '{}'::jsonb)
     where token = v_token;
    return v_token;
  end if;

  /* pgcrypto is not on this project, so no gen_random_bytes — the
     same two-uuid trick 0060 uses for seat links. */
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.share_links (token, icon_id, kind, payload, expires_at)
  values (v_token, v_me, 'score', coalesce(p_payload, '{}'::jsonb), now() + interval '7 days');

  return v_token;
end;
$function$;

/* ── Read it, from anywhere, signed in or not ──

   Returns null for a token that is missing, expired or revoked — the
   three are deliberately indistinguishable, so the endpoint cannot be
   used to learn that a token was ever real.

   What it returns is the whole privacy boundary: a first name and the
   score summary. No profile id, no photo, no notes, no mood, no
   medication — the payload columns are named explicitly rather than
   returned wholesale, so a later addition to the payload cannot leak
   by default. */
create or replace function public.read_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row   public.share_links%rowtype;
  v_name  text;
begin
  select * into v_row
    from public.share_links
   where token = p_token
     and revoked_at is null
     and expires_at > now();

  if not found then
    return null;
  end if;

  select split_part(btrim(coalesce(full_name, '')), ' ', 1)
    into v_name
    from public.profiles
   where id = v_row.icon_id;

  return jsonb_build_object(
    'name', nullif(v_name, ''),
    'points', coalesce((v_row.payload ->> 'points')::int, 0),
    'logs', coalesce((v_row.payload ->> 'logs')::int, 0),
    'day', v_row.payload ->> 'day',
    'expires_at', v_row.expires_at
  );
end;
$function$;

revoke execute on function public.create_score_share_link(jsonb) from public, anon;
grant  execute on function public.create_score_share_link(jsonb) to authenticated;

/* Anon on purpose: the point of the link is that it opens with no
   account, exactly like public_game_result. */
revoke execute on function public.read_share_link(text) from public;
grant  execute on function public.read_share_link(text) to anon, authenticated;
