/* ═══════════════════════════════════════════════════════════════
   0167 — a reference is a slug or an id

   Found by the rolled-back proof of 0160–0166, before any screen used it:
   grow_course_ref / grow_survey_ref (0161, 0163) were SQL functions of
   the form

     where (p_ref ~* '<uuid pattern>' and id = p_ref::uuid) or slug = p_ref

   and SQL does not promise to evaluate AND left to right, so the cast ran
   on 'research' and raised "invalid input syntax for type uuid" — the
   research survey and the Saathban course could not be opened by name.

   Comparing as text removes the cast altogether: an id matches its own
   text form, a slug matches itself, and nothing can raise.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.grow_course_ref(p_ref text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select id from public.courses
  where id::text = lower(p_ref) or slug = p_ref
  limit 1;
$function$;

create or replace function public.grow_survey_ref(p_ref text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select id from public.surveys
  where id::text = lower(p_ref) or slug = p_ref
  limit 1;
$function$;

revoke all on function public.grow_course_ref(text) from public, anon, authenticated;
revoke all on function public.grow_survey_ref(text) from public, anon, authenticated;
