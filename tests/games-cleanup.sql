-- Cleanup for tests/games.mjs (service role / MCP execute_sql).
-- The suite prints the session ids it created; sessions cascade to
-- seats, moves, invites, and chat. Generic form — removes every
-- snakes test session between the test accounts, their game
-- notifications, and their riddle attempts.

delete from game_sessions
where game_key = 'snakes'
  and created_by in (
    select p.id from profiles p
    join auth.users u on u.id = p.id
    where u.email like 'test-%@saathban.dev'
  );

delete from notifications
where kind = 'game'
  and profile_id in (
    select p.id from profiles p
    join auth.users u on u.id = p.id
    where u.email like 'test-%@saathban.dev'
  );

delete from puzzle_attempts
where profile_id in (
    select p.id from profiles p
    join auth.users u on u.id = p.id
    where u.email like 'test-%@saathban.dev'
  );

-- Open-table test posts are deleted by the suite itself; sweep any
-- strays (empty-bodied game_open posts by test accounts).
delete from community_posts
where post_type = 'game_open'
  and author_id in (
    select p.id from profiles p
    join auth.users u on u.id = p.id
    where u.email like 'test-%@saathban.dev'
  );
