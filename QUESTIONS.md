# Open product questions

Decisions a lane needed but SPEC.md doesn't settle. Each entry records
the conservative choice taken in code so nothing here blocks a build —
answering a question may simply change a default.

## Events + Calendar (events lane, 2026-08-29)

1. **Can Fam members RSVP on an Icon's behalf?** SPEC says Fam "can see
   events so they can bring their parent" but only Icons are attendees.
   *Taken:* RSVP is Saath-Icon-only (enforced in `rsvp_to_event()`); the
   Fam view shows "family are welcome alongside — no sign-up needed".
2. **Should the marketing site's events (src/shared/eventsData.js) ever
   take RSVPs?** They are content, not rows, and some are past.
   *Taken:* shown in the merged list with a "From saathban.com" pill,
   display-only. If an announced event needs RSVPs, an admin recreates it
   in Manage.
3. **Does the personal calendar belong to Icons only?** SPEC places it
   under the Icon home.
   *Taken:* the My calendar tab renders for Icons only; the
   `calendar_entries` table itself is role-neutral (owner-only RLS), so
   widening later is a UI change, not a migration.
4. **Who performs at-event check-in?** SPEC names the feature but not the
   hand.
   *Taken:* admins, via the Manage tab's door list (`checked_in_at`).
   Self-check-in or Buddy-assisted check-in would need its own policy.
5. **Event capacity semantics when someone cancels:** freed place is
   first-come (no waitlist). *Taken:* no waitlist in v1.

---

# Integration questions (overnight session)

Decisions the overnight integration could not make alone. Each has a
recommendation; none blocks the current preview.

## 1. iconPrefs are device-local and account-agnostic
Module choices, medicine list, meals, and custom trackers live in one
localStorage key shared by every account on the device. On a shared
event device, one person's medicine list would show for the next
sign-in — and nothing follows an Icon to a second device.
**Recommend:** key by profile id now (as logStore already does), sync
via `profiles.settings` in a later step.

## 2. Test-account password convention
`test-*@saathban.dev` all use `SaathTest!2026`. Twice during the day a
lane's testing changed test-icon's password and broke every other
lane's tests until reset. **Recommend:** these four accounts are
never used for password-reset testing; create a dedicated
`test-reset@saathban.dev` for that.

## 3. Custom SMTP (Resend) before any real onboarding
The built-in email service is ~2 emails/hour and dev-only; the first
event signup session will hit the wall immediately. Plan is written
(Resend free tier: domain DNS, SMTP creds into Supabase, raise rate
limits, bilingual templates) — needs someone with DNS access.
**Recommend:** do this before the first field test.

## 4. Urdu native review
All ur.js strings are drafted (aap-register, per SPEC voice) but
marked pending native review. The named Urdu owner needs a pass
before launch. Vetting/fam/circle lane copy is still English-only in
their local copy files, awaiting extraction.

## 5. Rest day is session-only
The Icon home's rest-day toggle is UI state, not a daily_logs module —
it doesn't survive a reload and Fam can't see it. Needs a schema home
(0006 has no module for it). **Recommend:** small migration adding a
`rest_day` module or a column on the day.

## 6. Moderation queue is still mock
No reports table until Community lands (build step 11). The admin
UI's Moderation tab works against MOCK_REPORTS with the real actions
disabled.

---

# Skills / Notifications / Profile lanes (overnight session)

Conservative calls made building `routes/skills/`, `routes/notifications/`,
`routes/profile/` + migration `0012_skill_interest`. Each was resolved so the
work is complete and safe; these are the calls a reviewer may want to change.

## S1. Unread badge lives in a shared file (AppHeader)
The badge was asked for "in AppHeader", but `components/AppHeader.jsx` belongs to
the header lane and I stage only my own paths. *Taken:* shipped
`routes/notifications/NotificationsBell.jsx` (self-contained, refreshes on focus
and on a `sb:notifications-read` event) plus a two-line integration snippet in
`NOTIFICATIONS_WIRING.md`. **Question:** should the header lane add
`<NotificationsBell/>`, or should I edit AppHeader directly in a follow-up?

## S2. Strings are local, not in central locales/
Those files are shared and carried another lane's uncommitted changes, so editing
them would force staging work that isn't mine. *Taken:* each lane keeps a local
bilingual `strings.js` (English + Urdu **draft**) consumed via the shared
`useI18n()`. **Recommend:** fold into `locales/*` under `skills.*` /
`notifications.*` / `profile.*` when convenient — and the Urdu needs the same
native review as #4 above.

