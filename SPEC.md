# Saathban App — Specification

Append this to CLAUDE.md. It is the source of truth for the authenticated app.

---

## What this is

Saathban combats elderly loneliness in Pakistan through intergenerational
community. This app is the digital side of that work.

The existing marketing site lives at `/` and must not be disturbed.
The app lives at `/app` behind authentication.

## Voice and principles

These are not decoration. They constrain real decisions.

- **Never patronise.** Seniors are the honoured users, not the cared-for
  subjects. No "elderly", no "user", no clinical framing anywhere in the UI.
- **Never assume an audience.** Many Icons live alone. No screen may imply a
  gap where family should be. Empty states are doors, not scoreboards.
- **Privacy over convenience.** An Icon's private logs belong to the Icon.
  Sharing is opt-in, per person, per data type.
- **Accessibility is a hard requirement**, not a later pass. Minimum 18px body
  text, 48px tap targets, high contrast, no dependence on colour alone.

---

## Roles

| Role | DB value | Who | Signup |
|---|---|---|---|
| Saath-Icon | `saath_icon` | Seniors, the primary users | Self or assisted |
| Saath-Buddy | `saath_buddy` | Volunteers | Self, then vetted |
| Saath-Fam | `family_member` | Children, relatives, caretakers | Self or invited |
| Admin | `admin` | Saathban team | Internal only, never self-select |

**Display names live in one constants file.** The database columns above never
change. `Saath-Fam` in particular is still under review — renaming it must be
a one-file edit.

**Tier is separate from role.** An Icon may be `free` or `subscribed`. Never
conflate the two fields.

---

## Auth

Email-based, via Supabase Auth. No SMS in v1 — Pakistani OTP short codes
require an NTN and a signed PTA authorisation form, which is a separate
workstream.

| Role | Method | Session |
|---|---|---|
| Saath-Icon | Magic link | 90 days, silent refresh, never auto-logout |
| Saath-Fam | Magic link or password | 30 days |
| Saath-Buddy | Email + password | 30 days |
| Admin | Email + password + 2FA | Short, re-auth for sensitive actions |

**A web app cannot read the inbox.** There is no true OTP autofill. The magic
link *is* the frictionless path — prefer it for Icons.

**Assisted signup** is a first-class path: a Fam member or Saathban staffer
creates the account at an event, entering the Icon's *own* email so the Icon
retains access. This is how most Icons will actually onboard.

**Recovery matters more than usual.** Build the admin path to manually verify
identity and move an account to a new email address. It will be needed.

---

## Signup flow

Role selection comes **first**, as large tappable cards with illustration and
one line of plain description. Not a dropdown. The fields differ by role, and
the choice must be legible without reading a paragraph.

Every onboarding screen carries a visible "this isn't me" exit.

### Saath-Icon
Minimal. Every extra field is a drop-off.

- Full name
- Email
- Phone
- Location — browser geolocation, reverse-geocoded, **always skippable**,
  always manually editable. Never the first thing shown.

Personality and interest modules come *after* the account exists, framed as
optional and skippable, never as a wall.

### Saath-Fam
Assume tech literacy — these are mostly adult children. Collect enough to
match and cater well.

- Name, email, phone
- Country, city (many are overseas — timezone matters for call reminders)
- Relationship to the Icon
- Languages spoken
- Connection: join an Icon's circle via invite, or invite an Icon who then
  approves with one tap

### Saath-Buddy
Long, deliberately. See vetting below.

---

## Saath-Buddy vetting

Volunteers are matched with isolated seniors. The bar is high.

**Identity (verified, not just collected):** legal name as on CNIC, CNIC
number, DOB, CNIC photo, selfie taken at signup. Minimum age 18.

**Profile:** occupation or institution, city and reachable areas, **languages
spoken** — this is the single most important matching field, not admin trivia.

**Motivation:** one open text box, free-form. Not multiple choice. This is the
field the reviewer reads first.

**Experience:** prior work with elderly people or caregiving. Expected weekly
hours and commitment length.

**References:** two, non-family, with phone numbers. *Actually call them.*
The collection is not the safeguard; the call is.

**Declarations, explicit checkboxes:** criminal record disclosure, consent to
police character certificate, agreement to a scrollable code of conduct — no
money ever changes hands with an Icon, no soliciting, no medical advice, no
photos without consent, contact stays in-app, concerns get reported.

