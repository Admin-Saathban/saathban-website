-- 0057 — a Fam member keeps their own daily log.  APPLIED 2026-08-30.
--
-- PRODUCT_DECISIONS §10, "Reciprocity — the correction that matters".
--
-- One-directional caring makes an Icon feel like a patient. So a Fam member
-- keeps their OWN daily log as a normal part of the app — not opt-in, not a
-- special mode, the same mood and the same simple things. What IS their
-- choice is whether their Icon can see it.
--
-- The blocker was the write policy: daily_logs INSERT required
-- app_role() = 'saath_icon', so a family member could not keep a log at all.
-- The column is called icon_id for historical reasons; it means "whose log
-- this is", and this migration makes that true rather than renaming it under
-- three lanes mid-flight.

drop policy if exists "icon writes own logs" on public.daily_logs;
create policy "a person writes their own log"
  on public.daily_logs for insert
  with check (
    icon_id = auth.uid()
    and app_role() in ('saath_icon'::user_role, 'family_member'::user_role)
    and account_ok()
  );

-- Their choice, per membership. Default FALSE: it is the member's own day,
-- and §10 gives them the choice rather than assuming it. This is the reverse
-- direction from 0037 — an Icon sharing with their circle keeps the
-- defaults 0037 set, and nothing here touches those.
alter table public.circle_members
  add column if not exists member_shares_log boolean not null default false;

comment on column public.circle_members.member_shares_log is
  'S10 reciprocity - this circle member lets the Icon see the members own daily log. The members choice, defaulting to no.';

-- The Icon may read a member's log only where that member has shared it.
drop policy if exists "icon reads a sharing member log" on public.daily_logs;
create policy "icon reads a sharing member log"
  on public.daily_logs for select
  using (
    exists (
      select 1 from public.circle_members cm
      where cm.member_id = public.daily_logs.icon_id
        and cm.icon_id = auth.uid()
        and cm.member_shares_log
    )
  );
