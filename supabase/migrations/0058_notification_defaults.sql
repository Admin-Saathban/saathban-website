/* ═══════════════════════════════════════════════════════════════
   0058 — what may interrupt a person (PRODUCT_DECISIONS §19)

   "An interruption must be about a person, not about the app."

   That sentence is the whole rule, and it decides every default:

     ON  — someone messaged you · someone's waiting on your move · a
           circle member added a reminder · Saathban replied to your
           question · someone reacted to your photo · a game invite ·
           a family group message · your Buddy or Icon got in touch ·
           a badge earned · an allotment to confirm
     OFF — streak nudges · "you haven't logged today" · feed activity ·
           anything the app wants rather than a person does

   Every ON is a PERSON having done something to you. Every OFF is the
   app wanting your attention for its own sake. A person who has been
   quiet for three days does not need their phone to say so.

   ── Why this is in the database ──

   Hiding a notification in the bell would still have delivered it —
   and once push exists, still have buzzed a phone at night. §0.9: a
   rule about what someone may receive has to hold at the database.
   So the gate lives in the writer, not the reader.

   ── Why there is no preferences table ──

   The default is CODE and the override is DATA. `profiles.settings`
   is already a jsonb column; a person who has never changed anything
   stores nothing, and adding a kind later needs no backfill and no
   migration — the new kind simply has a default like all the others.
   A table with a row per person per kind would need both, and would
   go stale the day someone adds a notification kind and forgets it.
   ═══════════════════════════════════════════════════════════════ */

/* The kinds the app wants rather than a person does. Everything not
   in this list is somebody doing something to you, and is therefore
   on unless the person turned it off. Defaulting to ON for unknown
   kinds is deliberate: a kind added later and forgotten here is a
   notification about a person, which is the safe side to fail on. */
create or replace function public.notify_default_off(p_kind text)
returns boolean
language sql
immutable
as $function$
  select p_kind in ('streak_nudge', 'log_reminder', 'feed_activity', 'app_suggestion');
$function$;

/* May this person receive this kind?

   Reads their explicit choice from profiles.settings -> 'notify' ->
   kind when they have made one, and falls back to the default above.
   STABLE and SECURITY DEFINER because the writer is usually acting as
   somebody else — the person doing the messaging, not the person
   being messaged. */
create or replace function public.notify_allowed(p_profile uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (select (settings -> 'notify' ->> p_kind)::boolean
       from public.profiles where id = p_profile),
    not public.notify_default_off(p_kind)
  );
$function$;

revoke execute on function public.notify_allowed(uuid, text) from public, anon;
revoke execute on function public.notify_default_off(text) from public, anon;
grant execute on function public.notify_allowed(uuid, text) to authenticated;
grant execute on function public.notify_default_off(text) to authenticated;

/* ── The gate, in the writer ──

   social_notify gains a kind and refuses to write one the recipient
   has turned off. It keeps its old four-argument shape as well, so
   every existing caller — and there are many, across several lanes —
   keeps working unchanged and writes 'social', which is on by default
   because it is always a person.

   Two functions rather than a defaulted parameter: adding a defaulted
   argument would create an overload that PostgREST cannot resolve
   from a 4-argument JSON call, which is exactly the trap 0049 hit. */
create or replace function public.social_notify(p_profile uuid, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  insert into public.notifications (profile_id, title, body, kind, link)
  select p_profile, p_title, p_body, 'social', p_link
  where public.notify_allowed(p_profile, 'social');
$function$;

create or replace function public.social_notify_kind(p_profile uuid, p_title text, p_body text, p_link text, p_kind text)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  insert into public.notifications (profile_id, title, body, kind, link)
  select p_profile, p_title, p_body, coalesce(p_kind, 'social'), p_link
  where public.notify_allowed(p_profile, coalesce(p_kind, 'social'));
$function$;

revoke execute on function public.social_notify_kind(uuid, text, text, text, text) from public, anon;
grant execute on function public.social_notify_kind(uuid, text, text, text, text) to authenticated;