## S3. Skills admin counts page location
Put at `/app/skills/admin`, self-guarded to admins and backed by an admin-only
RPC. **Alternative:** move under the admin lane (`/app/admin/skills`) so staff
tools sit together.

## S4. Who may express skill interest
Allowed **any signed-in role** (interest is a demand signal; RLS ties each row to
the person). SPEC lists Skills under the Icon home — tighten the route guard to
`roles={["saath_icon"]}` if it should be Icon-only.

## S5. Notifications: mark-read only, no user delete
Shipped mark-one / mark-all read. The table's RLS also allows self-delete, but no
"clear/remove" affordance was added. Add one if wanted.

## S6. I reset test-icon's password, against convention #2 above
Before finding this file's #2, an earlier lane task of mine reset test-icon to a
different password for a browser test (it had already churned via GoTrue's
rehash-on-login). Per #2, the fix is a dedicated `test-reset@saathban.dev`; the
four shared accounts should be restored to `SaathTest!2026` and left alone. I did
not re-reset it this session (the write is now permission-gated).

---

# Community v1 (community lane, overnight 2026-08-29)

Conservative readings encoded in migration 0014 and routes/community/;
answering any of these changes a policy or a prop, not the schema.

## C1. Do Saath-Buddies see the community before they are active?
SPEC gives Buddies "no access to any Icon data" before `active`, and the
feed is Icon-authored content. *Taken:* community access requires an
ACTIVE application (`can_use_community()`); pending/interviewing Buddies
land on their vetting status instead.

## C2. Can Fam and Buddies comment?
SPEC: "Icons post; everyone else reads." The build brief asked for
comments but not who may write them. *Taken:* comments follow the posting
rule — Icons + the org account write, everyone else reads. Widening this
is a one-line policy change (`can_use_community()` instead of
`can_post_community()` on the comments insert policy).

## C3. Reactions from readers
Strictly, "everyone else reads." *Taken:* any community reader may leave
one reaction (👍 ❤️ 🌸 🤲) — non-verbal, no text surface, revocable.

## C4. Who can send DM requests, and to whom?
SPEC describes request-gating but not eligibility. *Taken:* any community
member (per C1) can request anyone; 5 outgoing requests per 24h (RPC).
A request to someone who blocked the sender is stored but never shown —
the sender cannot probe blocks.

## C5. Reported DMs vs. DM privacy
Admins must moderate reported DMs, but DMs are participants-only at the
database level. *Taken:* the report row carries a `target_excerpt`
snapshot taken by the reporter's client; admins act on the snapshot and
have NO read path into threads. A disputed snapshot needs a super-admin
decision on whether a break-glass-style DM read should ever exist.

## C6. Money-talk detection is client-side and English/Urdu keyword based
The warning banner to the recipient fires on a keyword list (Rs, rupees,
easypaisa, jazzcash, bank, پیسے, رقم, بینک…). It is deliberately
over-broad and advisory only; nothing is blocked and nothing is logged.
A server-side pattern (or none at all) is a product call.

## C7. Deleted posts leave their images in the public bucket
Clients cannot delete from community-images (posters upload only).
Orphan cleanup needs a service-role job; images are public by design so
this is a cost/tidiness question, not a privacy one.

## C8. Community strings are in routes/community/communityCopy.js
The locales files were out of scope for this lane tonight. The copy file
follows the famCopy convention (flat keys, ready to lift into en.js/ur.js
under community.* by the i18n lane).

---

# Milestones (milestones lane, 2026-08-29, migration 0017)

Conservative calls in the points → badges → celebrations loop; each is a
parameter or a policy, not a schema change.

## M1. Streak forgiveness parameters
SPEC mandates forgiveness but not numbers. *Taken:* the current streak
bridges any single missing day (a two-day hole ends it); presence badges
use windows (7 present days in any 8, 30 in any 33); the 100-day arc is
**lifetime** presence days and never resets. All tunable in
`compute_badge_awards()` / `my_progress()`.

## M2. Rest day got its schema home (answers #5 above)
`rest_day` was added to the `log_module` enum in 0017: one private
daily_logs row marks the day, and presence, points, and streaks all count
it (resting IS participation). The Icon home still needs to write it —
home lane's adoption, one insert where the toggle flips.

## M3. Who has milestones?
Badges compute for anyone with rows, but the screen renders for Icons
(admins get the message desk on the same route). Buddy/Fam milestone
loops would need their own badge set — nothing here assumes one.

## M4. The 100-day video message
SPEC's "100-day shoutout with optional video message" is deferred with
SOS-era media questions; 0017's `presence_100` badge is the arc's marker
and the admin's personalised note is the human moment meanwhile.

