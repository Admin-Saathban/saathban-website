-- 0029d — DM game attachments follow their game (games/community
-- lane; patch on 0027's column, found by the together-suite cleanup).
--
-- dm_messages.game_session_id was ON DELETE SET NULL, but a message
-- whose body is null and whose game is gone violates the
-- body-or-game check — deleting any game session with an embed threw.
-- The embed message is meaningless without its game: cascade.

alter table public.dm_messages
  drop constraint dm_messages_game_session_id_fkey;
alter table public.dm_messages
  add constraint dm_messages_game_session_id_fkey
  foreign key (game_session_id) references public.game_sessions (id) on delete cascade;
