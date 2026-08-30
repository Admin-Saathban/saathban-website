/* ═══════════════════════════════════════════════════════════════
   0064 — access notes on a place (OUT_AND_ABOUT_SPEC §4)

   "Green chips for what is there: Shade · Benches · Toilet · Flat
    walk. Grey chips for what to know: Steps at gate · No shade.
    Grey is NOT red and NOT a warning. 'Steps at gate' is information,
    not a hazard. For a 70-year-old this is the difference between
    going and not going, and no map app tells them."

   ── §4.1 IS NOT SETTLED AND THIS MIGRATION DOES NOT SETTLE IT ──

   Who writes these notes is an open question for the owner. The
   instruction to this lane was explicit: build the chips, seed a few
   by hand, ask. So the WRITE side here is deliberately the narrowest
   thing that permits seeding and forecloses nothing:

     read  → anyone who may see places
     write → admins only

   If the answer comes back "admin-seeded", this is already it. If it
   comes back "anyone can suggest", one policy is added and a
   suggestion queue lands beside it; nothing here has to be undone or
   migrated. Choosing crowd-writes NOW would be the irreversible move,
   because wrong notes are worse than none: "flat walk" where there
   are steps sends someone on a trip they cannot finish.

   ── Why keys and not words ──

   The feature is stored as a KEY ('shade'), never as the English
   label. Urdu ships day one; a table holding the string "Shade" makes
   the Urdu screen impossible without a second migration. The words
   live in the locale files, and the green/grey tone is derived from
   the key in one place in the UI — not stored per row, so no row can
   ever disagree with itself about whether it is reassurance or
   information.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.outdoor_place_access (
  place_id   uuid not null references public.outdoor_places (id) on delete cascade,
  feature    text not null,
  noted_by   uuid references public.profiles (id) on delete set null,
  noted_at   timestamptz not null default now(),
  primary key (place_id, feature)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outdoor_place_access_feature_check') then
    alter table public.outdoor_place_access
      add constraint outdoor_place_access_feature_check check (feature in (
        -- what is there (shown green)
        'shade', 'benches', 'toilet', 'flat_walk',
        -- what to know (shown grey — information, not a hazard)
        'steps_at_gate', 'no_shade'
      ));
  end if;
end
$$;

comment on table public.outdoor_place_access is
  'Access notes for a place (OUT_AND_ABOUT_SPEC §4). Feature KEYS only, never labels — the words live in the locale files so Urdu works. Who may write these is §4.1, unsettled: writes are admin-only until the owner rules.';

alter table public.outdoor_place_access enable row level security;

/* Read: if you can see the place, you can see how to get into it.
   This is the whole value of the feature — a note nobody can read
   before they set out is not a note. */
drop policy if exists "place access: read" on public.outdoor_place_access;
create policy "place access: read"
  on public.outdoor_place_access for select
  using (
    exists (
      select 1 from public.outdoor_places p
      where p.id = place_id and p.is_hidden = false
    )
  );

/* Write: admins only, pending §4.1. */
drop policy if exists "place access: admin writes" on public.outdoor_place_access;
create policy "place access: admin writes"
  on public.outdoor_place_access for all
  using (public.is_admin())
  with check (public.is_admin());

/* ── "Something wrong here?" (§4, required whatever §4.1 decides) ──

   Routed into the report queue that already exists rather than a new
   one, so it appears in front of the same admins with the same
   workflow. target_author_id stays null: a place has nobody to
   blame, and the point is to fix the note, not to judge a person. */
alter table public.community_reports
  drop constraint if exists community_reports_target_kind_check;
alter table public.community_reports
  add constraint community_reports_target_kind_check check (
    target_kind in ('post', 'comment', 'dm_message', 'park_board', 'group', 'group_post', 'place_access')
  );
