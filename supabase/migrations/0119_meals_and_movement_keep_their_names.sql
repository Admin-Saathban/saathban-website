/* ═══════════════════════════════════════════════════════════════
   0119 — meals and movement are the person's own lists, and a log
          entry always keeps the name of what was entered

   1. THE LISTS. daily_log_prefs gains meal_categories (Breakfast, Lunch,
      Dinner by default — renameable, removable, and people can add their
      own) and movement_options (A walk, Stretching, Gardening, Housework,
      Something else — the same). NULL means never set, which the client
      reads as the defaults; an empty list is somebody's deliberate choice
      and is kept. No UPDATE runs: every existing row stays exactly as it
      is and simply reads the defaults until the person changes them.
      meal_items (the old tagged food list) is not dropped — days logged
      with it keep their names.

   2. THE NAME RULE. The owner found that removing a food from the list
      erased its name from every day it had been eaten, because a tick
      stored only the food's id. The app now stores the name in the day's
      record, but a phone keeps running an old build until the person
      refreshes, and an old build stores ids alone. So the rule is here,
      where every build's writes pass through:

      - a ticked food with no name in the record gets its name copied in
        from the person's list at the moment of saving;
      - names already in a record are carried forward on every update, so
        a writer that does not know about names cannot drop them;
      - if a food has no name anywhere, the save is REFUSED — except for
        the ids that were already nameless before this rule existed
        (grandfathered: refusing those would lock the person out of
        editing that day, and their names cannot be recovered), and the
        old fixed slot ids, whose names are the app's own words;
      - a meal answer or a movement entry must carry a name or a default's
        key, or it is refused; a movement row updated by a writer that
        only knows the old "type" field keeps the activity it already had.

      Measured before this rule, on the live database: 9 of 22 ticked
      foods already pointed at nothing, all on the test account. 4 of
      those were the old fixed slot ids, whose names are known; 4 distinct
      foods are permanently nameless. The project is on the free plan,
      which keeps no restorable backups, so there was no earlier copy to
      recover them from.
   ═══════════════════════════════════════════════════════════════ */

alter table public.daily_log_prefs add column if not exists meal_categories jsonb;
alter table public.daily_log_prefs add column if not exists movement_options jsonb;

comment on column public.daily_log_prefs.meal_categories is
  'The meals the daily log asks about, one at a time: [{id, key, name}]. NULL = never set (client shows Breakfast, Lunch, Dinner). A default keeps its key until renamed; renaming stores the person''s own words.';
comment on column public.daily_log_prefs.movement_options is
  'What the daily log offers for movement: [{id, key, name}]. NULL = never set (client shows the five defaults). Same key/name rule as meal_categories.';

create or replace function public.daily_log_keeps_names()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_items  jsonb;
  v_labels jsonb := '{}'::jsonb;
  v_old    text[] := '{}';
  v_id     text;
  v_label  text;
  v_answer jsonb;
begin
  if new.module = 'diet' then
    if tg_op = 'UPDATE' and old.module = 'diet' then
      v_old := array(
        select e.value
          from jsonb_each(case when jsonb_typeof(old.payload->'entries') = 'object' then old.payload->'entries' else '{}'::jsonb end) s
          cross join lateral jsonb_array_elements_text(case when jsonb_typeof(s.value) = 'array' then s.value else '[]'::jsonb end) e(value)
        union
        select e.value
          from jsonb_array_elements_text(case when jsonb_typeof(old.payload->'meals') = 'array' then old.payload->'meals' else '[]'::jsonb end) e(value)
      );
      if jsonb_typeof(old.payload->'labels') = 'object' then
        v_labels := old.payload->'labels';
      end if;
    end if;
    if jsonb_typeof(new.payload->'labels') = 'object' then
      v_labels := v_labels || (new.payload->'labels');
    end if;

    select p.meal_items into v_items from public.daily_log_prefs p where p.profile_id = new.icon_id;
    if jsonb_typeof(v_items) is distinct from 'array' then
      v_items := '[]'::jsonb;
    end if;

    for v_id in
      select e.value
        from jsonb_each(case when jsonb_typeof(new.payload->'entries') = 'object' then new.payload->'entries' else '{}'::jsonb end) s
        cross join lateral jsonb_array_elements_text(case when jsonb_typeof(s.value) = 'array' then s.value else '[]'::jsonb end) e(value)
      union
      select e.value
        from jsonb_array_elements_text(case when jsonb_typeof(new.payload->'meals') = 'array' then new.payload->'meals' else '[]'::jsonb end) e(value)
    loop
      continue when coalesce(v_labels->>v_id, '') <> '';
      v_label := null;
      select m->>'label' into v_label
        from jsonb_array_elements(v_items) m
        where m->>'id' = v_id
        limit 1;
      if coalesce(v_label, '') <> '' then
        v_labels := v_labels || jsonb_build_object(v_id, v_label);
      elsif v_id = any (array['breakfast', 'lunch', 'dinner', 'snack', 'chai']) or v_id = any (v_old) then
        continue;
      else
        raise exception 'a meal entry must carry the name of what was eaten'
          using errcode = 'P0001',
                hint = 'The food is not on the list and the entry did not say what it was.';
      end if;
    end loop;

    if v_labels <> '{}'::jsonb then
      new.payload := jsonb_set(new.payload, '{labels}', v_labels, true);
    end if;

    if jsonb_typeof(new.payload->'answers') = 'object' then
      for v_answer in select value from jsonb_each(new.payload->'answers') loop
        if coalesce(v_answer->>'name', '') = '' and coalesce(v_answer->>'key', '') = '' then
          raise exception 'a meal answer must carry the name of the meal'
            using errcode = 'P0001';
        end if;
      end loop;
    end if;

  elsif new.module = 'exercise' then
    if tg_op = 'UPDATE'
       and jsonb_typeof(new.payload->'activity') is distinct from 'object'
       and jsonb_typeof(old.payload->'activity') = 'object'
       and (new.payload->>'type') is not distinct from (old.payload->'activity'->>'id') then
      new.payload := jsonb_set(new.payload, '{activity}', old.payload->'activity', true);
    end if;
    if jsonb_typeof(new.payload->'activity') = 'object' then
      if coalesce(new.payload->'activity'->>'name', '') = '' and coalesce(new.payload->'activity'->>'key', '') = '' then
        raise exception 'a movement entry must carry the name of the activity'
          using errcode = 'P0001';
      end if;
    elsif coalesce(new.payload->>'type', '') <> ''
      and not ((new.payload->>'type') = any (array['walk', 'stretch', 'garden', 'house', 'other'])) then
      raise exception 'a movement entry must carry the name of the activity'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.daily_log_keeps_names() from public, anon, authenticated;

drop trigger if exists daily_log_keeps_names on public.daily_logs;
create trigger daily_log_keeps_names
  before insert or update on public.daily_logs
  for each row execute function public.daily_log_keeps_names();
