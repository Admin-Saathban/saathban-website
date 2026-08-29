-- Cleanup for tests/community-social.mjs (service role / MCP).
-- Run BETWEEN runs — the suite assumes no friend_requests exist
-- among the test accounts.

with t as (
  select p.id from profiles p join auth.users u on u.id = p.id
  where u.email like 'test-%@saathban.dev'
)
delete from friend_requests
where requester_id in (select id from t) or recipient_id in (select id from t);

with t as (
  select p.id from profiles p join auth.users u on u.id = p.id
  where u.email like 'test-%@saathban.dev'
)
delete from community_posts
where post_type = 'activity' and author_id in (select id from t);

-- post_joins cascade with their posts.

with t as (
  select p.id from profiles p join auth.users u on u.id = p.id
  where u.email like 'test-%@saathban.dev'
)
delete from notifications
where kind = 'social' and profile_id in (select id from t);

-- Game sessions created for the DM-attachment checks (attachments
-- null out via ON DELETE SET NULL; the messages then violate nothing
-- because body-or-game is checked at INSERT, so remove them first).
with t as (
  select p.id from profiles p join auth.users u on u.id = p.id
  where u.email like 'test-%@saathban.dev'
)
delete from dm_messages
where body is null and sender_id in (select id from t);

with t as (
  select p.id from profiles p join auth.users u on u.id = p.id
  where u.email like 'test-%@saathban.dev'
)
delete from game_sessions
where game_key = 'snakes' and created_by in (select id from t);
