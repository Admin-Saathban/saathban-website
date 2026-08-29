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

