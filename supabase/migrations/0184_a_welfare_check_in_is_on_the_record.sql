/* ═══════════════════════════════════════════════════════════════
   0184 — A welfare check-in is on the record

   The two doors to welfare_runs (0183). Support admins and super-admins
   only (is_admin(): a moderator, a paused or blocked admin, any other
   role and anon are refused). Both write the audit log themselves.

     admin_welfare_list()
        Everyone currently flagged, oldest flag first:
          name, how many low days in the run, since when, the most
          recent low day, the day the flag was raised, when they were
          told about check-ins, and the last check-in attempt (when,
          outcome, who, the staff note).
        How to reach them, only through routes staff can already see:
          email for support and super (admin_list_people, 0150, already
          shows it); phone for super only (profiles.phone has been
          "self + super-admin only" since 0002).
        NEVER a mood value, a mood note, or any log payload.
        Audited: welfare_list_opened {rows, profile_ids}.

     admin_welfare_record(p_icon, p_outcome, p_note)
        outcome: spoke | no_answer | not_needed. note: optional staff
        text, at most 500 characters. Refused for someone who is not
        on the list right now, so it cannot become a way to write notes
        about anybody. Stores the count and dates the list showed.
        Audited: welfare_outreach_recorded {outcome, low_days, since,
        outreach_id}, with the person as the target. The note is NOT
        copied into the audit log — it stays in welfare_outreach.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.admin_welfare_list()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_super boolean := public.is_super_admin();
  v_rows jsonb;
  v_ids jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with flagged as (
    select w.*,
           p.full_name,
           u.email::text as email,
           case when v_super then nullif(btrim(p.phone), '') end as phone
      from public.welfare_runs(now()) w
      join public.profiles p on p.id = w.icon_id
      left join auth.users u on u.id = w.icon_id
  ),
  last_try as (
    select distinct on (o.icon_id) o.icon_id, o.handled_at, o.outcome, o.note, hp.full_name as by_name
      from public.welfare_outreach o
      left join public.profiles hp on hp.id = o.handled_by
     where o.icon_id in (select icon_id from flagged)
     order by o.icon_id, o.handled_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'icon_id', f.icon_id,
           'name', f.full_name,
           'low_days', f.low_days,
           'since', f.since,
           'last_low', f.last_low,
           'raised_on', f.raised_on,
           'told_at', f.told_at,
           'email', f.email,
           'phone', f.phone,
           'last_outreach', case when lt.icon_id is null then null else jsonb_build_object(
               'at', lt.handled_at, 'outcome', lt.outcome, 'by_name', lt.by_name, 'note', lt.note) end
         ) order by f.raised_on, f.since, f.full_name), '[]'::jsonb),
         coalesce(jsonb_agg(f.icon_id), '[]'::jsonb)
    into v_rows, v_ids
    from flagged f
    left join last_try lt on lt.icon_id = f.icon_id;

  perform public.write_audit('welfare_list_opened', null, null,
    jsonb_build_object('rows', jsonb_array_length(v_rows), 'profile_ids', v_ids));

  return jsonb_build_object('rows', v_rows, 'phone_visible', v_super);
end;
$function$;

create or replace function public.admin_welfare_record(p_icon uuid, p_outcome text, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_low int;
  v_since date;
  v_id uuid;
  v_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_outcome is null or p_outcome not in ('spoke', 'no_answer', 'not_needed') then
    raise exception 'Choose what happened: spoke, no_answer or not_needed';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'The note can be at most 500 characters';
  end if;

  select w.low_days, w.since into v_low, v_since
    from public.welfare_runs(now()) w
   where w.icon_id = p_icon;
  if not found then
    raise exception 'This person is not on the welfare list right now'
      using hint = 'welfare_not_listed';
  end if;

  insert into public.welfare_outreach (icon_id, handled_by, outcome, note, low_days, run_since)
  values (p_icon, auth.uid(), p_outcome, v_note, v_low, v_since)
  returning id, handled_at into v_id, v_at;

  perform public.write_audit('welfare_outreach_recorded', p_icon, null,
    jsonb_build_object('outcome', p_outcome, 'low_days', v_low, 'since', v_since, 'outreach_id', v_id));

  return jsonb_build_object(
    'id', v_id,
    'handled_at', v_at,
    'outcome', p_outcome,
    'still_listed', exists (select 1 from public.welfare_runs(now()) w where w.icon_id = p_icon)
  );
end;
$function$;

revoke all on function public.admin_welfare_list() from public, anon;
revoke all on function public.admin_welfare_record(uuid, text, text) from public, anon;
grant execute on function public.admin_welfare_list() to authenticated;
grant execute on function public.admin_welfare_record(uuid, text, text) to authenticated;
