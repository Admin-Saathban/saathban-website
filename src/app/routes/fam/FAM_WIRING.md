# Fam lane — wiring notes

> **Status: WIRED to Supabase.** `/app/fam/*` is registered in `AppRoot.jsx`
> behind `RequireAuth roles={["family_member"]}`, and every screen now reads
> and writes real data through `src/app/lib/circle.js` (migrations 0005 +
> 0011). `famMock.js` is gone; the lane's copy lives in `famCopy.js`.

## Data layer

All Supabase access goes through `src/app/lib/circle.js`. (The Icon-side
Circle page lives in `routes/circle/` — the circle lane's own folder with
its own store — and is linked from Settings; `circle.js` keeps its
icon-side helpers available for whoever consolidates the two later.)

- **Dashboard** — `circle_members` rows where this account is the member,
  joined with each Icon's `safe_profiles` row, plus today's `daily_logs`
  per Icon. RLS trims the log rows to exactly what the Icon granted
  (`can_see_mood` → mood/sleep/exercise/diet/water, `can_see_health` →
  medication and the vitals); the membership row's booleans drive the
  privacy lines, the rows themselves drive the content. Pending join
  requests come from `circle_invites` (own, `member_to_icon`, unredeemed).
- **Connect flow** — `request_to_join_circle(email)` (the answer shown is
  ALWAYS "request sent" — decision #6, no email probing) and
  `accept_circle_invite(code)`, which connects immediately and returns to
  the dashboard. Invite codes are *generated* on the Icon's side only.
- **Reminders** — the `reminders` table (migration 0011). Read/insert/
  update/delete allowed to the Icon and to circle members holding
  `can_manage_reminders`, enforced by RLS live — revoking the grant cuts
  access mid-session. The screen re-checks the membership row and bounces
  to the dashboard without the grant; the button never rendered anyway.

## Strings → locales

All copy sits in `famCopy.js` (`COPY` + `MOOD_BY_VALUE`), still a one-file
Urdu extraction under a `fam.*` namespace. Several strings are functions
(interpolations); they become `{name}`-style templates on extraction.

## Deliberate UI decisions (kept through the rewire)

- An Icon who granted nothing beyond the default shows privacy lines, not
  locked-state teasers; the reminders button is **absent**, never disabled.
- "Nothing logged yet today" copy is a fact, never an alarm.
- The pending-request card names only the email the requester typed —
  never whether it matched an account.
- Reminder deletion is one tap, no confirmation maze.
- Digit groups (code entry) are pinned `dir="ltr"` under Urdu.
