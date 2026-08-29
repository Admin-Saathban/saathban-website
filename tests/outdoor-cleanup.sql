-- Removes rows left by tests/outdoor.mjs (run as service role, e.g.
-- the Supabase SQL editor). Safe to run repeatedly.

delete from community_reports
  where target_kind = 'park_board' and reason like 'suite:%';
delete from park_board_messages where body like '[outdoor%';
delete from outdoor_outings where note like '[outdoor%';
delete from outdoor_checkins
  where profile_id in (select id from auth.users where email like 'test-%@saathban.dev');
