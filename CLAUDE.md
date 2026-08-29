# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # first-time setup
npm run dev      # Vite dev server
npm run build    # production build to dist/
npm run preview  # serve the built dist/
```

There is no test suite, linter, or formatter configured.

## Architecture

A single-page marketing site for Saathban (a non-profit combating elderly loneliness), deployed to Vercel (`saathban.vercel.app`). Stack is deliberately minimal: React 18 + Vite, **no router, no CSS framework, no component library, no state manager**.

`src/main.jsx` mounts one default export from `src/App.jsx` (~2000 lines). Everything lives in that one file. Do not split it into a component tree or add dependencies unless asked — the single-file layout is the working convention here.

### Layout of `src/App.jsx`

1. **`C`** — the brand color token object (cream/brown/green palette). Every color in the app references `C.*`; never hardcode a hex.
2. **Content data arrays** — `FOUNDERS`, `TEAM`, `EVENTS`, `BLOGS`, `RESEARCH`, `CAROUSEL_IMAGES`, `NAV_ITEMS`, `SOCIAL_LINKS`. This is the site's CMS. Most content edits are edits to these arrays and nothing else. Several already carry inline comments explaining how to add a new entry.
3. **Page components** — `BlogArticlePage`, `EventDetailPage`.
4. **Primitives** — `Carousel`, `ImageCarousel`, `FadeIn` (IntersectionObserver reveal), `SecTitle`, `Btn`, `Card`, `Stat`, `HeroIllustration`.
5. **`Saathban()`** — the default export: routing, nav, and all page sections.

### Routing

Query-param routing over `window.history.pushState`, not a router library. `?blog=<id>` and `?event=<id>` are read from a `URLSearchParams` in state (kept in sync via a `popstate` listener); when either matches an entry in `BLOGS`/`EVENTS`, `Saathban()` early-returns the corresponding detail page instead of the main scroll page. `closeDetail(anchorId)` pops back to `/` and scrolls to the section anchor. This is what makes each post/event individually shareable — preserve it.

The main page is one long scroll of `<section id="...">` blocks matching `NAV_ITEMS`: `home`, `about`, `work`, `involve`, `blog`, `contact`. Nav is `scrollIntoView` on those ids. The About section is further split by an `activeTab` state (`about` / `founders` / `mission` / `vision` / `team`).

### Styling

Inline `style={{}}` objects everywhere, plus one `<style>{`...`}</style>` block per top-level page component (the main one is near the top of `Saathban()`'s JSX, around line 1471) holding the Google Fonts `@import`, resets, and the shared utility classes. Fonts are Playfair Display (headings/quotes) and DM Sans (body).

Responsive behaviour comes entirely from these utility classes plus `clamp()` font sizes — there is no JS breakpoint logic outside `Carousel`/`ImageCarousel`, which track `window.innerWidth <= 640` in state:

- `.grid2` / `.grid3` / `.grid4` — collapse to 2 cols at ≤900px, 1 col at ≤640px
- `.hide-mobile` / `.show-mobile` — swap desktop and mobile nav
- `.section-pad`, `.hero-text`, `.hero-flex`, `.mission-grid`, `.event-detail-grid` — mobile overrides at ≤640px

### Content authoring

**Blog posts** (`BLOGS`): each has `id` (the URL slug), `title`, `date`, `author`, `readTime`, `tag`, `color`, `excerpt`, `coverImg`, and a `content` array of typed blocks rendered by the mapper in `BlogArticlePage`. Supported block types are exactly `lead`, `paragraph`, `pullquote` (all `{type, text}`) and `numbered` (`{type, items: [{title, text}]}`); any other type renders nothing. `tag` must be one of `Research`, `Stories`, `Well-being` to pick up its accent color from the `tagColors` map (defined twice — line ~711 and ~1467; keep both in sync).

**Events** (`EVENTS`): `detail: null` marks an upcoming event with no detail page (the card stays non-clickable). Filling in the `detail` object (`fullDate`, `time`, `venue`, `about`, `highlights`, `agenda`, `gallery`, `quote`) is what turns it into a linkable `?event=<id>` page.

Images live in `public/` and are referenced by absolute path (`/blog_images/blog_9.png`). Blog covers and carousel images are preloaded via injected `<link rel="preload">` tags on mount.

### Forms and third-party

Both the newsletter subscribe and the contact form POST `FormData` to a single Google Apps Script endpoint, `SOCIAL_LINKS.script`, with `mode: "no-cors"`. Because the response is opaque, success is assumed — there is no real error path, only client-side email regex validation. A `type` field (`newsletter` / `contact`) tells the script which sheet to write to.

`index.html` holds the SEO meta, Open Graph tags, and the Meta Pixel snippet. There is also a visually-hidden keyword block near the top of `Saathban()`'s JSX for SEO — it duplicates the `index.html` meta description and keywords, so update both together.

---

# Saathban App (`/app`)

`SPEC.md` is the source of truth for the authenticated app. This is a condensed
index of it — read `SPEC.md` before implementing any app feature. The marketing
site at `/` must not be disturbed.

## Principles that constrain code

- **Never patronise.** Seniors are the honoured users. The words "elderly" and
  "user" do not appear in UI copy; no clinical framing.
- **Never assume an audience.** Many Icons live alone. No screen may imply a gap
  where family should be. Empty states are doors, not scoreboards — audit every
  audience-assuming feature (100-day video message, score sharing, streaks) for
  a version that works with nobody watching.
- **Privacy over convenience, with one deliberate exception.** Everything an
  Icon writes is private by default, and sharing with the world is opt-in per
  person, per data type. The exception is **their own circle**: a new
  membership arrives with sharing ON (see My Circle). Location is the one grant
  that stays closed everywhere until it is asked for.
- **Accessibility is a hard requirement, not a later pass.** Minimum 18px body
  text, 48px tap targets, high contrast, never colour alone.

## Roles and tier

| Role | DB value |
|---|---|
| Saath-Icon | `saath_icon` |
| Saath-Buddy | `saath_buddy` |
| Saath-Fam | `family_member` |
| Admin | `admin` |

DB values never change. **Display names live in one constants file** — `Saath-Fam`
is under review and renaming it must be a one-file edit. **Tier (`free` /
`subscribed`) is a separate field from role** — never conflate them.

## Auth

Supabase Auth, email only (no SMS in v1 — Pakistani OTP short codes need an NTN
and PTA authorisation). Magic link for Icons (90-day session, silent refresh,
never auto-logout) and Fam (30 days); email + password for Buddies (30 days);
password + 2FA for admins. A web app cannot read the inbox, so there is no OTP
autofill — the magic link *is* the frictionless path.

**Assisted signup is first-class**: a Fam member or staffer creates the account
at an event using the Icon's *own* email. This is how most Icons will onboard.
Build the admin path for manual identity verification and email migration.

## Saath-Buddy vetting

Volunteers are matched with isolated seniors, so the bar is high: verified CNIC
(number, photo, selfie at signup, 18+), languages spoken (the most important
matching field), free-text motivation, experience, and **two non-family
references that are actually phoned**. Explicit declaration checkboxes cover
criminal record, police character certificate, and the code of conduct.

Status is a pipeline, not a boolean:
`pending → interviewing → probation → active → suspended → rejected`.
**A Buddy has no access to any Icon data before `active`.** Surface reviewer red
flags in the admin UI (asking for a specific person, ID/reference reluctance,
availability inconsistent with stated job, moving contact off-platform).

**CNIC images and phone numbers are sensitive data — private storage bucket,
restricted access, defined retention. Never a public bucket.**

## My Circle

The Icon grants access; nothing is presumed about whether they have anyone.
Invites work in both directions (a Fam member can request to join, the Icon
approves with one tap) via one underlying token — sent by email/phone, shown as
a large 6-digit code readable over the phone, or as a QR code. **Tokens are
single-use and expire in 48 hours.**

Per-member permissions **default ON for a NEW membership** — SOS contact, see
mood/daily logs, see health entries/appointments, add/edit reminders. **Decision
of 2026-08-29; it supersedes the earlier "default OFF except SOS" design, which
is stale — do not build to it.** Two exceptions keep their old defaults: **see
location stays `never`** (the one grant that must be asked for), and "tell them
if my days go quiet" is off, offered per member.

The people who join an Icon’s circle are their daughter, their son, the
neighbour of thirty years; meeting them with five switches set to "no" asked a
79-year-old to complete a permissions matrix before their family could help.
What makes open-by-default honest is **required, not optional**: one warm screen
at the moment of acceptance, one notification to the Icon straight after
("{Name} can now see your days — tap to review what’s shared") deep-linking to
that member’s row, the granular editor unchanged and one tap away, and **no
silent migration, ever** — existing memberships keep exactly the grants they
have (0037 sets the defaults inside the two acceptance RPCs, on the INSERT;
there is no UPDATE over `circle_members` in it). The open edge — assisted
signup means the person tapping "Okay" may be the family member who created the
account — is recorded in SPEC.md and QUESTIONS.md rather than hidden. Full
reasoning: SPEC.md, My Circle.

**Removal is one tap** — no confirmation maze, no notification to the removed
person.

Circle stays out of main navigation until it has a member. The emergency slot may
be filled by a matched Buddy or by Saathban itself.

## Admin

Full operational power but **scoped, not omniscient**. Two levels: support admin
(approvals, documents) and super-admin (sensitive data). Every admin view of
sensitive data writes an **audit log** entry (who, what, when, why). Reading an
Icon's private logs is **break-glass** — typed reason, logged, for genuine
welfare concerns and SOS only.

## Saath-Icon home

Top to bottom: calendar strip, greeting + character, today's log card, today's
score + sharing, Outdoor, Skills, Events, Community.

**Daily logs** are opt-in per module from Settings. Mood is **always first**
(five options, adaptive note placeholder, voice or text) because it makes the
character's tone mood-aware. Then sleep, medication, exercise, diet, and from
settings water/BP/blood sugar/weight/pain. Day rolls over at midnight local;
48-hour backfill, flagged internally. **Offline-first** — logs queue locally and
sync on reconnect. Medication is a tick-off checklist positioned as a log with
reminders, **never an alarm to rely on** (iOS PWA push is best-effort). Diet is
log-based; the app never generates nutrition prescriptions.

**Logging honestly always scores the same as logging well.** Rest days, illness
mode, and streak forgiveness exist from day one.

**Points reward participation, never performance. No leaderboards, ever.**
Character tone matrix: low mood → gentle regardless of activity; good mood +
little done → playful nudge; good mood + active → celebration; returning after
missed days → warm welcome, never guilt. **Consecutive low-mood days quietly
flag staff for human outreach** — disclosed plainly at onboarding; this is the
mood log's real purpose.

Voice notes max 2 minutes, audio + auto transcript labeled as automatic (Urdu
transcription is imperfect); a voice note inherits its log's sharing rules.
Transcription and geocoding are paid APIs — budget lines.

Community sharing is score-level summary only, never medication or notes. Shared
links expire in 7 days.

## Outdoor, Skills, Events, Community

- **Outdoor:** Google Places enriched by Saathban records. Check-ins are
  **manual — no background location tracking, ever** — show first name and
  coarse presence ("at the park", never a pin) and auto-expire after ~2 hours.
  Park boards are open per-place chats with one-tap report/block and no history
  of who was where.
- **Skills:** three cards (Languages, Courses, Earning) with real descriptions
  and a "Tell me when this opens" button. Interest counts are the demand data.
  Never three empty shelves.
- **Events:** **one source of truth** — the `EVENTS` data currently in
  `src/App.jsx` moves to a shared file both the marketing site and the app read.
  RSVP with capacity, at-event check-in, personal calendar.
- **Community:** Icons post, everyone else reads. **DMs are request-gated**
  (request → accept before any message lands), rate-limited, with money-talk
  warning banners. Block, report, and mute in every thread and on every post,
  non-negotiable. Reported content hits the admin queue within hours.

## Language and accessibility

**English and Urdu from day one**, toggled in Settings. Urdu is RTL Nastaliq —
all strings live in translation files and layouts flip. Every feature ships text
in two languages. In-app text size control, independent of the phone setting.

## Technical

React + Vite (existing), `react-router-dom`, Supabase (auth, Postgres, storage).
App code in `src/app/`, one file per route; `src/App.jsx` stays untouched.

**Row-level security in Postgres** — a Buddy must not be able to read an Icon's
health data *at the database level*. Never rely on the frontend to hide it.

Geocoding needs a paid key, so location must be optional. PWA with manifest and
service worker, installable, no app store. **iOS PWAs limit background access
and push — defer SOS until understood; a safety feature that silently fails is
worse than none.**

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
