# Cross-role parity audit — feature × role

**Round of 2026-08-29 (parity-audit lane).** Method: signed in as each
of test-icon / test-fam / test-buddy (ACTIVE) / test-admin at 430px and
walked the feature surfaces; code-audited the gating alongside (routes
in AppRoot, RLS policies, RPC role checks — three parallel audits over
games/riddle, role homes/milestones, and notifications end-to-end).
Fixes verified in the browser (screenshots in the session scratchpad);
server changes claims-tested and rolled back before committing.

Legend: **pass** — already correct and first-class · **fixed** — was
icon-only / broken / dead-ended / unlinked, fixed this round · **n/a** —
role not eligible by SPEC *and* the ineligible state explains itself
gently · **deferred** — recorded below, not fixed.

## Matrix

| Feature | Icon | Fam | Buddy (active) | Admin |
|---|---|---|---|---|
| Outdoor | pass | **fixed** | **fixed** | **fixed** |
| Events | pass | pass | **fixed** | pass |
| Activities | pass | pass | pass | pass |
| Riddle | pass | pass¹ | pass¹ | pass |
| Games | pass¹ | pass¹ | pass¹ | n/a² |
| Groups | pass | **fixed** | **fixed** | pass |
| Community | pass | **fixed** | **fixed** | **fixed** |
| Milestones / journey | pass | n/a³ | n/a³ | pass |
| Notifications | **fixed** | **fixed** | **fixed** | **fixed** |
| Profile | pass | pass | pass | pass |
| Settings | pass | **fixed** | **fixed** | **fixed** |

¹ closed by the games/community lane's together-layer round (0029 +
0029c + commits 4f44a82/97902f1), coordinated during this audit — see
Riddle and Games below.
² admin's home deliberately stays operational (no social cards forced
in); every social route is still openable by URL for moderation, and
the admin sidebar now links there (see Admin).
³ by decision, documented below.

## Findings and fixes, per feature

### Outdoor
- **Fam/Buddy home cards** — both homes lacked the Out & about card
  although `can_use_community()` admits fam and active buddies to every
  outdoor read. Added (FamDashboard, BuddyHome — buddy's inside the
  active-only group).
