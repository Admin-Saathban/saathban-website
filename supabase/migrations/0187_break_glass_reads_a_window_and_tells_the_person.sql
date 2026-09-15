/* ═══════════════════════════════════════════════════════════════
   0187 — Break-glass reads a short window, never a voice, and the
          person is told

   CLAUDE.md: "Reading an Icon's private logs is break-glass — typed
   reason, logged, for genuine welfare concerns and SOS only."

   0006's break_glass_read_logs(p_icon, p_reason, p_from) returned every
   log for all time, voice notes included, and the Icon was never told.
   It had no screen and was never called. It is dropped here and replaced.

   admin_break_glass_prepare(p_icon)  → jsonb
      For the form. Super-admin only. A Saath-Icon only (not the caller).
      Returns the person's name, their own today, the language they will
      be told in, whether they are on the welfare list right now (count
      and dates only), and how many times their logs were read before.
      Reads no log. Audited: break_glass_form_opened.

   break_glass_read_logs(p_icon, p_reason_type, p_reason, p_from, p_to,
                         p_welfare_flag default false)  → jsonb
      RULES, all refused with a hint the screen can word:
        super-admin only (not support, moderator, other roles, anon)
        target is a Saath-Icon, not the caller   break_glass_not_icon
        reason type: welfare | sos | other       break_glass_reason_type
        reason: welfare/sos ≥ 20 characters,
                other ≥ 60, at most 1000         break_glass_reason_short/_long
        from and to both given                   break_glass_window_missing
        to ≥ from                                break_glass_window_order
        at most 30 days, counting both ends      break_glass_window_long
        to ≤ the person's own today              break_glass_window_future
        p_welfare_flag only with 'welfare', and
          only while they are on the list        break_glass_flag_type / _not_flagged
      ORDER, one transaction:
        1. count the rows in the window (no content read)
        2. the audit row: window, days, reason type, linked flag, rows,
           voice notes withheld, the language the person is told in
        3. the person's notification, in their preferred_language —
           if it is not written (an error, or any trigger dropping it),
           the function raises and steps 1–2 roll back: no silent read
        4. the logs, and the names their ids refer to (medicines,
           trackers, meals, movements) from daily_log_prefs
      VOICE NOTES ARE EXCLUDED, TRANSCRIPTS INCLUDED IN THAT. A recorded
      voice is more intimate than a number; the ruling keeps it out
      entirely, and an automatic transcript is the voice in other form.
      Every key that is (or holds) a recording — voice, audio,
      recording, transcript, signed url, and the path/mime/seconds that
      describe the file — is removed at any depth. Each row carries
      voice_note_recorded true/false instead. No path, no URL, no text.
      Mood values and written notes are returned: they are the log.

   The notification (kind 'break_glass', 0186: not mutable, not
   forgeable, not editable or deletable by staff) links to Help, where
   the person can write to Saathban.
   ═══════════════════════════════════════════════════════════════ */

drop function if exists public.break_glass_read_logs(uuid, text, date);

/* ── Voice, at any depth ── */

create or replace function public.break_glass_voice_key(p_key text)
 returns boolean
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select p_key ~* '(voice|audio|recording|transcri|signed_?url)'
      or lower(p_key) in ('path', 'storage_path', 'mime', 'seconds', 'url');
$function$;

create or replace function public.break_glass_without_voice(p jsonb)
 returns jsonb
 language plpgsql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
begin
  if p is null then
    return null;
  end if;
  if jsonb_typeof(p) = 'object' then
    select coalesce(jsonb_object_agg(e.key, public.break_glass_without_voice(e.value)), '{}'::jsonb)
      into v
      from jsonb_each(p) e
     where not public.break_glass_voice_key(e.key);
    return v;
  elsif jsonb_typeof(p) = 'array' then
    select coalesce(jsonb_agg(public.break_glass_without_voice(e.value) order by e.ord), '[]'::jsonb)
      into v
      from jsonb_array_elements(p) with ordinality e(value, ord);
    return v;
  end if;
  return p;
