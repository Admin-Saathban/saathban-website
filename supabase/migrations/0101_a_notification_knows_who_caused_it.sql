-- 0101 — a notification knows who caused it.  APPLIED 2026-08-30.
--
-- OUT_AND_ABOUT_SPEC §6.1 puts "mute this person" on every notification row,
-- because "a notification a person cannot stop from the place they receive it
-- is a notification they will stop by leaving". That control needs to know
-- WHO to mute, which is notifications.created_by.
--
-- Counted on the live table before this change (found by the outdoor lane,
-- who built the mute and could not light it up):
--
--   group / circle / reminder / document_request   every row sets it
--   game                                           1946 rows, 17 set
--   dm                                             104 rows,  0 set
--   social                                         9 rows,    0 set
--
-- dm and social are the two PERSON-DRIVEN kinds and the only two at zero. A
-- DM notification literally reads "X sent you a message", so the sender is
-- not being withheld for privacy — the column simply was never written. The
-- effect was backwards: you could mute somebody from a group invite but not
-- from a direct message, and the control was silently ABSENT rather than
-- disabled, which reads as deliberate.
--
-- Fixed inside the writers rather than by changing their signatures. Adding
-- a defaulted parameter would create a SECOND function of the same name and
-- make every existing four-argument call ambiguous — the overload trap that
-- has already cost this project a migration. auth.uid() is the person whose
-- action caused the notification, which is what created_by means, and in a
-- job with no auth context it is null, which is what happens today.

create or replace function public.social_notify(p_profile uuid, p_title text, p_body text, p_link text)
returns void
language sql security definer set search_path = public, pg_temp
as $fn$
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  select p_profile, p_title, p_body, 'social', p_link, auth.uid()
  where public.notify_allowed(p_profile, 'social');
$fn$;

create or replace function public.game_notify(p_profile uuid, p_title text, p_body text, p_link text)
returns void
language sql security definer set search_path = public, pg_temp
as $fn$
  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (p_profile, p_title, p_body, 'game', p_link, auth.uid());
$fn$;