- **Far-away Fam** — the city chips now name a circle person's city on
  its chip ("Lahore · Test's city"), and the default order is
  remembered choice → own profile city → a circle person's city → first
  city. A viewer whose own city has no places gets a door line ("No
  places listed in {city} yet…"), never a silent redirect.
- **Ineligible initiation** — non-Icons on a place page now read
  "Gatherings here are started by Saath-Icons — you're welcome to join
  anything above" instead of a missing button. Check-in stays
  Icon-only (SPEC), presence and happenings stay visible to all.
- **Joining** — fam join of a placed activity verified in the browser
  (previous round); the same `join_activity` gate admits active
  buddies and admins (`can_use_community()`, claims-verified).

### Events
- Fam already had a welcome note under RSVP-able events; buddies got
  silent absence — added `events.list.buddyNote` ("Volunteers are
  welcome — seats are counted from Saath-Icon RSVPs"). RSVP itself
  stays Icon-only per the recorded product question (QUESTIONS.md:
  RSVP-on-behalf) — **deferred** as product, not parity.
- My calendar Icon-only, Manage admin-only, tab guards bounce direct
  URLs cleanly — pass.

### Activities ("Who's up for…?")
- Cross-role joins work through one authority (`join_activity`,
  community store); outdoor reads the same shapes (0027/0028, ref_id
  dedupe). The fam bell now hears joins/announcements (kind `social`).

### Riddle
- Playable + solvable by every role incl. admin (`can_use_community`
  is the only gate; no icon-only checks anywhere in the solve path).
- **Together-strip symmetry** is the 0029 `riddle_people()` /
  `riddle_touch()` layer: connections (circle ∪ friends ∪ group-mates,
  block-filtered) see each other's solved-state on the riddle page
  itself — same page, every role, both directions. Wired by the games
  lane this round (97902f1) with cheer/nudge and pre-solve count-only
  (no answer fishing).
- **Fixed here:** an Icon's shared `puzzle_result` rendered as a blank
  line in the Fam shared-moments strip (no case in `momentLine`) — now
  "🧩 Cracked the Daily Riddle" (en+ur, both moments namespaces).
- Pending/suspended buddy now gets a gentle gated line on the riddle
  page instead of a bare load error (games lane, from this audit's
  finding).
- **Points: deferred by decision.** Riddle solves award no points to
  ANY role — parity holds. Points remain daily-log-based (the Icon
  home's participation concept); wiring the riddle into points is a
  product decision, not a parity gap. The riddle's own presence
  (attempt history, solved state, together strip) is role-symmetric.

### Games
- Your-move chips + Games card on all three social homes (icon hub,
  fam dashboard, buddy home — buddy's gated on active). Pass.
- **Eligibility end-to-end (audited, then closed by the games lane):**
  invite requires connection + standing (`can_use_community_profile`)
  at creation; accept re-checks standing (`respond_game_invite` v2) —
  an approved-then-suspended buddy is refused at accept. The two real
  breaks found — the accept path was unreachable from the UI, and
  `claim_open_seat` counted the invitee's own pending invite against
  `seats_total` (invited player told "already started" on a
  full-by-invites lobby) — were fixed by the games lane as the
  SessionPage invitee accept/decline flow + 0029c (claim consumes the
  caller's own invite), regression-tested in tests/together.mjs.
- The invite picker no longer free-searches all profiles; it lists
  `game_people()` (connections, eligibility-filtered server-side), so
  no one is shown-then-refused.

### Groups
- **Empty state told fam/buddies to "Start one"** with no create
  control (create is Icon-only at the RPC too). Now role-aware: "Groups
  are started by Saath-Icons — when a friend starts one, your
  invitation will appear right here", plus a one-line explanation
  under a non-empty list. (groupsCopy en+ur.)

### Community
- Feed empty state invited non-posters to write the first post —
  fam/buddy (readers by `can_post_community`) now get a reader door
  pointing at Connect instead.
- Messages empty state was a bare "No conversations yet." — now names
  Connect and carries a 48px "Find someone to talk to" button.
- **Suspended buddy** (registrar's live finding): /app/community still
  showed Messages + Connect links that refuse on arrival — both are
  now gated on the same access check as the feed; the page keeps its
  gentle no-access note.
- people/ThreadPage renders an empty pane when a thread is not open,
  and community/Thread's empty state — **deferred to the DM-owning
  lane** (both files were mid-flight in another session throughout
  this round).

### Milestones / My journey — the decision (requirement 4)
**Badges and the journey stay Icon-only, and no other role ever sees
UI promising them.** Grounds: every awarding path is structurally
Icon-only (daily_logs triggers; community posts and outdoor check-ins
are Icon-gated upstream), and the full sweep found zero badge/journey
links, cards, strips or notification kinds reaching fam/buddy — the
one lawful window stays the Icon's own *share* (and 0029's
`person_warmth`, which shows a connection's badges to people the Icon
is connected with — celebration by consent, not a parallel journey).
The celebration hook runs only inside the Icon-guarded hub. If
fam/buddy presence rewards are ever wanted, that is a new product
surface, not a gate to open.
- Edge recorded: a fam/buddy profile with `is_org = true` could earn
  the first-post badge yet be bounced from /app/milestones — org
  accounts are staff-provisioned, left as-is. **Deferred.**

### Notifications (requirement 5 — "the Fam bell looks dead")
Root cause was **generation, not wiring**: the bell and read-state
were sound, but a fam member's entire daily surface was silent —
DM messages (no trigger until 0030), circle approvals (none), and most
writers passed `link=null` (the column postdates them). Fixed across
three migrations/rounds:
- 0030 (integration): DM message → one unread `kind='dm'` per thread.
- **0032 (this lane, applied + claims-tested):** deep-link backfills —
  milestone → /app/milestones, document_request → /app/vetting,
  document_response → /app/admin/buddies/&lt;application&gt;, reminder →
  /app/home, event proposal outcomes → /app/events; every link checked
  against AppRoot's role guards so no notification points at a page
  its recipient can't open. Plus `kind='circle'`: request approved →
  tells the fam member ("🤝 {name} said yes", → /app/fam); invite
  accepted → tells the Icon (→ /app/circle).
- **Client (this lane):** NotificationsPage now renders a per-kind
  emoji + worded label (bilingual, all 12 kinds; unknown kinds fall
  back safely) — a game invite no longer looks like a document
  request. The bell polls every 60s, so a notification arriving in a
  focused tab finally shows without blur/refocus.
- Verified live: fam bell badge → circle notification with kind label
  → deep link to /app/fam → unread cleared; during the run the fam
  account also received live `game` and `social` notifications from
  the games lane's testing — the bell is demonstrably alive.
- **Deferred:** server-minted notification text is English-only in
  every writer (titles/bodies are SQL literals). Urdu UI shows an Urdu
  frame around English text. Needs a key+params storage design —
  architecture, ledgered here.

### Admin (requirement 7)
- "← Back to the app" pointed at /app, which bounces straight back to
  /app/admin — a loop. Removed; in its place a **"View the spaces"**
  sidebar group (Community feed, Outdoor places, Gatherings, Friend
  groups) — admin moderates what admin can actually look at, through
  the same routes everyone uses (RLS admits admins everywhere).
- Moderation sidebar count now counts real open `community_reports`
  (was counting mock data while the queue itself was long since live);
  stale mock plumbing and the contradictory disabled "Milestone
  messages · soon" item (it's live in the nav) removed.
- Admin walk: buddies queue, questions, broadcasts, moderation,
  milestones desk, community feed, outdoor — all render. Pass.

### Buddy home (requirement 6)
Already surfaced pipeline status, documents channel, and (once active)
community/games/groups + your-move chips; suspended buddies lose
documents and social cards with the pause explained. Added the missing
Outdoor card. "Matched Icons" remains a copy-only placeholder —
matching is a later build step. **Deferred (by build order).**

### Profile / Settings
- Profile: role shown respectfully via ROLE_DISPLAY, no icon-assuming
  UI, protected columns locked at the DB. Pass, all roles.
- **Settings leaked the Icon's daily-log configuration** (mood/sleep
  modules, "Your medicines", meals, trackers) to every role — a page
  fam/buddy/admin don't have. Now Icon-only; language, text size and
  preview remain for everyone. My Circle section was already
  Icon-gated.

## Verification notes
- Browser: 28 scripted checks across the four roles at 430px (two
  false-negatives re-verified by hand: CSS-uppercased labels defeat
  case-sensitive innerText matching; the "unread" assertion collided
  with live notifications arriving mid-run from a peer's testing).
- RTL spot-checks: fam outdoor chips + person-city annotation and the
  notifications page (kind labels) in Urdu; text-scaling: chips hold
  ≥48px at the "largest" setting.
- SQL: 0032 functions exercised under claims (fam request → icon
  approve → fam notified; icon invite → fam accept → icon notified),
  rolled back; one committed approve seeded the live fam-bell demo.
- Build clean; smoke suite untouched.
