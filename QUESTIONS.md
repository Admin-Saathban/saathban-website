# Open questions for the team

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
