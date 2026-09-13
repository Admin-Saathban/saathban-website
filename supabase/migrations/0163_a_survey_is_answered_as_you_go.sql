/* ═══════════════════════════════════════════════════════════════
   0163 — a survey is answered as you go, and offered until you say no

   The owner's rules, and where each one is held:

   SAVE AS YOU GO. survey_save_answer() writes each answer the moment it
   is given, into the person's one response row for that survey
   (UNIQUE(survey_id, profile_id), 0162). Whatever they answered is kept
   if they walk away.

   A SUBMITTED RESPONSE IS FINAL. survey_submit() sets submitted_at;
   0118's trigger then refuses any change to the answers, and every
   function here refuses to write to an answered survey out loud.

   "YOU CAN STOP AT ANY POINT" (§16). survey_withdraw() deletes the
   person's response — the answers go, not a flag — and records that
   they stopped, so the survey is not put in front of them again.

   OFFERED (grow_survey_offered — the bar at the top of Grow, and
   Pending): the survey is open to them (below), they have not answered
   it, and
     · DISMISSED → not offered again, unless an admin re-offered it
       after the dismissal;
     · ABANDONED PART-WAY (a response row, not submitted) → not offered
       again, unless an admin re-offered it after their last answer.

   OPEN (grow_survey_state → answered | open | closed | hidden):
     answered  they submitted — always, whatever the status now
     hidden    a draft, or they are not in the audience (research: Icons)
     open      status 'published'; or status 'closing' and they already
               have part-way answers (they may finish; nobody new starts)
     closed    anything else ('closed'; or 'closing' with nothing begun)

   Opening a survey by its link works whenever it is 'open', so a person
   who was interrupted can still finish; "not shown again" is about the
   survey being put in front of them, never about locking them out.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.grow_survey_ref(p_ref text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select id from public.surveys
  where (p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and id = p_ref::uuid)
     or slug = p_ref
  limit 1;
$function$;

create or replace function public.grow_survey_state(p_profile uuid, p_survey uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  s public.surveys%rowtype;
  r public.survey_responses%rowtype;
begin
  select * into s from public.surveys where id = p_survey;
  if s.id is null then return 'hidden'; end if;
  select * into r from public.survey_responses where survey_id = p_survey and profile_id = p_profile;
  if r.submitted_at is not null then return 'answered'; end if;
  if s.status = 'draft' or not public.grow_audience_ok(s.audience, p_profile) then return 'hidden'; end if;
  if s.status = 'published' then return 'open'; end if;
  if s.status = 'closing' and r.id is not null then return 'open'; end if;
  return 'closed';
end;
$function$;

create or replace function public.grow_survey_offered(p_profile uuid, p_survey uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r public.survey_responses%rowtype;
  d public.survey_dismissals%rowtype;
begin
  if public.grow_survey_state(p_profile, p_survey) <> 'open' then return false; end if;
  select * into r from public.survey_responses where survey_id = p_survey and profile_id = p_profile;
  select * into d from public.survey_dismissals where survey_id = p_survey and profile_id = p_profile;
  if d.last_dismissed_at is not null
     and (d.reoffered_at is null or d.reoffered_at <= d.last_dismissed_at) then
    return false;
  end if;
  if r.id is not null and (d.reoffered_at is null or d.reoffered_at <= r.updated_at) then
    return false;
  end if;
  return true;
end;
$function$;

create or replace function public.survey_for_me(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
  v_id uuid;
  v_state text;
  s public.surveys%rowtype;
  r public.survey_responses%rowtype;
begin
  if me is null or not public.account_ok() then return null; end if;
  v_id := public.grow_survey_ref(p_ref);
  if v_id is null then return null; end if;
  v_state := public.grow_survey_state(me, v_id);
  if v_state = 'hidden' then return null; end if;
  select * into s from public.surveys where id = v_id;
  select * into r from public.survey_responses where survey_id = v_id and profile_id = me;
  return jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'status', s.status, 'state', v_state,
    'title_en', s.title_en, 'title_ur', s.title_ur, 'desc_en', s.desc_en, 'desc_ur', s.desc_ur,
    'consent_en', s.consent_en, 'consent_ur', s.consent_ur,
    'questions', case when v_state = 'open' then s.questions else '[]'::jsonb end,
    'answers', case when v_state = 'open' then coalesce(r.answers, '{}'::jsonb) else '{}'::jsonb end,
    'started', r.id is not null
  );
end;
$function$;

create or replace function public.survey_save_answer(p_survey uuid, p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
  v_state text;
  s public.surveys%rowtype;
  q jsonb;
  v_keys text[];
  v_val jsonb := p_value;
begin
  if me is null or not public.account_ok() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_state := public.grow_survey_state(me, p_survey);
  if v_state = 'answered' then
    raise exception 'survey already answered' using errcode = 'P0001';
  end if;
  if v_state <> 'open' then
    raise exception 'survey not open' using errcode = 'P0001';
  end if;
  select * into s from public.surveys where id = p_survey;
  select value into q from jsonb_array_elements(s.questions) where value->>'key' = p_key;
  if q is null then
    raise exception 'no such question' using errcode = 'P0001';
  end if;
  v_keys := array(select o->>'key' from jsonb_array_elements(coalesce(q->'options', '[]')) o);

  if v_val is null or jsonb_typeof(v_val) = 'null' then
    v_val := null;
  elsif q->>'type' = 'single' then
    if jsonb_typeof(v_val) <> 'string' or not ((v_val #>> '{}') = any (v_keys)) then
      raise exception 'answer does not fit the question' using errcode = 'P0001';
    end if;
  elsif q->>'type' = 'multi' then
    if jsonb_typeof(v_val) <> 'array'
       or exists (select 1 from jsonb_array_elements(v_val) e
                  where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any (v_keys))) then
      raise exception 'answer does not fit the question' using errcode = 'P0001';
    end if;
    v_val := (select jsonb_agg(k order by min_ord)
              from (select e #>> '{}' as k, min(ord) as min_ord
                    from jsonb_array_elements(v_val) with ordinality x(e, ord) group by 1) y);
    if v_val is null then v_val := null; end if;
  else
    if jsonb_typeof(v_val) <> 'string' then
      raise exception 'answer does not fit the question' using errcode = 'P0001';
    end if;
    if length(v_val #>> '{}') > 4000 then
      raise exception 'answer is too long' using errcode = 'P0001';
    end if;
    if btrim(v_val #>> '{}') = '' then v_val := null; end if;
  end if;

  if v_val is null then
    update public.survey_responses
    set answers = answers - p_key, updated_at = clock_timestamp()
    where survey_id = p_survey and profile_id = me;
  else
    insert into public.survey_responses (survey_id, profile_id, answers, consented_at, updated_at)
    values (p_survey, me, jsonb_build_object(p_key, v_val), clock_timestamp(), clock_timestamp())
    on conflict (survey_id, profile_id) do update
      set answers = public.survey_responses.answers || jsonb_build_object(p_key, v_val),
          updated_at = clock_timestamp();
  end if;
end;
$function$;

create or replace function public.survey_submit(p_survey uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
  v_state text;
begin
  if me is null or not public.account_ok() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_state := public.grow_survey_state(me, p_survey);
  if v_state = 'answered' then
    raise exception 'survey already answered' using errcode = 'P0001';
  end if;
  if v_state <> 'open' then
    raise exception 'survey not open' using errcode = 'P0001';
  end if;
  insert into public.survey_responses (survey_id, profile_id, answers, consented_at, submitted_at, updated_at)
  values (p_survey, me, '{}', clock_timestamp(), clock_timestamp(), clock_timestamp())
  on conflict (survey_id, profile_id) do update
    set submitted_at = clock_timestamp(), updated_at = clock_timestamp();
end;
$function$;

/* Stopping deletes. Allowed on a submitted response too — withdrawing
   research you gave is the §16 promise, not a loophole (0118). */
