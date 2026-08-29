# Points — how they accrue, and why they cannot be farmed

Audit of every source, the rules as they now stand, and where they are
enforced. Migrations: `0017_milestones.sql` (original), `0039_points_hardening.sql`
(the rules below).

## The one-sentence answer

**Points are derived, never stored.** There is no points column and no points
table anywhere in the schema; `my_progress()` computes them from `daily_logs`
rows. That is why there is no client-writable points path to close — there is
nothing to write.

## Every source, audited

| Source | Points | Where enforced |
|---|---|---|
| Daily-log module (mood, sleep, medication, exercise, diet, water, blood_pressure, blood_sugar, weight, pain) | 10 each, **once per module per day** | `unique (icon_id, log_date, module)` on `daily_logs` (0006) |
| Rest day | 10, once per day — resting **is** presence | same key; `rest_day` is a log module (0017) |
| Custom trackers | **10 flat per day**, however many trackers and however many taps | the new `tracker` module (0039) + the same unique key |
| Daily Riddle | **none** | by design (0029 comment: "no points, no streak numbers") |
| Community posts | **none** | nothing in 0014/0018 grants points |
| Games (any result) | **none** | nothing in 0020/0022/0029 grants points |
| Outdoor check-ins | **none** | nothing in 0016 grants points |

Sources that award nothing still matter — they earn **badges** (first post,
first outing), which is a different currency entirely.

## The rules

1. **One award per source per day.** Guaranteed by the unique key, not by
   client behaviour: a second row for the same (person, day, module) cannot
   exist, so a second award cannot happen.
2. **Custom trackers are flat.** Ten a day whether you keep one tracker or
   nine, whether you tap once or forty times. Trackers are device-local; the
   client summarises the day into a single `tracker` row, and the unique key
   means it can never become more than one.
3. **A daily cap.** `points_daily_cap()` = **60**, applied per day before the
   days are summed. Before 0039 a day was worth `10 × (rows that day)` with no
   ceiling, so the maximum silently rose every time someone added a log
   module. The cap fixes the ceiling in one place.
4. **Every source is worth the same.** `points_per_source()` = 10. Logging a
   heavy day scores exactly what logging a bright one does (SPEC.md:
   participation, never performance).
5. **The 48-hour backfill does not multiply anything.** Backfilled rows land
   on the day they belong to, and that day is capped like any other.

## Badges do not come from points

`compute_badge_awards()` reads **presence days** and firsts, never a points
total:

- `presence_7` / `presence_30` / `presence_100` — counts of **distinct
  log_date**, so seven badges need seven different days;
- `return_after_absence` — a gap between two distinct dates;
- `first_log`, `first_note`, `first_rest_day`, `first_post`, `first_outing` —
  firsts.

**So farming a single day earns nothing that matters.** A person who logs
every module every hour of one day gets one capped day of points, the same
presence day as someone who logged once, and no badge they would not otherwise
have had. This is the property worth protecting: it is why the scoreboard can
never be gamed into meaning something about a person.

## What the client may and may not do

- The client **reads** `my_progress()` (now also `points_today` and
  `daily_cap`, so a screen can show today honestly without re-deriving the
  rule).
- The client **cannot write points**, because points are not written.
- The client **can** insert its own `daily_logs` rows — under RLS
  (`icon_id = auth.uid()`, Icon role, account in good standing) and the 0006
  window trigger (nothing dated in the future, nothing older than 48 hours).
  That is the only input to the whole system.

## Known divergence, and who owns it

The home screen's "today" figure is computed **client-side** as
`entries_done × 10`, counting custom trackers as separate entries. The server
counts one flat tracker award and applies the daily cap, so a person with
several trackers can see a today-figure higher than the server will ever
credit.

Closing it needs two small changes in the daily-log lane's files
(`routes/home/logStore.js`, `IconHome.jsx`, `ScoreShare.jsx`, `IconHub.jsx`):
write **one** `module='tracker'` row per day rather than keeping tracker taps
device-local, and render `points_today` from `my_progress()` instead of
recomputing. The server rule is already correct and already capped — this is a
display honesty fix, not a hole. Flagged to that lane rather than reached into.

## Verified by attempting to farm

Run as `test-icon` directly against the database (see the audit run in the
commit): repeated inserts for the same module and day are refused by the
unique key; a day stuffed with every module is capped at 60; many tracker taps
remain one row and one award; a future-dated or three-day-old row is refused
by the window trigger; writing another person's logs is refused by RLS; and no
sequence of any of these moves a badge, because badges count distinct days.
