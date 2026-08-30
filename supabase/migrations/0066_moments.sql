/* ═══════════════════════════════════════════════════════════════
   0066 — Moments, "I'm at X" (OUT_AND_ABOUT_SPEC §8)

   "A person can say where they are without creating a permanent
    place. It sits in the tab while it is live. When it is over it
    moves to past, visible to the people who were there. It clears
    after 48 hours, leaving a window to report anything."

   ── Why this is not a check-in and not a place ──

   A check-in needs a place row, and §4.1's ruling is that places are
   admin-seeded. Without moments, "I'm at the chai place on the
   corner" would force a person to either create a permanent civic
   record of a chai stall or say nothing. Moments are the escape: a
   label, a lifetime, and no permanent artefact.

   ── The three windows, and why 48 hours is enforced here ──

     live   → in the tab, by the ordinary widening rules
     past   → only the author and the people who were there
     gone   → 48 hours after it started, for everyone

   The 48-hour cut is in the ROW's read policy, not in a cleanup job
   and not in a client filter. A cleanup job that fails to run leaves
   somebody's movements readable indefinitely, and it fails silently.
   Expressed as a policy, the row stops being readable at the right
   moment whether or not anything else works — the same reasoning that
   put `expires_at > now()` inside the check-in policy rather than
   beside it.

   The window exists "to report anything", so deletion is deliberately
   NOT immediate: a person who saw something needs the row to still be
   there when they reach for the report button.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.outdoor_moments (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  label       text not null,
  visibility  text not null default 'connections',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '2 hours'),
  ended_at    timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outdoor_moments_visibility_check') then
    alter table public.outdoor_moments
      add constraint outdoor_moments_visibility_check check (visibility in ('board', 'connections'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'outdoor_moments_label_check') then
    alter table public.outdoor_moments
      add constraint outdoor_moments_label_check check (char_length(btrim(label)) between 1 and 120);
  end if;
end
$$;

create index if not exists outdoor_moments_live_idx
  on public.outdoor_moments (expires_at desc) where ended_at is null;

comment on table public.outdoor_moments is
  'OUT_AND_ABOUT_SPEC 8 - "I am at X" without creating a permanent place. Live for ~2h, then past for the people who were there, then unreadable 48h after it started. All three windows are in the read policy, never in a cleanup job.';

/* Who was there. This is what "visible to the people who were there"
   is made of — without it, "past" would have to mean either nobody or
   everybody, and both are wrong. */
create table if not exists public.outdoor_moment_presence (
  moment_id  uuid not null references public.outdoor_moments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (moment_id, profile_id)
);

alter table public.outdoor_moments enable row level security;
alter table public.outdoor_moment_presence enable row level security;

/* One predicate for "was this person there", so the moment policy and
   the presence policy cannot disagree about it. */
create or replace function public.was_at_moment(p_moment uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.outdoor_moment_presence
    where moment_id = p_moment and profile_id = auth.uid()
  );
$function$;

revoke execute on function public.was_at_moment(uuid) from public, anon;
grant execute on function public.was_at_moment(uuid) to authenticated;

drop policy if exists "moments: read" on public.outdoor_moments;
create policy "moments: read"
  on public.outdoor_moments for select
  using (
    /* 48 hours, for everybody including the author. The window is for
       reporting, not for a permanent record of where somebody was. */
    created_at > now() - interval '48 hours'
    and (
      profile_id = auth.uid()
      or (
        public.can_use_community()
        and not public.caller_hides(profile_id)
        and (
          /* live — the ordinary widening rules, same vocabulary as a
             check-in so a person learns one set of words, not two */
          (
            ended_at is null and expires_at > now()
            and (visibility = 'board'
                 or (visibility = 'connections' and public.member_of_circle(profile_id)))
          )
          /* past — only the people who were actually there */
          or public.was_at_moment(id)
        )
      )
    )
  );

drop policy if exists "moments: own writes" on public.outdoor_moments;
create policy "moments: own writes"
  on public.outdoor_moments for insert
  with check (profile_id = auth.uid() and public.can_use_community());

drop policy if exists "moments: owner ends own" on public.outdoor_moments;
create policy "moments: owner ends own"
  on public.outdoor_moments for update
  using (profile_id = auth.uid());

drop policy if exists "moments: owner deletes own" on public.outdoor_moments;
create policy "moments: owner deletes own"
  on public.outdoor_moments for delete
  using (profile_id = auth.uid());

/* Presence is readable by the author of the moment and by the people
   in it — the same set that may read a past moment. */
drop policy if exists "moment presence: read" on public.outdoor_moment_presence;
create policy "moment presence: read"
  on public.outdoor_moment_presence for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.outdoor_moments m
      where m.id = moment_id and m.profile_id = auth.uid()
    )
    or public.was_at_moment(moment_id)
  );

/* You may say you were somewhere only as yourself, and only while it
   is still live. Adding yourself to a finished moment would be a way
   to acquire the right to read it. */
drop policy if exists "moment presence: join as self" on public.outdoor_moment_presence;
create policy "moment presence: join as self"
  on public.outdoor_moment_presence for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.outdoor_moments m
      where m.id = moment_id
        and m.ended_at is null
        and m.expires_at > now()
    )
  );

drop policy if exists "moment presence: leave" on public.outdoor_moment_presence;
create policy "moment presence: leave"
  on public.outdoor_moment_presence for delete
  using (profile_id = auth.uid());