### Status is a pipeline, not a boolean

```
pending → interviewing → probation → active → suspended → rejected
```

A Buddy has **no access to any Icon data** before `active`.

### Reviewer red flags (surface these in the admin UI)

- Asking to be matched with a specific named person
- Reluctance to provide ID or references
- Availability inconsistent with stated job or study
- Any early attempt to move contact off-platform

### Sensitive data handling

CNIC images and phone numbers are sensitive personal data. Private storage
bucket, restricted access, defined retention policy. **Never a public bucket.**
This is where a mistake is genuinely costly.

---

## My Circle

The Icon grants access. Nothing is presumed about whether they have anyone.

**Invites, three ways, one underlying token:**
- Enter an email or phone, app sends it — the default
- A 6-digit code shown large, readable aloud over a phone call
- A QR code, for when the daughter is in the room

Tokens are **single-use and expire in 48 hours.**

**Invites work both directions.** A Fam member can sign up first and request to
join an Icon's circle; the Icon approves with one tap. Blocking this blocks the
most likely acquisition path.

### Per-member permissions — default OFF except SOS contact

- SOS contact (and ordering — first, second)
- Can see mood and daily logs
- Can see health entries and appointments
- Can add or edit reminders
- Can see location — never, or only during an SOS

Everything-visible-by-default turns a companionship app into surveillance aimed
at the person it serves.

**Removal is one tap.** No confirmation maze, no notification to the removed
person. Relationships sour; the Icon needs no one's permission to close a door.

### The empty circle

Some Icons will have nobody. They are exactly who Saathban exists for.

- Circle stays out of main navigation until it has a member
- Empty state never implies a gap: "If there's someone you'd like kept in the
  loop, you can add them here" — not "You haven't added anyone yet"
- The emergency slot may be filled by a matched Buddy or by Saathban itself
- **Audit the whole app for this failure mode**: the 100-day video message, the
  share-your-score feature, streak celebrations. Anything assuming an audience
  needs a version that works without one.

---

## Admin

Full operational power. Approvals, document requests, notifications, messaging,
Q&A, account pause and unpause, role correction, manual account recovery.

**But scoped, not omniscient:**

- **Two levels.** Support admin handles approvals and documents. Super-admin
  can reach sensitive data. A person reviewing a Buddy application does not
  need to read an Icon's mood logs.
- **Audit log.** Every admin view of sensitive data writes who, what, when,
  why. Cheap now, and it protects Saathban if there is ever an accusation.
- **Break-glass.** Reading an Icon's private logs requires a typed reason and
  is logged. Available for genuine welfare concerns and SOS. Never casual.

---

## Saath-Icon home (v1)

Layout, top to bottom: calendar strip, greeting + character, today's log card,
today's score + sharing, Outdoor, Skills, Events, Community. Settings holds:
which log modules are enabled, reminders, text size, language, circle
permissions.

### Daily logs

Each module is opt-in from Settings. The Icon can enable any; a Fam member
with the "add/edit reminders" circle permission can enable and configure
routines, which then appear on the Icon's dashboard.

- **Mood — always first.** Five options. The note placeholder adapts to the
  selection. Note by voice or text.
- **Sleep:** hours picker + three-face quality rating. Optional expansion for
  bed/wake times. Two taps for the common case.
- **Medication:** list of meds (name, dose, times) set up by Icon or permitted
  Fam, then a daily tick-off checklist. The checklist is the reliable layer;
  push notifications are best-effort only (iOS PWA limitation). Position as a
  log with reminders, never as an alarm to rely on.
- **Exercise:** self-reported — activity type + duration, voice note option.
  No step counting in v1.
- **Diet:** log-based. The app never generates nutrition prescriptions.
- **From settings:** water, blood pressure, blood sugar, weight, pain.
- Day rolls over at midnight local. Backfill allowed for 48 hours, flagged
  internally as backfilled.
- **Offline-first:** logs queue locally and sync when connectivity returns.
- Logging honestly always scores the same as logging well. Rest days, illness
  mode, and streak forgiveness exist from day one.

### Voice notes

Max 2 minutes. Both audio and an automatic transcript are available; the
transcript is labeled as automatic (Urdu transcription is imperfect). A voice
note inherits the sharing rules of the log it's attached to. Transcription is
a paid API — budget line alongside geocoding.

