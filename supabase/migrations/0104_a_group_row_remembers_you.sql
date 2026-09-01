/* ════════════════════════════════════════════════
   0104 — a group row remembers you

   The groups list showed three groups, no signal and no controls: no
   way to tell that anything had happened, no way to bring one to the
   top, no way to quieten or put away the one you never open.

   All four facts are PER PERSON PER GROUP, and group_members already
   is exactly one row per person per group with a (group_id, member_id)
   primary key — so these are columns on it rather than a parallel
   table. The groups lane's call and it is the right one: a second
   table keyed the same way would be a join for every read and a second
   place for the pair to disagree.

   NOTHING IS BACKFILLED WITH A GUESS. last_read_at is null for every
   existing membership, which reads as "never opened" — and the list
   treats null as "no unread signal" rather than "everything is
   unread". A person who has been in a group for six months should not
   be met with a badge for six months of history on the day this
   ships; the first time they open it, the mark is set and the signal
   becomes true from then on.
   ════════════════════════════════════════════════ */

alter table public.group_members
  add column if not exists last_read_at timestamptz,
  add column if not exists muted        boolean not null default false,
  add column if not exists pinned       boolean not null default false,
  add column if not exists archived     boolean not null default false;

/* The list orders by pinned, then by activity, and filters archived
   out. All three are read together for one person, every time the
   list is drawn. */
create index if not exists group_members_person_state_idx
  on public.group_members (member_id, archived, pinned);

/* ── Marking a group read ──

   SECURITY DEFINER because the caller must not be able to write
   another person's mark, and a policy that allowed the update would
   have to allow it for any row the person can see. The function takes
   no member id at all: it is always auth.uid(), so there is no
   parameter to get wrong and none to abuse.

   Idempotent by design — opening a group twice is not an error, it is
   what people do. */
create or replace function public.mark_group_read(p_group uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.group_members
     set last_read_at = now()
   where group_id = p_group
     and member_id = auth.uid();
$$;

revoke execute on function public.mark_group_read(uuid) from public, anon;
grant  execute on function public.mark_group_read(uuid) to authenticated;

/* ── Setting one of the three switches ──

   One function rather than three: they are the same act — a person
   changing how a group behaves for them — and three would be three
   policies to keep in step. The column name is checked against a
   fixed list rather than interpolated, so this cannot become a way to
   write an arbitrary column.

   Every one is reversible, which is why they are booleans and not
   deletions. Archiving a group removes it from a list, never from a
   membership. */
create or replace function public.set_group_pref(p_group uuid, p_key text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key not in ('muted', 'pinned', 'archived') then
    raise exception 'set_group_pref: unknown key %', p_key;
  end if;

  update public.group_members
     set muted    = case when p_key = 'muted'    then p_on else muted    end,
         pinned   = case when p_key = 'pinned'   then p_on else pinned   end,
         archived = case when p_key = 'archived' then p_on else archived end
   where group_id = p_group
     and member_id = auth.uid();
end;
$$;

revoke execute on function public.set_group_pref(uuid, text, boolean) from public, anon;
grant  execute on function public.set_group_pref(uuid, text, boolean) to authenticated;

comment on function public.mark_group_read(uuid) is
  'Sets the caller''s last_read_at for one group. Always auth.uid().';
comment on function public.set_group_pref(uuid, text, boolean) is
  'Sets muted/pinned/archived for the caller on one group. Key is checked, never interpolated.';
