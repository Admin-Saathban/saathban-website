/* ═══════════════════════════════════════════════════════════════
   0188 — The break-glass notice ends its sentence

   0187's notice quoted the staff member's reason and ran straight on:
     The reason they gave: “A run of low days” Your voice notes were…
   The quoted reason now ends the sentence with a full stop (Urdu: ۔)
   unless the reason already ends with one (. ! ? ۔ ؟), so it never
   reads “…today.”. either.

   Only the wording changes. Rules, order (count → audit → notice →
   read), voice stripping, grants and the signature are exactly 0187's.
   Notices already sent keep their words: 0186 makes them unchangeable.
   ═══════════════════════════════════════════════════════════════ */

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
  v_quoted text;
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
    v_quoted := '“' || v_reason || '”' || case when v_reason ~ '[.!?۔؟]$' then ' ' else '۔ ' end;
    v_title := v_sb || ' نے آپ کے روزنامچے پڑھے';
    v_body := public.break_glass_day_words(v_today, 'ur') || ' کو ' || v_who || ' نے ' || v_window || ' آپ کے روزنامچے پڑھے۔ '
      || 'انہوں نے یہ وجہ بتائی: ' || v_quoted
      || 'آپ کے صوتی پیغامات نہ کھولے گئے، نہ سنے گئے۔ '
      || 'آپ جب چاہیں ' || v_sb || ' سے اس بارے میں پوچھ سکتے ہیں۔ یہ پیغام کھول کر ہمیں لکھیں، ایک انسان جواب دے گا۔';
  else
    v_who := case when v_staff is null then 'someone from the Saathban team' else v_staff || ' from the Saathban team' end;
    v_window := case when p_from = p_to
      then 'for ' || public.break_glass_day_words(p_from, 'en')
      else 'from ' || public.break_glass_day_words(p_from, 'en') || ' to ' || public.break_glass_day_words(p_to, 'en') end;
    v_quoted := '“' || v_reason || '”' || case when v_reason ~ '[.!?۔؟]$' then ' ' else '. ' end;
    v_title := 'Saathban read your daily logs';
    v_body := 'On ' || public.break_glass_day_words(v_today, 'en') || ', ' || v_who || ' read your daily logs ' || v_window || '. '
      || 'The reason they gave: ' || v_quoted
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

revoke all on function public.break_glass_read_logs(uuid, text, text, date, date, boolean) from public, anon;
grant execute on function public.break_glass_read_logs(uuid, text, text, date, date, boolean) to authenticated;
