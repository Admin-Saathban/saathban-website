/* ═══════════════════════════════════════════════════════════════
   0171 — a streak can be renamed, changed, or deleted by its owner

   RENAME. rename_streak(streak, name): the owner's own words, 1–80
   characters. Nothing about the run changes.

   CHANGE KIND OR RANGE — COUNTED FROM TODAY. Before this, streak_day_ok
   judged every past day by the streak's CURRENT rule, so widening a
   range could invent a run that never happened and narrowing it could
   erase one that did. Now update_streak keeps the rule it replaces in
   streak_rule_history with until_day = the owner's today: every day
   BEFORE that is still counted by the rule it was lived under; today
   and every day after are counted by the new rule. Several changes in
   one day keep the first old rule (the one the past was lived under).
   Anything already sent today stays sent. update_streak now also checks
   the account, the kind, that the item has a number to range over, and
   that the range is sensible.

   DELETE. delete_streak(streak): owner only, live or archived. A hard
   delete: the streak, its people, EVERY send it made, its rest days,
   its nudges and its rule history go (by the existing ON DELETE CASCADE
   foreign keys), and so do the recipients' notifications that pointed at
   those sends or nudges — the people it was sent to no longer see it.
   Replies other people sent back are THEIR sends and stay (their
   in_reply_to is set null). What the owner logged is untouched, and so
   are their days with Saathban. A leave recorded against this owner and
   item (0170) survives the delete, so making the streak again cannot
   add a person who left. Returns what it removed.

   All SECURITY DEFINER, caller-checked; no client write policy exists on
   any streak table.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.streak_rule_history (
  streak_id  uuid not null references public.streaks(id) on delete cascade,
  until_day  date not null,
  kind       text not null check (kind in ('range','yes_no')),
  range_min  numeric,
  range_max  numeric,
  unit       text,
  changed_at timestamptz not null default now(),
  primary key (streak_id, until_day)
);
alter table public.streak_rule_history enable row level security;
revoke all on public.streak_rule_history from anon, authenticated;

-- A day is judged by the rule it was lived under.
create or replace function public.streak_day_ok(p_streak uuid, p_day date)
returns boolean
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  h public.streak_rule_history%rowtype;
  v numeric;
  v_kind text;
  v_min numeric;
  v_max numeric;
begin
  select * into s from public.streaks where id = p_streak;
  if not found then return false; end if;
  if exists (select 1 from public.streak_rest_days r where r.streak_id = p_streak and r.day = p_day) then
    return true;
  end if;
  v := public.streak_item_value(s.owner_id, s.item_key, p_day);
  if v is null then return false; end if;
  v_kind := s.kind; v_min := s.range_min; v_max := s.range_max;
  select * into h from public.streak_rule_history
  where streak_id = p_streak and until_day > p_day
  order by until_day limit 1;
  if found then
    v_kind := h.kind; v_min := h.range_min; v_max := h.range_max;
  end if;
  if v_kind = 'range' then
    return v >= v_min and v <= v_max;
  end if;
  return true;
end;
$$;
revoke all on function public.streak_day_ok(uuid, date) from public, anon, authenticated;

create or replace function public.update_streak(
  p_streak uuid, p_kind text, p_min numeric default null, p_max numeric default null, p_unit text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
begin
  if auth.uid() is null or not public.account_ok() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into s from public.streaks where id = p_streak and owner_id = auth.uid() and archived_at is null for update;
  if not found then raise exception 'No such streak'; end if;
  if p_kind is null or p_kind not in ('range','yes_no') then
    raise exception 'Unknown kind';
  end if;
  if p_kind = 'range' then
    if s.item_key not in ('water','sleep','exercise') and s.item_key not like 'tracker:%' then
      raise exception 'This item has no number to set a range on';
    end if;
    if p_min is null or p_max is null or p_min < 0 or p_min > p_max then
      raise exception 'range_invalid';
    end if;
  end if;

  -- Nothing actually changed: nothing to record.
  if s.kind = p_kind
     and (p_kind = 'yes_no' or (s.range_min = p_min and s.range_max = p_max and s.unit is not distinct from p_unit)) then
    return;
  end if;

  insert into public.streak_rule_history (streak_id, until_day, kind, range_min, range_max, unit)
  values (s.id, public.local_today(s.owner_id), s.kind, s.range_min, s.range_max, s.unit)
  on conflict (streak_id, until_day) do nothing;

  update public.streaks
  set kind = p_kind,
      range_min = case when p_kind = 'range' then p_min end,
      range_max = case when p_kind = 'range' then p_max end,
      unit = case when p_kind = 'range' then p_unit end
  where id = s.id;
end;
$$;

create or replace function public.rename_streak(p_streak uuid, p_name text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null or not public.account_ok() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'name_length';
  end if;
  update public.streaks set item_name = v_name
  where id = p_streak and owner_id = auth.uid() and archived_at is null;
  if not found then raise exception 'No such streak'; end if;
  return v_name;
end;
$$;

create or replace function public.delete_streak(p_streak uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.streaks%rowtype;
  v_sends integer;
  v_people integer;
  v_notes integer;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into s from public.streaks where id = p_streak and owner_id = auth.uid() for update;
  if not found then raise exception 'No such streak'; end if;

  select count(*) into v_sends from public.streak_sends where streak_id = s.id;
  select count(*) into v_people from public.streak_people where streak_id = s.id;

  delete from public.notifications n
  where n.kind = 'streak'
    and (n.link in (select '/app/streak/' || x.id from public.streak_sends x where x.streak_id = s.id)
         or (n.link = '/app/home/log'
             and exists (select 1 from public.streak_nudges g
                         where g.streak_id = s.id and g.to_id = n.profile_id and g.created_at = n.created_at)));
  get diagnostics v_notes = row_count;

  -- Cascades: streak_people, streak_sends, streak_rest_days, streak_nudges, streak_rule_history.
  delete from public.streaks where id = s.id;

  return jsonb_build_object('deleted', true, 'sends', v_sends, 'people', v_people, 'notifications', v_notes);
end;
$$;

revoke all on function public.update_streak(uuid, text, numeric, numeric, text) from public, anon;
revoke all on function public.rename_streak(uuid, text) from public, anon;
revoke all on function public.delete_streak(uuid) from public, anon;
grant execute on function public.update_streak(uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.rename_streak(uuid, text) to authenticated;
grant execute on function public.delete_streak(uuid) to authenticated;
