/* ════════════════════════════════════════════════
   0168 — Courses and training is open, so it is not a "not yet open"
   section.

   Owner, 2026-09-13: "Courses and training" must not say it is coming
   soon — it has the Saathban course in it. The Grow page no longer offers
   "Tell me when this opens" for courses, so Pending must not be able to
   point at courses as a not-yet-open section either. Pending can point
   at a course, a survey, or one of the two sections that genuinely are
   not open yet: languages and earning.

   Checked before applying: 0 pending pointers at 'courses', so the new
   check validates against every existing row.

   skill_interest keeps 'courses'. The people who once asked to be told
   keep their row as demand history; nothing is deleted.
   ════════════════════════════════════════════════ */

alter table public.pending_items drop constraint if exists pending_items_skill_check;
alter table public.pending_items
  add constraint pending_items_skill_check check (skill in ('languages', 'earning'));
