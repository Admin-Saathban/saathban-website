/* ═══════════════════════════════════════════════════════════════
   0118 — a survey is answered once

   The owner: after completing the research survey, the same person can
   open it and submit again as many times as they like.

   WHAT WAS ACTUALLY HAPPENING, because it is not what it looked like.
   0054 already made profile_id UNIQUE, and that constraint is live, so
   a second row for the same person has never been possible — there are
   no duplicate rows to clean up. What the screen allowed was an
   OVERWRITE: the client upserts on profile_id, the update policy let the
   person rewrite their own row, and each "submission" silently replaced
   the answers before it. One row per person, but not one ANSWER per
   person — the research kept whichever version was given last.

   So the rule is the one the owner asked for, held where the screen
   cannot reach: once submitted_at is set, the answers, the submission
   time and the owner of the row are final. A trigger rather than a
   policy, for two reasons. It holds for every role, not only for the
   person — nobody can quietly rewrite research somebody gave. And it
   REFUSES out loud: a policy would let a bypassed update match zero rows
   and report success, which is the silent failure the survey had.

   WHAT STAYS OPEN, deliberately. The person can still DELETE their
   response (0054's "own survey: delete"). The consent screen promises
   "you can stop at any point", and withdrawing research you gave is that
   promise, not a loophole. After a withdrawal there is again no row, so
   answering afresh writes one row, still one per person.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.survey_response_is_final()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.submitted_at is not null
     and (new.answers is distinct from old.answers
          or new.submitted_at is distinct from old.submitted_at
          or new.profile_id is distinct from old.profile_id) then
    raise exception 'survey already answered'
      using errcode = 'P0001',
            hint = 'A submitted response is final. It can be withdrawn (deleted), not replaced.';
  end if;
  return new;
end;
$function$;

/* A trigger function is never called directly, so nobody needs EXECUTE
   on it; triggers fire regardless of the caller's privileges. */
revoke all on function public.survey_response_is_final() from public, anon, authenticated;

drop trigger if exists survey_response_is_final on public.survey_responses;
create trigger survey_response_is_final
  before update on public.survey_responses
  for each row execute function public.survey_response_is_final();