### Points, character, celebrations

- Points reward **participation**, never performance. No leaderboards, ever.
- Loop: points → badges (creative names) → milestone celebration screens →
  the 100-day shoutout with optional video message.
- Admins can attach a **personalized message** to any milestone, so a human
  at Saathban congratulates the Icon by name.
- **Character tone matrix** (mood is asked first, so tone is mood-aware):
  - Low mood → gentle, regardless of activity
  - Good mood + little done → playful nudge; the character may tease
  - Good mood + active → full celebration
  - Returning after missed days → warm welcome back; never guilt
- **Consecutive low-mood days quietly flag Saathban staff for human
  outreach.** Disclosed plainly at onboarding. This is the mood log's real
  purpose.

### Sharing

- Everything defaults private. Circle permissions govern what Fam sees.
- If the Icon enables it, permitted Fam get an automatic daily summary.
- Per-day share options: Fam, friends (connections), community (score-level
  summary only — never medication or personal notes), or copy link.
- Shared links show summary level only and expire in 7 days.

### Outdoor

- Places from Google Places, enriched over time by Saathban's own records.
  Any place type: parks, mosques, markets, community centres, walking tracks.
- Both planned outings and live check-ins.
- A check-in shows **first name only and coarse presence** ("at the park",
  never a pin), and **auto-expires after ~2 hours**.
- Per-check-in visibility choice: connections only (default), or announce to
  the park board.
- **Park boards:** an open chat per place. Guards: report and block one tap
  away, reports land in the admin queue, no history of who was where.
- **No background location tracking, ever.** Check-ins are manual.

### Skills

Three cards — Languages, Courses, Earning skills — each with a real
description and a **"Tell me when this opens"** button. Interest counts are
the demand data that decides what launches. Never three empty shelves.

### Events + Calendar

- **One source of truth:** the events data currently inside `App.jsx` moves to
  a shared file that both the marketing site and the app read.
- RSVP with capacity and at-event check-in. Fam members can see events so they
  can bring their parent.
- Personal calendar: RSVP'd events, personal entries, birthday reminders,
  custom reminders.

### Community

- **Icons post; everyone else reads** (per the Icon's sharing settings). One
  official Saathban account for announcements.
- Real names, optional photo, generated placeholder otherwise.
- **DMs are request-gated** like Facebook/Instagram — request → accept before
  any message lands. No CNIC requirement. Rate limits on outgoing requests.
- Money-talk patterns in a DM trigger a warning banner to the recipient.
- Block, report, and mute in every thread and on every post. Non-negotiable.
- Admins moderate; reported content surfaces in the admin queue with a target
  response measured in hours, not days.

### Language & accessibility

- **English and Urdu both, from day one**, toggled in Settings. Urdu is RTL
  Nastaliq: all strings live in translation files, layouts flip. A named
  person on the Saathban team owns the Urdu strings — every feature adds text
  in two languages.
- In-app text size control, independent of the phone setting.

---

## Technical

- **Stack:** React + Vite (existing), `react-router-dom`, Supabase (auth,
  Postgres, storage)
- **Structure:** app code in `src/app/`, one file per route. The marketing site
  stays in `src/App.jsx` untouched.
- **Row-level security in Postgres.** A Buddy must not be able to read an
  Icon's health data at the *database* level. Never rely on the frontend to
  hide it.
- **Geocoding** requires a paid API key. Make location optional so the app
  works without it.
- **PWA:** manifest, service worker, installable to home screen. No app store.
- **iOS caveat:** background access and push notifications are limited in PWAs.
  Defer SOS until this is properly understood — a safety feature that silently
  fails is worse than none.

---

## Build order

1. Router at `/app`, brand tokens shared, marketing site untouched
2. Supabase project, schema, RLS policies
3. Role selection screen
4. Signup and login per role
5. Onboarding per role
6. Placeholder dashboards, one per role
7. My Circle with invites and permissions
8. Admin: Buddy review queue first, then the rest
9. Icon home: daily logs, points, character, sharing
10. Events (shared source) + calendar
11. Community: feed, then request-gated DMs, moderation queue
12. Outdoor: places, check-ins, park boards
13. Skills notify-me cards

Later: SOS (pending PWA notification limits), goals/90-day schedules,
competitions, paid tier.