## M5. first_outing has no trigger on the outdoor lane's table
It computes dynamically against `outdoor_checkins` (0016) on any award
pass, so the badge lands on the next log/post/screen-visit after a
check-in rather than the instant of it. An AFTER INSERT trigger there is
a one-liner for whoever owns 0016, if instant matters.

## M6. Urdu badge content pending native review
Badge names/descriptions ship as data in both languages (0017 seed),
drafted aap-register like the locales files — same native review queue
as #4 above.


---

# Outdoor v1 (outdoor lane, 2026-08-29)

Conservative readings encoded in migration 0016 and routes/outdoor/.

## O1. "Connections" = circle members
SPEC's check-in default is "connections only" but the only explicit
grant system today is My Circle. *Taken:* a connections-visibility
check-in or outing is visible to the Icon's circle members (who also
pass the community gate). When a friends/connections system lands,
`member_of_circle()` in the read policies is the one thing to widen.

## O2. Vetting outranks a circle grant
An Icon can add a not-yet-active Buddy to their circle; SPEC still says
no Icon data before `active`. *Taken:* everything outdoors sits behind
`can_use_community()` first — a pending Buddy in a circle sees nothing.

## O3. No admin bypass on presence
Check-ins are location-adjacent. *Taken:* admins get no special read
on outdoor_checkins — they see board-announced presence like any
community member and circle presence only if they are in the circle.
(Boards ARE admin-visible: they moderate them.)

## O4. Park boards are open chat for every community member
"An open chat per place." *Taken:* any community member writes (Icons,
Fam, active Buddies, org) — unlike the community feed's Icons-post
rule. Report + block are one tap on every message; board reports land
in community_reports as target_kind 'park_board'.

## O5. Who checks in and plans outings: Icons only
Presence and outings are Icon activities ("show first name" of the
person out and about). *Taken:* outdoor_check_in() and the outings
insert policy are Icon-only; widening to Buddies-on-visits is a later
product call.

## O6. Expired presence is history, so it's gone
"No history of who was where." *Taken:* expired or ended check-ins are
invisible to everyone but their owner at the database level. The
owner keeps their own record (their data); nothing aggregates it.

## O7. Moderation queue shows 'park_board' via fallback label
The admin ModerationQueue's KIND_LABEL map predates this lane and
renders unknown kinds raw; board reports appear as "park_board" and
have no Hide-content button (the admin update policy exists — the
button is a one-line addition for the admin lane).

## O8. Seed coordinates are approximate
Good enough for a later distance sort; invisible in the v1 list UI.
An admin place-editor or verified coordinates arrive with the map step.

## O9. New fixture: test-buddy-pending@saathban.dev
test-buddy's pipeline status is churned by the vetting lane's tests,
so outdoor's vetting-gate negatives use a dedicated pending account
(same shared password convention). tests/outdoor.mjs asserts
test-buddy's behaviour CONSISTENT with whatever standing it currently
has, instead of pinning it.

## O10. Outdoor strings are in routes/outdoor/outdoorCopy.js
Same as C8: ready for the i18n lift under outdoor.*.


---

# People / circle DMs (people lane, 2026-08-29, migration 0019)

## P1. Circle membership revives a declined DM request
open_dm_with() auto-accepts any existing pending OR declined request
between circle-linked accounts, reading the circle grant (the Icon
added this person by hand) as newer and stronger consent than an old
decline. Blocks are unaffected - dm_open() refuses blocked pairs
regardless of status. If a decline should survive circling up, the
auto-accept needs a status guard.

## P2. Leaving a circle does not close the thread
Removal from a circle (one tap, no notification) leaves the accepted
DM thread open - relationships outlive the grant, and closing it
would broadcast the removal. The door that closes a thread is a
block, which either side can do from the community surfaces.

## P3. Circle DMs skip the community gate
send_dm_request() requires can_use_community(); open_dm_with() for a
circle pair deliberately does not, so an Icon-Fam pair can message
even where community access rules would say no. Trust granted by hand
outranks the community gate - flag if that reading is wrong.

## Games platform + Daily Riddle (games lane, 2026-08-29)

1. **What language are game notifications in?** Notification rows store
   literal text; the platform has no per-user language column yet, and
   every existing notification kind is English-only.
   *Taken:* game notifications (invite, table ready, your turn, game
   over) are English, matching the platform. When notifications gain
   localization, `game_notify()` is the single place to change.
2. **Who may open or claim a game table?** SPEC gives games no explicit
   audience.
   *Taken:* anyone `can_use_community()` (the community read gate) can
   create, be invited, and claim open seats — games are social
   furniture, not Icon-only. Open-table *posts* still require
   `can_post_community()` (Icons + org), like every community post.
