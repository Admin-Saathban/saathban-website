/* ═══════════════════════════════════════════════════════════════
   0182 — An Icon is told before anyone checks in

   CLAUDE.md: "Consecutive low-mood days quietly flag staff for human
   outreach — disclosed plainly at onboarding." The owner, 2026-09-15:
   flagging people who were never told is not acceptable.

   The person is told ONCE (a screen in onboarding, or on their next
   Home / daily-log open if they onboarded before it existed) and taps
   "I understand". That moment is recorded here, and the flag rule
   (0183) only ever looks at people with this timestamp set, and only at
   mood entries from the day they were told onward.

     profiles.welfare_notice_seen_at   when the person was told.

   WHO CAN WRITE IT. Only the person, for themselves, once:
     - a signed-in caller may set it on their OWN row only (anyone else,
       a super-admin included, is refused);
     - whatever time they send, the database stores now();
     - once set it never changes and is never cleared by a signed-in
       caller (an attempt keeps the old value);
     - with no signed-in caller (service role, SQL console) it is left
       alone, so test data can be cleared.
   acknowledge_welfare_notice() is the path the app uses. It is not
   audited — it is the person's own act, not a staff action.

   No policy changes: the column rides the existing "own row" update
   policy, and the trigger below narrows it. safe_profiles (0122/0124)
   lists its columns explicitly, so this one is not exposed to anyone
   else through it.
   ═══════════════════════════════════════════════════════════════ */

alter table public.profiles add column if not exists welfare_notice_seen_at timestamptz;

create or replace function public.welfare_notice_written_once()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then
    return new;                                  -- service role / console
  end if;

  if tg_op = 'INSERT' then
    new.welfare_notice_seen_at := null;          -- told on a screen, never at signup
    return new;
  end if;

  if new.welfare_notice_seen_at is distinct from old.welfare_notice_seen_at then
    if new.id <> auth.uid() then
      raise exception 'Only the person themselves can record that they were told'
        using errcode = '42501';
    end if;
    if old.welfare_notice_seen_at is not null then
      new.welfare_notice_seen_at := old.welfare_notice_seen_at;   -- once, for good
    elsif new.welfare_notice_seen_at is not null then
      new.welfare_notice_seen_at := now();       -- the moment, not a sent value
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.welfare_notice_written_once() from public, anon, authenticated;

drop trigger if exists profiles_welfare_notice_once on public.profiles;
create trigger profiles_welfare_notice_once
  before insert or update on public.profiles
  for each row execute function public.welfare_notice_written_once();

create or replace function public.acknowledge_welfare_notice()
 returns timestamptz
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if public.app_role() is distinct from 'saath_icon' then
    raise exception 'Only a Saath-Icon keeps a mood log' using errcode = '42501';
  end if;

  update public.profiles
     set welfare_notice_seen_at = now()
   where id = v_uid and welfare_notice_seen_at is null;

  select welfare_notice_seen_at into v_at from public.profiles where id = v_uid;
  return v_at;
end;
$function$;

revoke all on function public.acknowledge_welfare_notice() from public, anon;
grant execute on function public.acknowledge_welfare_notice() to authenticated;