end;
$function$;

create or replace function public.break_glass_has_voice(p jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if p is null then
    return false;
  end if;
  if jsonb_typeof(p) = 'object' then
    return exists (
      select 1 from jsonb_each(p) e
       where (e.key ~* '(voice|audio|recording|transcri)'
              and e.value not in ('null'::jsonb, '{}'::jsonb, '""'::jsonb, 'false'::jsonb, '[]'::jsonb))
          or public.break_glass_has_voice(e.value)
    );
  elsif jsonb_typeof(p) = 'array' then
    return exists (select 1 from jsonb_array_elements(p) e where public.break_glass_has_voice(e.value));
  end if;
  return false;
end;
$function$;

/* ── A day in words, in the person's language ── */

create or replace function public.break_glass_day_words(p_day date, p_lang text)
 returns text
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select case when p_lang = 'ur' then
      extract(day from p_day)::int || ' '
      || (array['جنوری','فروری','مارچ','اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر'])[extract(month from p_day)::int]
      || ' ' || extract(year from p_day)::int
    else
      extract(day from p_day)::int || ' ' || btrim(to_char(p_day, 'Month')) || ' ' || extract(year from p_day)::int
    end;
$function$;

revoke all on function public.break_glass_voice_key(text) from public, anon, authenticated;
revoke all on function public.break_glass_without_voice(jsonb) from public, anon, authenticated;
revoke all on function public.break_glass_has_voice(jsonb) from public, anon, authenticated;
revoke all on function public.break_glass_day_words(date, text) from public, anon, authenticated;

/* ── The form ── */

create or replace function public.admin_break_glass_prepare(p_icon uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text;
  v_role text;
  v_lang text;
  v_today date;
  v_low int;
  v_since date;
  v_raised date;
  v_listed boolean := false;
  v_before int;
  v_last timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'Break-glass access is limited to super-admins' using errcode = '42501';
  end if;

  select p.full_name, p.role::text, case when p.preferred_language = 'ur' then 'ur' else 'en' end
    into v_name, v_role, v_lang
    from public.profiles p
   where p.id = p_icon;
  if not found or v_role <> 'saath_icon' or p_icon = auth.uid() then
    raise exception 'Break-glass reads are for a Saath-Icon''s own daily logs'
      using hint = 'break_glass_not_icon';
  end if;

  v_today := public.local_today(p_icon);

  select w.low_days, w.since, w.raised_on into v_low, v_since, v_raised
    from public.welfare_runs(now()) w
   where w.icon_id = p_icon;
  v_listed := found;

  select count(*), max(a.created_at) into v_before, v_last
    from public.audit_log a
   where a.action = 'break_glass_read_logs' and a.target_profile_id = p_icon;

  perform public.write_audit('break_glass_form_opened', p_icon, null,
    jsonb_build_object('welfare_listed', v_listed));

  return jsonb_build_object(
    'icon_id', p_icon,
    'name', v_name,
    'today', v_today,
    'told_in', v_lang,
    'max_days', 30,
    'welfare', case when v_listed then jsonb_build_object('low_days', v_low, 'since', v_since, 'raised_on', v_raised) end,
    'previous_reads', v_before,
    'last_read_at', v_last
  );
end;
$function$;

/* ── The read ── */

create or replace function public.break_glass_read_logs(
  p_icon uuid,
  p_reason_type text,
  p_reason text,
  p_from date,
  p_to date,
  p_welfare_flag boolean default false
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_min int;
  v_role text;
  v_lang text;
  v_today date;
  v_low int;
  v_since date;
  v_raised date;
  v_rows int;
  v_voice int;
  v_audit bigint;
  v_staff text;
  v_sb text := 'ساتھ' || chr(8204) || 'بن';
  v_who text;
  v_window text;
  v_title text;
  v_body text;
  v_notice uuid;
  v_logs jsonb;
  v_names jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Break-glass access is limited to super-admins' using errcode = '42501';
  end if;

  select p.role::text, case when p.preferred_language = 'ur' then 'ur' else 'en' end
    into v_role, v_lang
    from public.profiles p
   where p.id = p_icon;
  if not found or v_role <> 'saath_icon' or p_icon = auth.uid() then
    raise exception 'Break-glass reads are for a Saath-Icon''s own daily logs'
      using hint = 'break_glass_not_icon';
  end if;

  if p_reason_type is null or p_reason_type not in ('welfare', 'sos', 'other') then
    raise exception 'Choose the kind of reason: welfare, sos or other'
      using hint = 'break_glass_reason_type';
  end if;
  v_min := case when p_reason_type = 'other' then 60 else 20 end;
  if char_length(v_reason) < v_min then
    raise exception 'A typed reason of at least % characters is required', v_min
      using hint = 'break_glass_reason_short';
  end if;
  if char_length(v_reason) > 1000 then
    raise exception 'The reason can be at most 1000 characters'
      using hint = 'break_glass_reason_long';
  end if;

  if p_from is null or p_to is null then
    raise exception 'Both the first and the last day are required'
      using hint = 'break_glass_window_missing';
  end if;
  if p_to < p_from then
    raise exception 'The last day cannot come before the first day'
      using hint = 'break_glass_window_order';
  end if;
  if (p_to - p_from) + 1 > 30 then
    raise exception 'The window can be at most 30 days'
      using hint = 'break_glass_window_long';
  end if;
  v_today := public.local_today(p_icon);
  if p_to > v_today then
    raise exception 'The last day cannot be after the person''s today (%)', v_today
      using hint = 'break_glass_window_future';
  end if;

  if coalesce(p_welfare_flag, false) then
    if p_reason_type <> 'welfare' then
      raise exception 'A welfare flag can only be linked to a welfare concern'
        using hint = 'break_glass_flag_type';
    end if;
    select w.low_days, w.since, w.raised_on into v_low, v_since, v_raised
      from public.welfare_runs(now()) w
     where w.icon_id = p_icon;
    if not found then
      raise exception 'This person is not on the welfare list right now'
        using hint = 'break_glass_not_flagged';
    end if;
  end if;

  /* 1. How much is there — a count, no content. */
  select count(*), count(*) filter (where public.break_glass_has_voice(l.payload))
    into v_rows, v_voice
    from public.daily_logs l
   where l.icon_id = p_icon and l.log_date between p_from and p_to;

  /* 2. On the record before anything is read. */
  insert into public.audit_log (actor_id, action, target_profile_id, reason, detail)
  values (auth.uid(), 'break_glass_read_logs', p_icon, v_reason,
    jsonb_strip_nulls(jsonb_build_object(
      'window_from', p_from,
      'window_to', p_to,
      'window_days', (p_to - p_from) + 1,
      'reason_type', p_reason_type,
      'welfare_flag_linked', coalesce(p_welfare_flag, false),
      'welfare_low_days', v_low,
      'welfare_since', v_since,
      'welfare_raised_on', v_raised,
      'rows', v_rows,
      'voice_notes_withheld', v_voice,
      'person_told', true,
      'told_in', v_lang
    )))
  returning id into v_audit;

  /* 3. The person is told, in their language, in the same transaction. */
  select nullif(btrim(p.full_name), '') into v_staff from public.profiles p where p.id = auth.uid();

  if v_lang = 'ur' then
    v_who := case when v_staff is null then v_sb || ' کی ٹیم کے ایک رکن' else v_sb || ' کی ٹیم کے ' || v_staff end;
    v_window := case when p_from = p_to
      then public.break_glass_day_words(p_from, 'ur') || ' کے'
      else public.break_glass_day_words(p_from, 'ur') || ' سے ' || public.break_glass_day_words(p_to, 'ur') || ' تک کے' end;
    v_title := v_sb || ' نے آپ کے روزنامچے پڑھے';
    v_body := public.break_glass_day_words(v_today, 'ur') || ' کو ' || v_who || ' نے ' || v_window || ' آپ کے روزنامچے پڑھے۔ '
      || 'انہوں نے یہ وجہ بتائی: “' || v_reason || '”۔ '
      || 'آپ کے صوتی پیغامات نہ کھولے گئے، نہ سنے گئے۔ '
      || 'آپ جب چاہیں ' || v_sb || ' سے اس بارے میں پوچھ سکتے ہیں۔ یہ پیغام کھول کر ہمیں لکھیں، ایک انسان جواب دے گا۔';
  else
    v_who := case when v_staff is null then 'someone from the Saathban team' else v_staff || ' from the Saathban team' end;
    v_window := case when p_from = p_to
      then 'for ' || public.break_glass_day_words(p_from, 'en')
      else 'from ' || public.break_glass_day_words(p_from, 'en') || ' to ' || public.break_glass_day_words(p_to, 'en') end;
    v_title := 'Saathban read your daily logs';
    v_body := 'On ' || public.break_glass_day_words(v_today, 'en') || ', ' || v_who || ' read your daily logs ' || v_window || '. '
      || 'The reason they gave: “' || v_reason || '” '
      || 'Your voice notes were not opened or listened to. '
      || 'You can ask Saathban about this at any time. Open this message to write to us, and a person will answer.';
  end if;

  perform set_config('saathban.break_glass_notice', p_icon::text, true);
  insert into public.notifications (profile_id, title, body, kind, created_by, link)
  values (p_icon, v_title, v_body, 'break_glass', auth.uid(), '/app/help')
  returning id into v_notice;
  perform set_config('saathban.break_glass_notice', '', true);

  if v_notice is null then
    raise exception 'The person could not be told, so nothing was read'
      using hint = 'break_glass_not_told';
  end if;

  /* 4. The read. */
  select coalesce(jsonb_agg(jsonb_build_object(
           'log_date', l.log_date,
           'module', l.module,
           'mood_value', l.mood_value,
           'is_backfilled', l.is_backfilled,
           'created_at', l.created_at,
           'updated_at', l.updated_at,
           'payload', public.break_glass_without_voice(l.payload),
           'voice_note_recorded', public.break_glass_has_voice(l.payload)
         ) order by l.log_date desc, l.module), '[]'::jsonb)
    into v_logs
    from public.daily_logs l
   where l.icon_id = p_icon and l.log_date between p_from and p_to;

  select public.break_glass_without_voice(jsonb_build_object(
           'medications', coalesce(d.medications, '[]'::jsonb),
           'trackers', coalesce(d.trackers, '[]'::jsonb),
           'meal_items', coalesce(d.meal_items, '[]'::jsonb),
           'meal_categories', coalesce(d.meal_categories, '[]'::jsonb),
           'movement_options', coalesce(d.movement_options, '[]'::jsonb)))
    into v_names
    from public.daily_log_prefs d
   where d.profile_id = p_icon;

  return jsonb_build_object(
    'audit_id', v_audit,
    'notification_id', v_notice,
    'told_in', v_lang,
    'window', jsonb_build_object('from', p_from, 'to', p_to, 'days', (p_to - p_from) + 1),
    'rows', v_logs,
    'names', coalesce(v_names, '{}'::jsonb),
    'voice_notes_withheld', v_voice
  );
end;
$function$;

revoke all on function public.admin_break_glass_prepare(uuid) from public, anon;
revoke all on function public.break_glass_read_logs(uuid, text, text, date, date, boolean) from public, anon;
grant execute on function public.admin_break_glass_prepare(uuid) to authenticated;
grant execute on function public.break_glass_read_logs(uuid, text, text, date, date, boolean) to authenticated;
