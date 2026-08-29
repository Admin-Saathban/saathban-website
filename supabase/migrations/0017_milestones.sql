-- ============================================================================
-- 0017 — Milestones: points → badges → celebrations (SPEC.md, "Points,
-- character, celebrations")
--
-- Everything here rewards PARTICIPATION, never performance: badges mark
-- firsts and presence (showing up, resting honestly, coming back), never
-- amounts, speeds, or comparisons. No leaderboards, ever — no function in
-- this file can rank people, and earned badges are visible only to their
-- owner (and to admins, who need them to attach the personalised
-- congratulation SPEC promises).
--
-- Streak forgiveness is built into the shapes themselves:
--   - presence_7  = 7 present days inside any 8-day window (one day forgiven)
--   - presence_30 = 30 present days inside any 33-day window (three forgiven)
--   - presence_100 (the 100-day arc) = 100 LIFETIME present days — the arc
--     never resets, because a hard streak punishes exactly the weeks SPEC
--     says must never be punished
--   - a rest day IS presence: the new 'rest_day' log module below gives the
--     Icon home's rest-day toggle its schema home (QUESTIONS.md item 5)
--
-- Urdu badge names/descriptions drafted aap-register; pending native review
-- like the locales files.
-- ============================================================================

-- Rest days become a real, private daily_logs module. mood_value stays null
-- (the existing check constraint already allows that for non-mood modules).
alter type public.log_module add value if not exists 'rest_day';

-- ----------------------------------------------------------------------------
-- Badge definitions — content, readable by every signed-in role.
-- ----------------------------------------------------------------------------
create table public.badges (
  key          text primary key,
  sort         smallint not null,
  emoji        text not null,
  name_en      text not null,
  name_ur      text not null,
  desc_en      text not null,
  desc_ur      text not null,
  trigger_kind text not null unique check (trigger_kind in (
    'first_log', 'first_note', 'first_rest_day',
    'presence_7', 'presence_30', 'presence_100',
    'return_after_absence', 'first_post', 'first_outing'
  ))
);

alter table public.badges enable row level security;
revoke all on public.badges from anon;
create policy "signed-in read badge definitions"
  on public.badges for select
  using (auth.uid() is not null);
-- No client writes: definitions ship with migrations.

insert into public.badges (key, sort, emoji, name_en, name_ur, desc_en, desc_ur, trigger_kind) values
  ('pehla-qadam', 1, '🌱', 'First Step', 'پہلا قدم',
   'You showed up. Every journey on Saathban begins exactly here.',
   'آپ آئے، اور یہیں سے ہر سفر شروع ہوتا ہے۔', 'first_log'),
  ('aap-ki-awaaz', 2, '✍️', 'Your Voice', 'آپ کی آواز',
   'Your first note — a day remembered in your own words.',
   'پہلی بار آپ نے اپنے دن کی بات اپنے لفظوں میں محفوظ کی۔', 'first_note'),
  ('aaram-bhi-khayal', 3, '☾', 'Rest Is Care', 'آرام بھی خیال ہے',
   'You marked a rest day. Honesty like this counts just as much as a busy one.',
   'آپ نے آرام کا دن چنا۔ یہ سچائی بھی اتنی ہی قیمتی ہے۔', 'first_rest_day'),
  ('saat-din-saath', 4, '🌿', 'A Week Together', 'سات دن ساتھ',
   'Seven days of showing up, in your own way, at your own pace.',
   'سات دن، اپنے انداز اور اپنی رفتار سے، آپ ساتھ رہے۔', 'presence_7'),
  ('poora-chaand', 5, '🌕', 'A Full Moon', 'پورا چاند',
   'A whole month of presence — the moon has come all the way around with you.',
   'پورا مہینہ آپ کی موجودگی کا — چاند نے آپ کے ساتھ پورا چکر مکمل کیا۔', 'presence_30'),
  ('sowan-din', 6, '🌳', 'The Hundredth Day', 'سواں دن',
   'One hundred days of your company. Saathban is richer for every single one.',
   'آپ کے ساتھ کے سو دن۔ ہر ایک دن ہمارے لیے تحفہ ہے۔', 'presence_100'),
  ('waapsi', 7, '🏮', 'The Return', 'واپسی',
   'You came back. The door was open, and you walked through it — welcome.',
   'آپ لوٹ آئے۔ دروازہ کھلا تھا، اور آپ آئے — خوش آمدید۔', 'return_after_absence'),
  ('pehli-baat', 8, '💬', 'First Words', 'پہلی بات',
   'Your first words to the community — someone out there needed to read them.',
   'محفل میں آپ کی پہلی بات — کسی نہ کسی کو اسی کی ضرورت تھی۔', 'first_post'),
  ('taazi-hawa', 9, '🍃', 'Fresh Air', 'تازہ ہوا',
   'Your first outing with Saathban — the park is better with you in it.',
   'ساتھ بن کے ساتھ پہلی سیر — آپ کے آنے سے پارک اور بھی اچھا ہو گیا۔', 'first_outing');

-- ----------------------------------------------------------------------------
-- Earned badges. One row per (person, badge) — the unique pair is what makes
-- every award path idempotent. seen_at drives the show-once celebration;
-- message* carries the admin's personalised congratulation.
-- ----------------------------------------------------------------------------
create table public.earned_badges (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_key  text not null references public.badges (key),
  earned_at  timestamptz not null default now(),
  seen_at    timestamptz,   -- celebration shown once; null = not yet celebrated
  message    text,          -- personalised note from a human at Saathban
  message_by uuid references public.profiles (id) on delete set null,
  message_at timestamptz,
  unique (profile_id, badge_key)
);

create index earned_badges_profile_idx on public.earned_badges (profile_id, earned_at desc);
create index earned_badges_recent_idx on public.earned_badges (earned_at desc);

alter table public.earned_badges enable row level security;
revoke all on public.earned_badges from anon;

create policy "owner reads own earned badges"
  on public.earned_badges for select
  using (profile_id = auth.uid());

-- Admins browse awards to attach the personalised message (support scope).
create policy "admins read earned badges"
  on public.earned_badges for select
  using (public.is_admin());

-- The owner may mark a celebration seen — and touch NOTHING else: the
-- column grant below limits client updates to seen_at alone. Messages are
-- written only through attach_milestone_message().
create policy "owner marks celebration seen"
  on public.earned_badges for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

revoke insert, update, delete on public.earned_badges from authenticated;
grant select on public.earned_badges to authenticated;
grant update (seen_at) on public.earned_badges to authenticated;

-- ----------------------------------------------------------------------------
-- Awarding. compute_badge_awards() derives every eligibility from the
-- person's own rows and inserts what's missing — idempotent by the unique
-- pair. Called by the two event triggers below and by the award_my_badges()
-- RPC (which lets the client catch up on awards that predate the triggers).
-- ----------------------------------------------------------------------------
create or replace function public.compute_badge_awards(p_profile uuid)
returns setof text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_first_log  boolean;
  v_first_note boolean;
  v_first_rest boolean;
  v_presence_7 boolean;
  v_presence_30 boolean;
  v_presence_100 boolean;
  v_return boolean;
  v_first_post boolean;
  v_first_outing boolean := false;
begin
  select
    count(*) > 0,
    count(*) filter (where coalesce(payload->>'note', '') <> '') > 0,
    count(*) filter (where module = 'rest_day') > 0
  into v_first_log, v_first_note, v_first_rest
  from public.daily_logs where icon_id = p_profile;

  with days as (
    select distinct log_date from public.daily_logs where icon_id = p_profile
  )
  select
    exists (select 1 from days d
            where (select count(*) from days d2
                   where d2.log_date between d.log_date - 7 and d.log_date) >= 7),
    exists (select 1 from days d
            where (select count(*) from days d2
                   where d2.log_date between d.log_date - 32 and d.log_date) >= 30),
    (select count(*) from days) >= 100,
    exists (select 1 from (
              select log_date, lag(log_date) over (order by log_date) as prev
              from days) g
            where g.prev is not null and g.log_date - g.prev >= 8)
  into v_presence_7, v_presence_30, v_presence_100, v_return;

  select exists (select 1 from public.community_posts where author_id = p_profile)
  into v_first_post;

  -- Outdoor hasn't landed (0016 reserved); award lazily once its table exists.
  if to_regclass('public.outdoor_checkins') is not null then
    execute 'select exists (select 1 from public.outdoor_checkins where profile_id = $1)'
      into v_first_outing using p_profile;
  end if;

  return query
  insert into public.earned_badges (profile_id, badge_key)
  select p_profile, b.key
  from public.badges b
  where case b.trigger_kind
    when 'first_log'            then v_first_log
    when 'first_note'           then v_first_note
    when 'first_rest_day'       then v_first_rest
    when 'presence_7'           then v_presence_7
    when 'presence_30'          then v_presence_30
    when 'presence_100'         then v_presence_100
    when 'return_after_absence' then v_return
    when 'first_post'           then v_first_post
    when 'first_outing'         then v_first_outing
    else false
  end
  on conflict (profile_id, badge_key) do nothing
  returning badge_key;
end;
$$;

revoke execute on function public.compute_badge_awards(uuid) from public, anon, authenticated;

-- Event triggers: a new log or post awards immediately, server-side.
create or replace function public.on_log_award_badges()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.compute_badge_awards(new.icon_id);
  return new;
end;
$$;

create trigger daily_logs_award_badges
  after insert on public.daily_logs
  for each row execute function public.on_log_award_badges();

create or replace function public.on_post_award_badges()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.compute_badge_awards(new.author_id);
  return new;
end;
$$;

create trigger community_posts_award_badges
  after insert on public.community_posts
  for each row execute function public.on_post_award_badges();

-- Client-callable catch-up: awards anything the caller is owed (e.g. rows
-- that predate these triggers) and returns the newly earned keys.
create or replace function public.award_my_badges()
returns setof text
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.account_ok() then
    return;
  end if;
  return query select public.compute_badge_awards(auth.uid());
end;
$$;

revoke execute on function public.award_my_badges() from public, anon;
grant execute on function public.award_my_badges() to authenticated;

-- ----------------------------------------------------------------------------
-- Progress for the caller: points (participation-flat: 10 per log row,
-- rest days included — resting counts), lifetime presence days (the
-- 100-day arc), and the current streak with single-day forgiveness (one
-- quiet day between present days never breaks it).
-- ----------------------------------------------------------------------------
create or replace function public.my_progress()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_points int;
  v_days   int;
  v_streak int := 0;
  v_dates  date[];
  v_prev   date;
  v_d      date;
begin
  if auth.uid() is null then
    return jsonb_build_object('points', 0, 'presence_days', 0, 'current_streak', 0);
  end if;

  select count(*) * 10 into v_points
  from public.daily_logs where icon_id = auth.uid();

  select count(distinct log_date),
         array_agg(distinct log_date order by log_date desc)
  into v_days, v_dates
  from public.daily_logs where icon_id = auth.uid();

  if v_days > 0 and current_date - v_dates[1] <= 2 then
    v_streak := 1;
    v_prev := v_dates[1];
    foreach v_d in array v_dates[2:] loop
      exit when v_prev - v_d > 2;  -- a two-day hole ends the walk
      v_streak := v_streak + 1;
      v_prev := v_d;
    end loop;
  end if;

  return jsonb_build_object(
    'points', coalesce(v_points, 0),
    'presence_days', coalesce(v_days, 0),
    'current_streak', v_streak
  );
end;
$$;

revoke execute on function public.my_progress() from public, anon;
grant execute on function public.my_progress() to authenticated;

-- ----------------------------------------------------------------------------
-- The personalised milestone message (SPEC: "Admins can attach a
-- personalized message to any milestone, so a human at Saathban
-- congratulates the Icon by name"). Writes the message onto the award and
-- delivers it as a 'milestone' notification; audit-logged.
-- ----------------------------------------------------------------------------
create or replace function public.attach_milestone_message(
  p_earned uuid,
  p_message text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_row   public.earned_badges%rowtype;
  v_badge public.badges%rowtype;
  v_note  uuid;
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  if coalesce(length(trim(p_message)), 0) < 5 then
    raise exception 'A message is required';
  end if;

  select * into v_row from public.earned_badges where id = p_earned for update;
  if not found then
    raise exception 'No such award';
  end if;

  select * into v_badge from public.badges where key = v_row.badge_key;

  update public.earned_badges
  set message = trim(p_message), message_by = auth.uid(), message_at = now()
  where id = p_earned;

  insert into public.notifications (profile_id, title, body, kind, created_by)
  values (
    v_row.profile_id,
    v_badge.emoji || ' ' || v_badge.name_en,
    trim(p_message),
    'milestone',
    auth.uid()
  )
  returning id into v_note;

  perform public.write_audit(
    'milestone_message',
    v_row.profile_id,
    'personalised milestone congratulation',
    jsonb_build_object('earned_badge_id', p_earned, 'badge', v_row.badge_key)
  );

  return v_note;
end;
$$;

revoke execute on function public.attach_milestone_message(uuid, text) from public, anon;
grant execute on function public.attach_milestone_message(uuid, text) to authenticated;
