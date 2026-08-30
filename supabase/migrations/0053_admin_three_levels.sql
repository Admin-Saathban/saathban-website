/* ═══════════════════════════════════════════════════════════════
   0053 — admin becomes three levels (PRODUCT_DECISIONS §18)

   | Moderator   | community safety ONLY: reports, hide, mute,
   |             | suspend with a typed reason. No Buddy applications,
   |             | no documents, no health data, no broadcasts
   | Admin       | all of that, plus vetting, documents, events,
   |             | questions, broadcasts. NOT the audit log, NOT
   |             | Icons' private logs, NOT Buddy allotment
   | Super admin | everything, plus the audit log, break-glass,
   |             | creating admins, deletion, allotment, survey answers

   ── What exists already, and what is missing ──

   `profiles.admin_level` exists and `is_super_admin()` reads it. What
   does not exist is any rung BELOW admin: `is_admin()` is one boolean
   over `role = 'admin'`, so today every admin surface is all-or-
   nothing and a moderator would necessarily see Buddy documents.

   ── is_admin() DOES NOT CHANGE MEANING ──

   This is the important decision. `is_admin()` keeps meaning "at
   least an ordinary admin" and will NOT start returning true for
   moderators. Every policy across the schema that already reads it
   continues to mean exactly what its author intended, and a moderator
   gains nothing merely because this migration ran. Widening an
   existing predicate is how a permission change becomes invisible.

   A moderator is therefore ADDITIVE: new predicates, `is_moderator()`
   and `can_moderate()`, are introduced and used only where community
   safety is the subject.

   ── Why a moderator's suspension notifies every admin ──

   §18: "A moderator's suspension notifies all admins with the reason.
   They can act at 2am against active harassment, but never
   invisibly." A power exercised alone at 2am with nobody told is how
   moderation goes wrong; the notification is the check, not a
   permission prompt that would make the power useless.
   ═══════════════════════════════════════════════════════════════ */

/* admin_level is an ENUM ('support', 'super'), not a checked text
   column — so the third level is added to the TYPE. 'support' is the
   existing ordinary admin and keeps that meaning; 'moderator' sorts
   BEFORE it, which is only cosmetic but reads correctly anywhere the
   levels are listed.

   ALTER TYPE ... ADD VALUE cannot share a transaction with statements
   that then USE the new value, so this runs on its own. */
alter type public.admin_level add value if not exists 'moderator' before 'support';

comment on column public.profiles.admin_level is
  'moderator = community safety only (§18); support = ordinary admin; super = everything. is_admin() is deliberately FALSE for a moderator.';

/* A NULL admin_level on an admin still means an ordinary admin, so no
   existing account changes when this runs. */

/* ── At least an ordinary admin ──
   Rewritten to EXCLUDE moderators explicitly. Without this line a
   moderator would inherit every is_admin() policy in the schema the
   moment the level existed — the invisible widening this migration
   exists to avoid. */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(admin_level::text, 'support') <> 'moderator'
      and not is_paused and not is_blocked
  );
$function$;

/* ── A moderator, exactly ── */
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and admin_level::text = 'moderator'
      and not is_paused and not is_blocked
  );
$function$;

/* ── Anyone who may act on community safety ──
   The predicate to use for reports, hiding, muting and suspension.
   Moderators and above; super admins included because they are above
   admins, not beside them. */
create or replace function public.can_moderate()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.is_moderator() or public.is_admin() or public.is_super_admin();
$function$;

revoke execute on function public.is_moderator() from public, anon;
revoke execute on function public.can_moderate() from public, anon;
grant execute on function public.is_moderator() to authenticated;
grant execute on function public.can_moderate() to authenticated;

/* ── The reports queue opens to moderators ──
   This is the ONE surface that widens, and it is the surface §18 says
   a moderator exists for. Everything else — vetting, documents,
   broadcasts, the audit log — keeps the predicate it already had, so
   a moderator reaches none of it.

   Written defensively: the policy is only replaced if the table is
   there, so this migration does not depend on the reports table
   having a particular name in a particular lane's migration. */
do $$
begin
  if to_regclass('public.community_reports') is not null then
    execute 'drop policy if exists "moderators read reports" on public.community_reports';
    execute 'create policy "moderators read reports" on public.community_reports for select using (public.can_moderate())';
  end if;
end
$$;

/* ── Suspension by a moderator tells every admin ──
   The reason is typed and travels with the notification: an admin
   reading it must be able to judge the call, not merely learn that a
   call was made. */
create or replace function public.moderator_suspend(p_profile uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_name text;
  rec record;
begin
  if not public.can_moderate() then
    raise exception 'Not allowed';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;

  update public.profiles set is_paused = true where id = p_profile;
  select full_name into v_name from public.profiles where id = v_actor;

  /* Every admin and super admin hears, with the reason. Not a log
     somebody might read — a notification somebody will. */
  for rec in
    select id from public.profiles
    where role = 'admin' and coalesce(admin_level::text, 'support') <> 'moderator' and id <> v_actor
  loop
    insert into public.notifications (profile_id, title, body, kind, link)
    values (
      rec.id,
      'An account was suspended',
      coalesce(v_name, 'A moderator') || ' suspended an account. Reason: ' || p_reason,
      'admin',
      '/app/admin'
    );
  end loop;
end;
$function$;

revoke execute on function public.moderator_suspend(uuid, text) from public, anon;
grant execute on function public.moderator_suspend(uuid, text) to authenticated;
