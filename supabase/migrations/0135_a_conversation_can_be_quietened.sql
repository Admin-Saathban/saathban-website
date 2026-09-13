/* ═══════════════════════════════════════════════════════════════
   0135 — a conversation can be quietened, and a conversation can be reported

   MUTE, PER CONVERSATION. The Messages rework puts Block, Mute and Report
   together in every thread's menu. user_blocks already has a 'mute' kind,
   and it was NOT reusable for this:

     · caller_hides() counts ANY user_blocks row, so a 'mute' hides the
       person's posts from my feed and hides their requests to me — a
       feed "show less", not a chat setting;
     · open_dm_with() refuses to open a thread when caller_hides() is true,
       so a person-mute CLOSES the chat instead of keeping it readable;
     · notify_dm_message() never consulted user_blocks at all, so a 'mute'
       did not stop a single message notification.

   So Mute here is its own row, keyed by conversation, the same shape as
   dm_archived (0076): one person, one thread, private to them. It stops
   the bell notification for new messages in that thread and nothing
   else — the chat stays in Chats, readable and writable, and the other
   person is not told. Removing the row turns notifications back on.

   REPORTING A CONVERSATION OR A REQUEST. community_reports.target_kind
   never allowed 'dm_request', so the Report control on a message request
   has been failing at the insert since it was written. Widened here with
   'dm_request' (target_id = dm_requests.id) and 'dm_conversation'
   (target_id = dm_requests.id of an accepted thread). Existing kinds are
   carried over unchanged.
   ═══════════════════════════════════════════════════════════════ */

create table if not exists public.dm_muted (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null references public.dm_requests(id) on delete cascade,
  muted_at   timestamptz not null default now(),
  primary key (profile_id, request_id)
);

alter table public.dm_muted enable row level security;

drop policy if exists "muted: mine only" on public.dm_muted;
create policy "muted: mine only" on public.dm_muted
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.is_dm_participant(request_id));

revoke all on public.dm_muted from anon;
grant select, insert, delete on public.dm_muted to authenticated;

create or replace function public.notify_dm_message()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_other uuid;
  v_first text;
  v_link  text;
begin
  select case when requester_id = new.sender_id then recipient_id
              else requester_id end
    into v_other
    from public.dm_requests where id = new.request_id;
  if v_other is null then
    return new;
  end if;

  -- 0135: the reader muted this conversation. The message still lands;
  -- only the bell stays quiet.
  if exists (
    select 1 from public.dm_muted
    where profile_id = v_other and request_id = new.request_id
  ) then
    return new;
  end if;

  v_link := '/app/people/' || new.sender_id || '/chat';

  if exists (
    select 1 from public.notifications
    where profile_id = v_other and kind = 'dm'
      and link = v_link and read_at is null
  ) then
    return new;
  end if;

  select split_part(coalesce(full_name, ''), ' ', 1)
    into v_first from public.profiles where id = new.sender_id;

  insert into public.notifications (profile_id, title, body, kind, link, created_by)
  values (
    v_other,
    '💬 ' || coalesce(nullif(v_first, ''), 'Someone') || ' sent you a message',
    null,
    'dm',
    v_link,
    new.sender_id
  );
  return new;
end;
$function$;

alter table public.community_reports
  drop constraint if exists community_reports_target_kind_check;
alter table public.community_reports
  add constraint community_reports_target_kind_check
  check (target_kind = any (array[
    'post', 'comment', 'dm_message', 'park_board', 'group', 'group_post',
    'place_access', 'game_player', 'dm_request', 'dm_conversation'
  ]));
