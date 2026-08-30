/* ════════════════════════════════════════════════
   0088 — a second ask can say more

   0086 made asking twice IDEMPOTENT rather than an error, and that
   part was right. Lane 4's test expected a refusal, found this
   instead, and changed the test rather than the rule — which is the
   correct call: a person who taps twice, or who comes back next week
   genuinely unsure whether the first one sent, must not be met with an
   error telling them off for asking. For this audience an error there
   reads as "you did something wrong", and the thing they did was
   worry.

   But idempotent was implemented as DO NOTHING, so the second call's
   message went in the bin. Somebody who asks, hears nothing for a few
   days, and comes back to explain themselves properly — "I'm Fatima's
   neighbour" — silently loses the one sentence most likely to get them
   in. Nothing tells them, which makes it worse than the error would
   have been: an error is at least information.

   DO UPDATE, coalescing in that order:

     message = coalesce(excluded.message, existing.message)

   A bare re-tap sends null and changes nothing. A re-ask with words
   replaces them. An empty second ask can never blank a good first one,
   which is why the coalesce runs that way round and not the other.

   Verified on the live project before this file was written: bare
   re-tap keeps "first words" and returns the same id; re-asking with
   "I am Fatima's neighbour" replaces the message, returns the same id,
   and leaves exactly one row. The probe group was deleted and checked
   for residue.
   ════════════════════════════════════════════════ */

create or replace function public.request_to_join_group(p_group uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid; v_privacy text; v_creator uuid; v_msg text;
begin
  if not public.account_ok() then
    raise exception 'account not in good standing';
  end if;

  select privacy, created_by into v_privacy, v_creator
    from public.groups where id = p_group and hidden_at is null;
  if v_privacy is null then raise exception 'no such group'; end if;

  /* Invite-only stays a refusal — 0086's reasoning is unchanged: a
     private group is not a locked door to knock on, it is one whose
     members choose who they ask. */
  if v_privacy is distinct from 'anyone' then
    raise exception 'this group is invite only';
  end if;

  if public.is_group_member(p_group) then raise exception 'already a member'; end if;

  /* Blocks stay silent in both directions. */
  if public.caller_hides(v_creator) or exists (
    select 1 from public.user_blocks where blocker_id = v_creator and blocked_id = auth.uid()
  ) then
    return null;
  end if;

  v_msg := nullif(btrim(coalesce(p_message, '')), '');

  insert into public.group_join_requests (group_id, requester_id, message)
  values (p_group, auth.uid(), v_msg)
  on conflict (group_id, requester_id) where status = 'pending'
    do update set message = coalesce(excluded.message, public.group_join_requests.message)
  returning id into v_id;

  /* DO UPDATE always returns a row, unlike DO NOTHING — so 0086's
     follow-up SELECT for the existing id is gone rather than dead. */
  return v_id;
end;
$$;

revoke execute on function public.request_to_join_group(uuid, text) from public, anon;
grant execute on function public.request_to_join_group(uuid, text) to authenticated;
