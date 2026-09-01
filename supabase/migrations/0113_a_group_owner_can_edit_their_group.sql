/* An owner editing their own group was writing nothing.

   public.groups carries exactly two policies from 0026: "groups: read"
   and "groups: admin moderates", the latter `for update using
   (public.is_admin())`. There has never been a policy letting the
   person who created a group change its name, description or privacy.

   Under RLS that is not an error. The UPDATE simply matches zero rows,
   PostgREST answers 204, supabase-js reports no error, and
   GroupManage's Save said "Saved." — for every owner, since 0026. The
   name, the description and the privacy setting all silently reverted
   on the next load.

   Same shape as set_group_cover in 0110, and for the same reason: the
   table's update policy belongs to admins, so an owner-scoped write
   has to be a security-definer function that checks membership itself.
   is_group_admin() is the existing gate (0068 union) — creator or an
   explicitly promoted group admin, never a plain member. */

create or replace function public.update_group(
  p_group       uuid,
  p_name        text,
  p_description text default null,
  p_privacy     text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Only the people who run this group can change it';
  end if;

  /* The table's own check constraint is the authority on length; this
     only stops a blank name reaching it as a confusing constraint
     error. */
  if v_name = '' then
    raise exception 'A group needs a name';
  end if;

  if p_privacy is not null and p_privacy not in ('anyone', 'invite_only') then
    raise exception 'Unknown privacy setting';
  end if;

  update public.groups
     set name        = v_name,
         description = nullif(btrim(coalesce(p_description, '')), ''),
         /* Null means "leave it alone", so a caller that only edits
            the description cannot silently reopen a private group. */
         privacy     = coalesce(p_privacy, privacy),
         updated_at  = now()
   where id = p_group;
end;
$function$;

revoke execute on function public.update_group(uuid, text, text, text) from public, anon;
grant execute on function public.update_group(uuid, text, text, text) to authenticated;
