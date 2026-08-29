-- Setup/cleanup for tests/together.mjs (service role / MCP).
-- Wipes together-layer state for the test accounts and plants one
-- POISONED fixture: an accepted "friendship" between test-icon and
-- the PENDING buddy, inserted with service role (client RPCs refuse
-- to create it). Every 0029 surface must then OMIT that person —
-- the vetting gate under test.

with t as (
  select p.id, u.email from profiles p join auth.users u on u.id = p.id
  where u.email like 'test-%@saathban.dev'
),
d1 as (delete from friend_requests where requester_id in (select id from t) or recipient_id in (select id from t) returning 1),
d2 as (delete from riddle_touches where from_id in (select id from t) returning 1),
d3 as (delete from boasts where profile_id in (select id from t) returning 1),
d4 as (delete from code_tries where profile_id in (select id from t) returning 1),
d5 as (delete from game_sessions where game_key = 'snakes' and created_by in (select id from t) returning 1),
d6 as (delete from notifications where kind in ('game','social') and profile_id in (select id from t) returning 1),
d7 as (delete from puzzle_attempts where profile_id in (select id from t) returning 1)
select 1;

insert into friend_requests (requester_id, recipient_id, status, decided_at)
select i.id, b.id, 'accepted', now()
from (select p.id from profiles p join auth.users u on u.id = p.id where u.email = 'test-icon@saathban.dev') i,
     (select p.id from profiles p join auth.users u on u.id = p.id where u.email = 'test-buddy-pending@saathban.dev') b;
