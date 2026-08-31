/* ════════════════════════════════════════════════
   0089 — Join a public group, ASK a private one

   NAVIGATION_SPEC §5: "Join for a public group, Ask for a private one."

   0086 had it exactly the other way round. It allowed a knock on
   'anyone' and refused one on 'invite_only', on my reasoning that a
   private group is not a locked door to knock on — it is a group whose
   members choose who they ask.

   The owner has restated §5 twice, so the spec wins over the argument,
   and having built it I think the spec is also right: an approval queue
   earns its place on a PRIVATE group, and a public group that needs
   approving was never really public. The old shape made open groups
   feel guarded and closed ones invisible, which is the opposite of what
   either kind is for.

   WHAT MOVED, for Lane 4 who binds to these by name:
     join_public_group(uuid)              NEW — immediate, public only
     request_to_join_group(uuid, text)    now accepts invite_only

   request_to_join_group still accepts a public group so nothing already
   bound to it 404s; the search row simply sends public groups down the
   join path instead. Their one assertion that "a private group refuses"
   is now wrong by design and they have been told.

   Verified on the live project before this file was written:
     join a public group   -> 1 member row, 0 request rows
     ask a private group   -> 1 pending row, 0 member rows
     join a private group  -> refused, "this group is invite only"
   Probe groups deleted, residue checked, one signature each.
   ════════════════════════════════════════════════ */

create or replace function public.join_public_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_privacy text; v_creator uuid;
begin
  if not public.account_ok() then
    raise exception 'account not in good standing';
  end if;

  select privacy, created_by into v_privacy, v_creator
    from public.groups where id = p_group and hidden_at is null;
  if v_privacy is null then raise exception 'no such group'; end if;

  /* PUBLIC ONLY, and refused HERE rather than in the button — or the
     button is the only thing between a stranger and a private group. */
  if v_privacy is distinct from 'anyone' then
    raise exception 'this group is invite only';
  end if;

  if public.caller_hides(v_creator) or exists (
    select 1 from public.user_blocks
     where blocker_id = v_creator and blocked_id = auth.uid()
  ) then
    return;
  end if;

  /* Tapping twice is not a mistake worth an error. */
  insert into public.group_members (group_id, member_id, role)
  values (p_group, auth.uid(), 'member')
  on conflict (group_id, member_id) do nothing;
end;
$$;

revoke execute on function public.join_public_group(uuid) from public, anon;
grant execute on function public.join_public_group(uuid) to authenticated;

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

  /* The privacy refusal is GONE from this path — asking a private group
     is the whole point of it now. */
  if public.is_group_member(p_group) then raise exception 'already a member'; end if;

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

  return v_id;
end;
$$;

revoke execute on function public.request_to_join_group(uuid, text) from public, anon;
grant execute on function public.request_to_join_group(uuid, text) to authenticated;