create or replace function public.survey_withdraw(p_survey uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
  v_had boolean;
begin
  if me is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_had := exists (select 1 from public.survey_responses where survey_id = p_survey and profile_id = me);
  if not v_had and public.grow_survey_state(me, p_survey) = 'hidden' then
    raise exception 'survey not open' using errcode = 'P0001';
  end if;
  delete from public.survey_responses where survey_id = p_survey and profile_id = me;
  insert into public.survey_dismissals (survey_id, profile_id, dismiss_count, last_dismissed_at, last_kind)
  values (p_survey, me, 1, clock_timestamp(), 'withdrew')
  on conflict (survey_id, profile_id) do update
    set dismiss_count = public.survey_dismissals.dismiss_count + 1,
        last_dismissed_at = clock_timestamp(),
        last_kind = 'withdrew';
end;
$function$;

create or replace function public.survey_dismiss(p_survey uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.account_ok() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if public.grow_survey_state(me, p_survey) <> 'open' then
    raise exception 'survey not open' using errcode = 'P0001';
  end if;
  insert into public.survey_dismissals (survey_id, profile_id, dismiss_count, last_dismissed_at, last_kind)
  values (p_survey, me, 1, clock_timestamp(), 'dismissed')
  on conflict (survey_id, profile_id) do update
    set dismiss_count = public.survey_dismissals.dismiss_count + 1,
        last_dismissed_at = clock_timestamp(),
        last_kind = 'dismissed';
end;
$function$;

revoke all on function public.grow_survey_ref(text) from public, anon, authenticated;
revoke all on function public.grow_survey_state(uuid, uuid) from public, anon, authenticated;
revoke all on function public.grow_survey_offered(uuid, uuid) from public, anon, authenticated;

revoke all on function public.survey_for_me(text) from public, anon;
revoke all on function public.survey_save_answer(uuid, text, jsonb) from public, anon;
revoke all on function public.survey_submit(uuid) from public, anon;
revoke all on function public.survey_withdraw(uuid) from public, anon;
revoke all on function public.survey_dismiss(uuid) from public, anon;
grant execute on function public.survey_for_me(text) to authenticated;
grant execute on function public.survey_save_answer(uuid, text, jsonb) to authenticated;
grant execute on function public.survey_submit(uuid) to authenticated;
grant execute on function public.survey_withdraw(uuid) to authenticated;
grant execute on function public.survey_dismiss(uuid) to authenticated;
