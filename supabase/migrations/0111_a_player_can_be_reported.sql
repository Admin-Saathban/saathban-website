-- ════════════════════════════════════════════════
-- Reporting a player from the table.
--
-- Every profile card at a ludo table carries a "Report to Saathban"
-- row. Reports already have one queue and one workflow — admins watch
-- community_reports and nothing else — so a game report is a
-- community_reports row like the rest, and the only thing standing in
-- its way was the target_kind check constraint.
--
-- target_id is "<session id>:<profile id>", which is what an admin
-- needs in order to find the table AND the person: a report that
-- named only the person would leave a moderator with no idea what
-- happened, and one that named only the table would leave them with
-- four people and no complaint.
--
-- target_author_id IS the reported player, so the existing per-person
-- history an admin builds up works for this exactly as it does for a
-- post. The three MUTES on the same card are deliberately not here:
-- they are local, private and reversible (tableMutes.js), and writing
-- "X muted Y" into a row anybody could read is the opposite of what
-- makes them safe to use.
-- ════════════════════════════════════════════════

alter table public.community_reports
  drop constraint if exists community_reports_target_kind_check;
alter table public.community_reports
  add constraint community_reports_target_kind_check check (
    target_kind in (
      'post', 'comment', 'dm_message', 'park_board',
      'group', 'group_post', 'place_access', 'game_player'
    )
  );
