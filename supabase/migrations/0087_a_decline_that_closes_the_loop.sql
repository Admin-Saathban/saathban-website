/* ════════════════════════════════════════════════
   0087 — a decline that closes the loop

   0086 sent nothing on decline. The reasoning was that every other
   refusal in this app is silent — a declined friend request and a
   blocked DM are deliberately indistinguishable from one still waiting
   — and that a rejection arriving in a notification feed is a sting.

   Two lanes pushed back within the hour, from opposite directions, and
   between them they found the thing I had missed. The argument that
   settles it is about THIS audience rather than about refusals in
   general: a 79-year-old who taps "ask to join" and then hears nothing
   for a week does not conclude that somebody said no. They conclude
   that it never sent, or that they have been forgotten. The whole
   product exists for people whose default assumption is that they have
   been overlooked, so silence is not the gentle option here — it is
   the one that confirms the fear.

   What makes a decline bearable is that it carries no reason and no
   finality. This one names no person, never says declined, rejected or
   refused, and ends by saying they can ask again — which is TRUE,
   because the unique index is partial on pending, so a decided row
   never blocks a later one.

   The link goes to search, not to the group. Sending somebody back to
   a door that has just not opened is precisely the sting the wording
   is trying to avoid.

   Both halves stand: the kept 'declined' row still drives the honest
   state on the search row for anyone who goes back and looks, and this
   is the nudge for the many who never would.
   ════════════════════════════════════════════════ */

create or replace function public.respond_join_request(p_request uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group uuid; v_requester uuid; v_name text;
begin
  select group_id, requester_id into v_group, v_requester
    from public.group_join_requests where id = p_request and status = 'pending';
  if v_group is null then return; end if;

  if not public.is_group_admin(v_group) then raise exception 'not allowed'; end if;

  update public.group_join_requests
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_request;

  select name into v_name from public.groups where id = v_group;

  if p_approve then
    insert into public.group_members (group_id, member_id, role)
    values (v_group, v_requester, 'member')
    on conflict (group_id, member_id) do nothing;

    insert into public.notifications (profile_id, title, body, kind, link, created_by)
    values (v_requester, 'You are in',
      'You have joined ' || chr(8220) || coalesce(v_name, 'the group') || chr(8221) || '.',
      'group', '/app/groups/' || v_group, auth.uid());
  else
    insert into public.notifications (profile_id, title, body, kind, link, created_by)
    values (v_requester,
      'About ' || chr(8220) || coalesce(v_name, 'that group') || chr(8221),
      'They are not taking new members just now. You can ask again any time.',
      'group', '/app/search', auth.uid());
  end if;
end;
$$;

revoke execute on function public.respond_join_request(uuid, boolean) from public, anon;
grant execute on function public.respond_join_request(uuid, boolean) to authenticated;
