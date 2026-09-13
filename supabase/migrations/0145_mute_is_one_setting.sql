/* ═══════════════════════════════════════════════════════════════
   0145 — Mute is one setting

   THE MODEL. user_blocks kind 'mute' is THE Mute: one row, one person.
   dm_muted (0135) stays, because the Messages world, the tab badge and
   notify_dm_message already read it — but it is no longer a second idea.
   It is a mirror the database keeps in lock-step:

     · a 'mute' row appears  → the conversation with that person (if any)
                               gets its dm_muted row;
     · a 'mute' row goes     → that dm_muted row goes;
     · a dm_muted row appears (a thread's Mute, however written)
                             → the person's 'mute' row appears;
     · a dm_muted row goes   → the person's 'mute' row goes — unless the
                               conversation itself is being deleted
                               (cascade), which must not unmute anyone;
     · a conversation starts with someone already muted
                             → it starts muted.

   The mirrors cannot loop: each writes with ON CONFLICT DO NOTHING or
   deletes a row that is already gone, and neither fires a row trigger.

   THE MIGRATION OF EXISTING SETTINGS (owner: "Migrate existing settings
   so their intent is honoured rather than dropped, and report how many
   accounts were migrated"). fold_old_mutes():
     1. every user_blocks 'mute' row gets the dm_muted row for any
        conversation between the two people, so Messages shows them as
        muted and they can unmute there;
     2. every 0135 chat mute (dm_muted) gets its person 'mute' row, so a
        thread's Mute is the same Mute;
   and returns the counts. The accounts migrated are the distinct people
   who held an old 'mute' row when it ran — their intent (silence this
   person) is honoured by 0144 whether or not a conversation exists.
   The function is kept (service role only) so the fold can be proven in
   a rolled-back transaction.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.fold_old_mutes()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_accounts   int;
  v_mute_rows  int;
  v_chats      int;
  v_from_chats int;
begin
  select count(distinct blocker_id), count(*)
    into v_accounts, v_mute_rows
    from public.user_blocks where kind = 'mute';

  with ins as (
    insert into public.dm_muted (profile_id, request_id)
    select b.blocker_id, r.id
      from public.user_blocks b
      join public.dm_requests r
        on least(r.requester_id, r.recipient_id) = least(b.blocker_id, b.blocked_id)
       and greatest(r.requester_id, r.recipient_id) = greatest(b.blocker_id, b.blocked_id)
     where b.kind = 'mute'
    on conflict do nothing
    returning 1
  )
  select count(*) into v_chats from ins;

  with ins as (
    insert into public.user_blocks (blocker_id, blocked_id, kind)
    select m.profile_id,
           case when r.requester_id = m.profile_id then r.recipient_id else r.requester_id end,
           'mute'
      from public.dm_muted m
      join public.dm_requests r on r.id = m.request_id
    on conflict do nothing
    returning 1
  )
  select count(*) into v_from_chats from ins;

  return jsonb_build_object(
    'accounts_migrated', v_accounts,
    'old_mute_rows', v_mute_rows,
    'dm_muted_rows_created', v_chats,
    'chat_mutes_folded_into_person_mutes', v_from_chats
  );
end;
$function$;

revoke all on function public.fold_old_mutes() from public, anon, authenticated;

/* Run the fold BEFORE the mirrors exist, so its counts are its own. */
do $$
declare v jsonb;
begin
  v := public.fold_old_mutes();
  raise notice '0145 fold_old_mutes: %', v;
end $$;

/* ── The mirrors ── */

create or replace function public.mute_mirror_from_person()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'mute' then
      insert into public.dm_muted (profile_id, request_id)
      select new.blocker_id, r.id
        from public.dm_requests r
       where least(r.requester_id, r.recipient_id) = least(new.blocker_id, new.blocked_id)
         and greatest(r.requester_id, r.recipient_id) = greatest(new.blocker_id, new.blocked_id)
      on conflict do nothing;
    end if;
    return new;
  end if;

  if old.kind = 'mute' then
    delete from public.dm_muted m
     using public.dm_requests r
     where m.profile_id = old.blocker_id
       and m.request_id = r.id
       and least(r.requester_id, r.recipient_id) = least(old.blocker_id, old.blocked_id)
       and greatest(r.requester_id, r.recipient_id) = greatest(old.blocker_id, old.blocked_id);
  end if;
  return old;
end;
$function$;

create or replace function public.mute_mirror_from_chat()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_other uuid;
begin
  if tg_op = 'INSERT' then
    select case when requester_id = new.profile_id then recipient_id else requester_id end
      into v_other from public.dm_requests where id = new.request_id;
    if v_other is not null then
      insert into public.user_blocks (blocker_id, blocked_id, kind)
      values (new.profile_id, v_other, 'mute')
      on conflict do nothing;
    end if;
    return new;
  end if;

  -- A conversation being deleted cascades here; its parent row is already
  -- gone, so this finds no other person and unmutes no one.
  select case when requester_id = old.profile_id then recipient_id else requester_id end
    into v_other from public.dm_requests where id = old.request_id;
  if v_other is not null then
    delete from public.user_blocks
     where blocker_id = old.profile_id and blocked_id = v_other and kind = 'mute';
  end if;
  return old;
end;
$function$;

create or replace function public.mute_mirror_on_new_chat()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into public.dm_muted (profile_id, request_id)
  select b.blocker_id, new.id
    from public.user_blocks b
   where b.kind = 'mute'
     and ((b.blocker_id = new.requester_id and b.blocked_id = new.recipient_id)
       or (b.blocker_id = new.recipient_id and b.blocked_id = new.requester_id))
  on conflict do nothing;
  return new;
end;
$function$;

revoke all on function public.mute_mirror_from_person() from public, anon, authenticated;
revoke all on function public.mute_mirror_from_chat() from public, anon, authenticated;
revoke all on function public.mute_mirror_on_new_chat() from public, anon, authenticated;

drop trigger if exists mute_mirror_from_person on public.user_blocks;
create trigger mute_mirror_from_person
  after insert or delete on public.user_blocks
  for each row execute function public.mute_mirror_from_person();

drop trigger if exists mute_mirror_from_chat on public.dm_muted;
create trigger mute_mirror_from_chat
  after insert or delete on public.dm_muted
  for each row execute function public.mute_mirror_from_chat();

drop trigger if exists mute_mirror_on_new_chat on public.dm_requests;
create trigger mute_mirror_on_new_chat
  after insert on public.dm_requests
  for each row execute function public.mute_mirror_on_new_chat();
