-- Removes rows left by tests/community-shares.mjs (run as service
-- role). Safe to run repeatedly.

delete from community_posts
  where post_type <> 'text' and payload::text like '%[shares%';
delete from outdoor_outings
  where creator_id in (select id from auth.users where email like 'test-%@saathban.dev');
delete from event_rsvps
  where event_id in (select id from events where title like '[shares%');
delete from events where title like '[shares%';