3. **Do lapsed turns ever forfeit a game?** SPEC is silent; the brief
   says never.
   *Taken:* never — 3 consecutive misses flip the seat to 'away' and
   the bot continues indefinitely; the person reclaims any time.
   A stale active game simply finishes bot-vs-bot via the cron sweep.
4. **Is the Daily Riddle's guess count public?** Sharing "solved in N"
   is mild performance data.
   *Taken:* sharing is opt-in per day via an explicit button, payload
   carries only {date, guesses}, never the answer; nothing is shared
   by default and history shows solved days only (no gaps, no streaks
   broken — streak-forgiving by construction).
5. **Puzzle day boundary:** server `current_date` (UTC), not the
   device's local midnight — everyone in Pakistan sees the same riddle
   with a 5-hour-early rollover.
   *Taken:* acceptable for v1; a `Asia/Karachi` boundary would need
   `current_date at time zone` changes in policy + RPC, one file.

---
## Community social (games/community lane, 2026-08-29, migration 0027)

1. **Does an activity's people limit include the host?** "Limit 4" for
   a ludo table naturally means four at the table.
   *Taken:* yes — the RPC closes joins at limit−1 joiners. Shown as a
   plain count of who's coming; never "2 places left" pressure.
2. **What happens to a request after a decline?** Re-requesting could
   become pestering.
   *Taken:* the pair stays declined and re-sends are silent no-ops —
   the sender still sees "request sent" (same stance as blocks). A
   fresh start requires the DECLINER to send a request the other way.
3. **Mutual pending requests (A asks B while B has asked A):** could
   auto-accept.
   *Taken:* no auto-accept — the existing incoming request is left for
   an explicit yes. One tap either way, no surprises.
4. **Who can send/receive connection requests?** The button says
   Saath-Icons and search returns Icons only, but the rails gate is
   `can_use_community()` both sides.
   *Taken:* any community member may send (a Fam member can ask to
   connect with an Icon); the discovery UI searches Icons only.
5. **Do activity joins still write park-board outings?** Walks used
   to create the joiner's own outing row.
   *Taken:* joins are tracked in post_joins; when the activity has a
   place AND time and the joiner is an Icon, the outing row is also
   written best-effort so park boards keep their "going" counts.
6. **DM game embeds:** only a session the sender participates in may
   be attached (insert policy); the embed renders carrom's board —
   other games get a link card until they ship an inline view.

---
## The together layer (games/community lane, 2026-08-29, 0029 series)

1. **Can a host re-invite someone who declined?** Not for that table —
   the declined invite stands and re-invites are silent no-ops (the
   anti-pestering stance requests use everywhere). A fresh table is a
   fresh ask.
2. **May you nudge before solving the riddle yourself?** No — the
   strip only exists post-solve, and the server enforces it, keeping
   the pre-solve veil airtight (no contacting a solved friend to fish
   for the answer; person_warmth got the same veil in 0029b).
3. **What counts as "connected" for games now?** Circle ∪ accepted
   friends ∪ fellow group members — one definition (connections_of),
   widened at the plug point 0025 documented.
4. **Code-guess rate limit:** 12 tries per 5 minutes per account,
   server-side; wrong, expired, and finished codes are one identical
   kind answer.
5. **Boast wording is English** (platform notification convention);
   the badge boast deep-links to the booster's people-profile.

---

## Circle defaults (circle lane, 2026-08-29)

1. **Family circles now default OPEN** — a new membership arrives with
   mood/daily-logs, health, reminders and the SOS slot on; location
   alone stays `never`. User-directed decision, recorded in SPEC.md
   §My Circle with the four guarantees that keep it honest (one warm
   acceptance screen, one review notification deep-linking to that
   member, the unchanged granular editor, and no migration of existing
   rows). Migration 0037 contains no UPDATE over `circle_members`.
2. **Open question — assisted signup.** SPEC says assisted signup is
   first-class: a Fam member or staffer creates the account at an
   event using the Icon's own email. That same person may therefore be
   the one tapping "Okay" on the acceptance screen, granting
   themselves health access. The Icon is notified and the review
   screen is one tap away, but if assisted signup becomes the dominant
   path this wants revisiting — perhaps defaults stay open only when
   the Icon's session is the one that approves.
3. **Quiet-days notice is built but not scheduled.** The per-member
   toggle (off by default, Icon-controlled) and the sender
   `notify_quiet_days(p_days)` both exist; nothing calls it yet.
   Wiring it to a schedule is a product decision — how many quiet days
   before a note, and whether staff outreach should see the same
   signal first.
