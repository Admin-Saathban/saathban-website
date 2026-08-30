/* ═══════════════════════════════════════════════════════════════
   0068 — one meaning for is_group_admin(), agreed between two lanes

   ── What happened ──

   Two lanes defined `public.is_group_admin(uuid)` within minutes of
   each other, neither knowing the other had:

     0067 (this lane)  creator OR co_admin        — GROUPS_SPEC §7.3
     0086 (Lane 2)     creator OR platform admin  — join requests

   `create or replace` on the SAME signature does not collide the way
   0049's overload trap does; it silently WINS. So the later apply
   replaced the earlier definition and nothing anywhere reported a
   problem. 0067 landed second, which meant Lane 2's join-request
   policies and both their RPCs — all of which route through this one
   function — quietly stopped admitting platform admins.

   That is the more dangerous shape of the two. An overload fails
   loudly on the next call; this failed by narrowing a permission
   predicate under code that had already been verified against it.

   ── The fix is the union, because both clauses were right ──

     creator          — the person whose group it is
     co_admin         — GROUPS_SPEC §7.3, the whole point of the
                        manage screen's promote/demote
     platform admin   — Lane 2's design for the join-request queue,
                        and consistent with an admin being able to
                        act on reported content inside a group

   Neither lane has to change a line of code: every caller asked "may
   this person administer this group", and all three of these are
   people who may.

   ── What this migration must NOT do ──

   It does not touch `is_group_creator()`. GROUPS_SPEC §7.3 reserves
   deleting the group and handing over ownership to the OWNER alone,
   and those checks call is_group_creator. Folding admins into that
   too would hand a co-admin the power to delete somebody's group,
   which is exactly the invisible widening this file exists to undo.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.is_group_admin(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.is_admin()
     or exists (
       select 1 from public.group_members
       where group_id = p_group
         and member_id = auth.uid()
         and role in ('creator', 'co_admin')
     );
$function$;

revoke execute on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_group_admin(uuid) to authenticated;

comment on function public.is_group_admin(uuid) is
  'May this caller administer this group: its creator, a co-admin (GROUPS_SPEC 7.3), or a platform admin (Lane 2 join requests). The union of the two definitions that 0067 and 0086 each wrote independently. Deliberately NOT the same as is_group_creator(), which stays owner-only because deleting a group and handing over ownership are reserved to the owner.';
