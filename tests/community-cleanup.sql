-- Removes rows left by tests/community.mjs (run as service role, e.g.
-- the Supabase SQL editor). Safe to run repeatedly.
--
-- Storage note: the suite also uploads <icon-uid>/suite.png to the
-- community-images bucket. Supabase blocks SQL deletes on
-- storage.objects; remove it from Dashboard → Storage if it bothers
-- anyone (it is a 1-pixel PNG).

delete from community_reports
  where reason like 'suite:%' or target_excerpt like '[suite%';
delete from post_comments where body like '[suite%';
delete from community_posts where body like '[suite%';
delete from dm_messages where body like '[suite%';
delete from dm_requests r
  where not exists (select 1 from dm_messages m where m.request_id = r.id)
    and r.requester_id in (select id from auth.users where email like 'test-%@saathban.dev')
    and r.recipient_id in (select id from auth.users where email like 'test-%@saathban.dev');
