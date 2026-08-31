# Saathban — Product Decisions

Everything settled in discussion with the user. **This supersedes earlier
design in CLAUDE.md and SPEC.md wherever they conflict.**

Read alongside: `GAMES_BACKLOG.md`, `LUDO_UI_SPEC.md`, `LUDO_MOTION_SPEC.md`
— all still in force; unfinished items there still stand.

---

## 0. Rules that apply to every item in this file

Not background — each is a build requirement:

1. **Both languages, real drafted Urdu**, RTL correct, Nastaliq verified by
   screenshot — never by asserting a key exists.
2. **18px minimum text, 48px minimum tap targets**, everywhere, including admin.
3. **Reduced motion** degrades to a static state, never to broken.
4. **No rankings, no leaderboards, no comparisons of ability, no purchasable
   currency.** Rewards are earned by playing and showing up.
5. **Nothing frames an Icon as needing help.** No "assistance", no "ways to
   help", no pity framing. Actions are plain verbs.
6. **Empty states are doors, never scoreboards.** A section that would be empty
   is *absent*, not rendered as an empty box announcing a gap.
7. **Every action ends where its result lives** (§11).
8. **Verified end to end in a real browser** as every affected role — Icon,
   Fam, Buddy, moderator, admin, super admin — screenshots per state. Never
   assert behaviour from reading code.
9. **Server-enforced, not UI-only.** Any rule about who can see or do something
   must hold at the database with RLS, proved by a negative test.

---

## 0.5 The app has its own visual system, separate from the brand

**Owner's ruling, 30 August 2026.** The app does NOT follow the Saathban
colour scheme or font scheme. Cream backgrounds, serif headings and the
warm palette belong to the marketing site and the logo. They do not belong
to a thing somebody opens every morning.

The reasoning is not taste. A brand palette is built to be memorable across
a handful of impressions; an app is built to be looked at for years, and
warm cream behind dense text is tiring where near-white is not. The logo
still carries the brand into the app — that is the logo's job, and it is
enough.

**The system:**

| | |
|---|---|
| Background | Near-white grey `#F2F3F5`. Never cream |
| Surfaces | Plain white `#FFFFFF` |
| Type | A system font stack. **No serif anywhere in the app** |
| Accent | Saathban green, and nothing else. Used sparingly |
| Icons | **Lucide.** One set, single weight, one colour |
| Body text | 16px |

**Emoji are not icons.** Every emoji used as an icon is replaced by a drawn
Lucide glyph — bottom bar, header, composer, weather, place types, post
types, group types, games. Emoji remain ONLY where a person typed one: a
post body, a chat message, a reaction they chose. An emoji is drawn by
whoever made the font, so a row of them shares no stroke weight and no
palette; that mismatch is the single largest reason the app reads as a
prototype.

**One accent, used sparingly.** Green marks the thing you are meant to do
next and nothing else. A screen where four elements are green has no accent.

**Where it lives.** `APP_COLORS` in `src/shared/tokens.js`, with the same
key names as `COLORS` so no call site changes shape. `COLORS` is untouched
and remains the marketing site's, which imports it from the same file — the
app and the site now disagree about colour on purpose.

This amends §0.2's type rules and every "cream" in the sections below.
Where an older section says cream, it means the marketing site.

---

## 1. Sign in — one screen, nothing hidden

The current page shows an email field, a "Continue — we'll email you a sign-in
link" button, and an "I have a password" link that *reshapes the screen*.
Replace it entirely.

**The whole page, in this order:**

```
Welcome back
[ Email address ]
[ Password ]
[ Sign in ]                        ← primary
Use an email link instead          ← plain link
Forgotten your password?           ← plain link
New to Saathban? Get started       ← plain link
```

Nothing hidden behind a toggle. Nothing reshapes on tap. The magic link stays
fully working — simply demoted to a link rather than the primary path.

**Also:** the Saathban logo is too small throughout the app. Increase it to a
reasonable, readable size — noticeably bigger, not oversized.

---

## 2. Onboarding

### Signup collects exactly four things

| Field | Notes |
|---|---|
| Name | |
| Email | How they sign in |
| Date of birth | **Mandatory.** Asked warmly: "When's your birthday? So we can celebrate with you." The age check happens quietly underneath — never tell someone they are being verified |
| City + area | City required, area prompted but optional. Area is what makes park and event suggestions useful |

**Saath-Icon is 50 and above.** Below 50 is never rejected — warmly redirected:
"Saath-Icons are 50 and above. You're very welcome here as a Saath-Fam or a
Saath-Buddy," with both doors open.

Icon status is the honoured one; younger people are welcome *around* Icons,
never as Icons.

**One onboarding path only.** Do not branch for "alone" vs "helped by family"
vs "at an event".

### The first three screens after signup

1. **"How are you today?"** — five faces, one tap, a warm response ("Good to
   hear. That's your first day logged."). They learn the loop by doing it, and
   something is already on their home screen.
2. **"Here's what we'll keep track of"** — mood, sleep and water already on;
   medicines, meals, movement shown but off. One line: "You can change any of
   this whenever you like." One button: **Theek hai.**
3. **"Who should we let in?"** — one field to invite someone, one big **Skip
   for now.** Never force a lonely person to admit they have nobody.

Then the home screen, with their mood logged and modules set.

---

## 3. Navigation — bottom bar

Replace the home-screen card grid with a **bottom bar of labelled items**.
Labels under every icon, never icon-alone. The active item gets a **filled
background pill** — not an underline, not a colour change.

**Icon:** Home · Community · Games · People · More
**Fam:** Home · Messages · Games · More
**Buddy:** Home · Messages · Games · More

**Three tiers:**
- **Daily** — the bar itself.
- **Weekly-ish** — first group inside More: Out & about, Friend groups, My
  Journey, **Grow with Saathban**, Calendar.
- **Rare** — below: Notifications, My Circle, Profile, Settings.

A hamburger hides everything behind a symbol a senior may not read as "menu".
The bottom bar is thumb-reachable one-handed.

---

## 4. The Icon home empties as the day completes

- **Morning:** greeting, today's log prominent (mood askable inline with the
  five faces), today's reminders, community posts below.
- **As things finish:** each completed piece collapses to a **slim chip** at
  the top — "Today's log ✓ 8", "Reminders ✓" — always tappable to reopen,
  never gone entirely, reverting on a new day or when a module is enabled.
- **All done:** only chips remain and the community feed fills the screen.
- **Reminders show one at a time** — the next due with a single large tick;
  marking it reveals the next; when the last is answered the card becomes a
  chip. Nothing counts days. Nothing is ever "late".

Nothing else lives on this screen.

---

## 5. The daily log

### What it is for

All three at once, each surfacing at a different moment:

- **The ritual** is the daily surface — a greeting that knows them, the
  character waiting, **mood first** because it's one tap and it's the
  emotional door.
- **The record** surfaces gently *in place* — a soft line under an entry
  ("You've slept better this week than last"), not on a separate screen.
- **The social** sits **at the end, never in the middle** — "Fatima will see
  you're doing well", one line, only if sharing is on. Never the point, or
  logging becomes performing.

**Warmth comes from responding, not confirming.** Not "logged ✓" but "Achha
laga sun kar". Ask, never instruct: "How did you sleep?" not "Sleep:".

**One thing per screen.** Never a wall of fields. Never a form.

### Defaults

**On:** mood, sleep, water.
**Off:** medicines (needs setting up first — an empty list on day one is a bad
first impression), meals, movement.

### Company, not competition

The app must **never** generate teasing about an absence, and must **never**
say a named person hasn't logged.

**Presence, not competition:** "Fatima's logged today too", "You and Fatima —
six days together", "Three of your people have logged today". Reads naturally
at one, two or five Fam — never a list of five names.

Teasing between people who chose to tease is fine — that's the sticker and
optional-message layer. Teasing generated *by the app* about an absence is not.

**Someone with no Fam and no friends** falls back to their own thread — the
character, the record, the quiet line about their week. Never an empty
comparison.

### Sharing the day

**The day is a habit.** **Badges are the occasion** (§9).

Every share, everywhere in the app:
- Offers an **optional message of your own** before sending.
- **Ends where the result lives** (§11) — never a toast saying "Shared ✓".
- **Suggestions vary by destination** — what you'd send a friend is not what
  you'd post to the neighbourhood is not what you'd send your daughter.

---

## 6. Messages

### The list — one list, no tabs

- One scrolling list, newest first, unread bold.
- Each row carries a **relationship chip**: "In your circle" / "Friend" /
  "Your Saath-Buddy".
- **Groups** in their own labelled section below.
- A **"+"** in the header opens the people list to start a conversation; the
  Message button on every profile remains.

No tabs — a senior should never categorise someone before finding them.

### The thread

- Opens at the newest message. Keyboard not forced open.
- Large bubbles; names only in groups.
- **Three labelled buttons** under the composer: Photo · Voice · Sticker.
- Long-press: reply, delete, report.
- **Play** in the header opens a three-game chooser (Ludo / Carrom / Snakes).
  Carrom renders inline; Ludo and Snakes create a table with both seated and
  drop the invite card into the thread. **Remembers what you last played with
  that person** — second time is one tap.
- **Shared things render as themselves** — a game invite is a tappable card
  with a real "Take my seat", a shared badge shows the badge, a photo shows the
  photo, a voice note is a playable waveform.

### Message requests from people you don't know

**Strangers never enter the list.** A first message from an unconnected person
sits as a quiet row at the bottom: "1 message request".

The request screen shows their name, city, **how they found you** (shared
group / event / park board, or that you have nothing in common), the **first
message only**, and three large buttons — **Accept**, **Decline**, **Report**.

Above them, one plain line:
> "You don't know this person. Saathban will never ask for money, and neither
> should anyone here."

**Guards:**
- **One shot only** — no follow-ups before acceptance.
- **Decline is permanent** — that person can never request again.
- **Money-pattern detection runs on requests**; a match adds a visible caution.
- If the sender's profile is incomplete, note it as a **small detail** — never
  the headline warning.

### Who may send a first message — a setting

> **Who can send you a first message?**
> - People I've met somewhere on Saathban *(default)*
> - Anyone on Saathban
> - Only people I'm connected to

"Met somewhere" = sharing a group, an event, or a park board.

Choosing "Anyone" shows **one calm sentence** first:
> "You'll get requests from people you haven't met. Saathban never asks for
> money, and neither should anyone here."

### Profile completeness gates first contact only

- **You can always reply**, and always message people you're connected to.
- **A first message to a stranger requires a complete profile.**
- **Creating an invite requires a complete profile.**
- The refusal explains itself warmly, citing community safety.

The person most likely to have a sparse profile is the isolated senior. A
blanket block traps them and merely inconveniences a scammer.

---

## 7. Community

**Neighbourhood-first, widening automatically.**

The feed shows your **area** first. If there isn't enough recent activity it
quietly widens to your **city**, then **Pakistan**, until the feed has
something in it. The person never sees an empty screen and never changes a
setting. Small labels show origin ("Model Town", "Karachi"). As the app fills,
the radius shrinks on its own.

**Posts from your groups appear regardless of where those people live.**

**Saathban itself posts** — events, the daily riddle, photo prompts, research
snippets. Early on the org account will be much of the feed; that's fine.

**Community is the Icons' space.** Icons post. Fam and Buddies see and react
but never post.

### Inviting people from outside

**Personal invite links** from People and the Friends filter: a link plus a
ready message for WhatsApp. The recipient taps it, signs up, and lands on **the
inviter's profile**, where they choose to connect. **Never auto-connected.**

A **group-shareable version** lets people *request* the connection.

**No rewards for inviting.** A warm acknowledgement only.

---

## 8. Profile

### Who it serves

All three views, but the **stranger view** matters most and is least designed —
it's how a lonely person is judged by someone deciding whether to accept them.

### What it holds

- Photo (the biggest factor in whether someone connects)
- Name, city, area
- **Languages — multiple selectable** (Urdu, Punjabi, English, Sindhi, Pashto,
  others). The highest-value field: it decides whether a Buddy can genuinely
  talk with them.
- **What you enjoy** — tappable, never typed: chai, walking, Ludo, gardening,
  poetry, cricket, cooking, prayer, and more
- **A line about yourself** — optional; the prompt matters. "Where did you grow
  up?" or "What did you do for work?" gets a real sentence; "Tell people about
  yourself" gets nothing
- Badges earned
- **Never:** phone number, anything about health, anything reading like a form
  field

### Getting profiles completed

**No completion percentage** — it tells a lonely person they're incomplete.

Instead:
- **A soft pulsing dot on the profile icon** when something is missing. Not
  blurry, not error-styled — an invitation. **Stops pulsing once asked and
  dismissed**, returning at most weekly.
- **Consequence shown in place** — "Add your languages so people know you speak
  Punjabi", shown where the benefit is.
- **One question at a time**, occasionally, on the home screen — a single card
  with tappable answers, dismissible.
- **"How others see you"** view on their own profile.
- **Fam may add a photo for them** — with the Icon approving (§10).
- A warm illustrated avatar rather than a grey silhouette.
- **A credential badge for a complete profile** (§9) — the incentive, doubling
  as a trust signal to strangers.

---

## 9. Badges — three families

Badges are **visibly different by family**, so a credential is never confused
with an achievement:

| Family | Earned by | Examples |
|---|---|---|
| **Presence** | Showing up over time | A Week Together, A Full Moon, The Hundredth Day, The Return |
| **Moment** | Firsts | First Step, Your Voice, First Words, Fresh Air |
| **Credential** | Completing something | Profile complete, Saathban course, Survey contributor |

Distinct colours and shapes per family.

### Earning and sharing

1. **A notification arrives** — "You've earned A Week Together 🌿." Private.
2. **They tap it.** That tap posts to community **in Saathban's voice on their
   behalf**: *"Zubaida has earned A Week Together 🌿 — seven days of showing
   up. Shabash!"*
3. It lands as an **ordinary post** — people react and comment. Not a locked
   trophy card.
4. **They may add their own line.**
5. **It never posts automatically.** The tap is the consent.

**Vary the copy** so twelve people earning the same badge in a week doesn't
read like a printer.

### Saathban's voice must be earned

Anything can be shared **by you, in your own voice, to anyone**.

A **Saathban-voiced post** — the app announcing something on your behalf — is
reserved for **real milestones and badges only**. Never for logging a mood,
never for showing up once. If Saathban's voice appears for small things it
stops meaning anything when it appears for The Hundredth Day.

### Sharing outside the app

The public share card (GAMES_BACKLOG A1) applies to badges too: a real image,
warm and **honest**. A card claiming "AMAZING DAY, 100 POINTS!" for a logged
mood is embarrassing. "Zubaida — six days in a row" with a good mark is
something a person is proud to send. **Understatement is what makes it
shareable.**

The public page shows the card, who it belongs to, and a route into signup.

---

## 10. Saath-Fam

### Why they open the app

To check in · to do something with their person · to be with them.
**Not for a social life of their own.**

**No community of their own, no groups of their own, no posting.** They see and
react to *their person's* world.

### Reciprocity — the correction that matters

One-directional caring makes an Icon feel like a patient. So:

- **Fam keep their own daily log as a normal part of the app** — not opt-in,
  not a choice. Same mood, same simple things, the daily riddle. What *is*
  their choice is whether their Icon can see it.
- **The Icon can see their Fam member's log** where shared.
- **Shared streaks** between an Icon and a Fam member — company, never guilt.

### Several Fam around one Icon

They form a **family group** — all the Fam **plus the Icon**, in one place.
**There is no hidden channel.** Children coordinating about their parent behind
their back is exactly what, discovered later, feels like betrayal.

### Their home must not be a status board

**The test: a Fam member with nothing to worry about should still want to open
the app.**

Their person's card first, then things to **react to and act on** — her photo
with a one-tap sticker, "she's at Model Town Park right now", a Ludo turn
waiting, a badge to cheer, the family group's newest message, an event she's
going to that you could join. Their own log, mood and riddle are part of that
liveliness, not homework.

**Actions are plain verbs: Message · Play · Reminders.** Never "ways to help".

Where a permission isn't granted, the copy says **it's her call** — never that
data is missing. Sections that would be empty are absent.

### Their games

Their connections are their Icon and the family group, so their games are
family games: with their Icon, with the family group, with bots, and the daily
riddle. **They cannot join open community tables.**

### Fam proposes, Icon disposes

**Nothing a family member does to an Icon's account takes effect until the Icon
approves it.**

| Case | Behaviour |
|---|---|
| A recurring permission ("Fatima may add reminders") | Icon approves **once**; help then flows freely, every instance still announced |
| An individual settings change | Needs the Icon's yes each time |
| Assisted signup at an event | Icon approves **once at the end** — "Fatima set these things up for you. Theek hai?" |
| Anything at all | The Icon is always told what changed, with a link to review |

A circle member may **never** change the message-request setting or any privacy
setting without the Icon's explicit approval.

---

## 11. Every action ends where its result lives

A toast saying "Shared ✓" tells the person nothing about *what* was shared,
*where* it went, or *how it looks*.

- Share to community → land on the post, in the feed, briefly highlighted
- Invite to a game → land at the table with that seat showing "waiting"
- Send a message → land in the thread with the message visible
- Save a reminder → land on the list with the new one highlighted
- Share a journey chapter → land on what the recipient will see

**Audit every action in the app against this.** Where a result genuinely has no
screen, the confirmation must name what happened and where it went.

### The dismissing info panel — a general pattern

Tapping something not-yet-available, or anything needing a short explanation,
opens a small panel that leaves on its own.

- Stays **5–6 seconds** — enough for slow reading in either language
- **Any tap or scroll dismisses it immediately**
- **Touching or hovering the panel pauses the countdown**
- Has a cross for anyone who wants certainty
- **Never carries an action** — these explain, they do not do

Use it app-wide, not only in Grow.

---

## 12. Out & about — what's on

**Out & about and Events are ONE screen.** To a senior deciding what to do
today, a Saathban gathering and a neighbour's chai invitation are the same
question.

### The screen, top to bottom

1. **"Ask who's up for something"** — a large primary button, **permanently at
   the top**. Never hidden, never only-when-empty.
2. **The happenings**, each a row: what · where · when · who.
   *"Chai and carrom — Model Town Park, 4:00 — Iqbal and 2 others"*
3. **Grouped by distance:** **Walkable** → **Nearby** → **Across the city**,
   then **Tomorrow** / **Coming up**. Within each group, time order.
4. Anyone **checked in right now** appears at the very top of Walkable with a
   distinct border, **how long they've been there** ("since 3:40"), and a
   one-tap **"I'll come"**.
5. **Places have no list of their own** — they exist inside happenings, plus
   one quiet **"Places near you"** link at the bottom.

Distance bands are computed from **area**, not kilometres. Seniors think in
"can I walk", "short rickshaw", "across town".

### Starting something

- **What** — free text, plus quick chips (Chai · Walk · Ludo · more)
- **Where** — free text with suggestions from seeded places *and* common
  answers (the park, my home, on the phone). Any text allowed; never a fixed
  dropdown
- **When** — Now / Later today / Another day
- **How many can come** — Anyone / a limit
- **Who can see it** — My people / My area
- **Ask them to confirm** — a toggle. On, joining reads "I'm coming" (a small
  promise) rather than "coming along"

**Adding a place:** Icons can create places — name, area, city, type,
optionally the browser's location. Usable immediately by everyone, flagged as
community-added, reportable.

### Notification protocol

Starting something notifies **your connections, plus anyone who has checked
into that place before**. It does **not** notify the whole area — that's how an
app becomes noise.

The tab carries a **small count** when something is on today. No badge when
nothing is on.

**Initiation stays Icon-only.** Fam and Buddies may view and join; the
ineligible state is a warm one-liner, never a dead button.

---

## 13. Calendar

A calendar entry that's only text is a note. **An entry must offer the action
that fits it, at its time.**

- "Sunday 4pm — Chai Reunion" → open the event, or message the people going
- "Tuesday 10am — doctor" → tell your circle you're heading out
- "Thursday — Ammi's birthday" → call her, send a sticker, post a wish
- "Friday — Sara visiting" → message her

**Entry types:** Saathban events RSVP'd to · outings and scheduled games ·
birthdays from your circle · one-off reminders · personal entries · **Buddy
visits** · course sessions.

**Deliberately excluded:** medication times — they recur daily and would bury
everything else. Reminders handle them; the calendar is for what is *different*
about a given day.

**Fam and Buddies get their own calendars**, holding what's relevant to them.

---

## 14. My Journey

**A journey, not a dashboard.**

### Structure

- **A short header** — "47 days with Saathban · since 14 July · 3 badges · 12
  games with your people"
- **JUST AHEAD** — only things genuinely close. "Two more days and A Full Moon
  finds you" with a quiet progress line; the course you're partway through; the
  hundred-day mark when near; events coming up; a birthday soon.
  **Never show far-off progress** — a badge eighty days away is a number
  telling someone how far behind they are.
- **Months as chapters**, newest first: "August — 22 days here. The month you
  started walking again." Photos from that month, badges earned in it, the
  shared thread ("With Zubaida · 9 games, 6 days logged together").
- **Graphs collapsed at the bottom** — "How I've been sleeping" opens if
  wanted. Something to look *into*, never the headline.

**Never:** a points total shouting, a streak counter, a chart of a bad month as
the first thing seen. July reads "the first days", not "11/31 logged".

### Unearned badges

Shown as **things that exist in the world**, described warmly — "The Return:
for coming back after a quiet spell" — so someone understands what this app
values. Not a checklist.

### Sharing a journey

- **One journey per person.** Relationships surface *inside* it, appearing in
  both people's journeys from their own side. No joint journeys — five Fam
  around one Icon would mean six journeys and nobody knowing which is real.
- **Every section has its own share option** — a month, a badge, a chapter, the
  whole journey. **Never one ambiguous Share button** where nobody knows what
  it will send.
- **Sharing is a moment by default** — handing someone a chapter, like handing
  them a photo.
- **Standing access is granted deliberately**, with a real revoke.
- **Buddies never get journey access.** They see the profile. A journey holds
  moods and months of a life.
- Every share carries an **optional message** and **lands where the result
  lives**.

---

## 15. Saath-Buddy

**Buddies never choose their Icons.** **Super admin allots them** — connecting
a vetted stranger to an isolated senior is the most consequential action in the
app.

**The Icon confirms every allotment** — "Saathban would like to introduce you
to Sara", with her profile, and they accept.

**A Buddy's job is whatever the allotment says** — visiting, calling, helping
at events, or a combination.

**Their home:**
- **Their people** — a card per allotted Icon: name, area, what Saathban asked
  them to do, when they last made contact
- **Message** on each card
- **What's next** — the next event they're helping at
- **Their status** — active, probation, whatever stage
- **Documents** — anything admin has requested
- **Visit logging** — a short note after seeing or calling an Icon ("visited
  Tuesday, we walked to the park"), visible to admin. This is how Saathban
  knows the programme is happening, and how a Buddy gone quiet is noticed

---

## 16. Grow with Saathban

Lives in the **weekly tier** of More.

**Sections:**
1. **Learn a new language** — placeholder, "coming soon"
2. **Courses and trainings** — holds the Saathban course below
3. **Other skills and vocational programmes** — placeholder

Placeholders use the dismissing info panel (§11) and a "tell me when this
opens" action whose counts become the demand data deciding what to build.

Keep it visible while empty — it creates useful pressure and gathers demand.

### The Saathban course

**Learning modules → a quiz after each → a final exam → a credential badge.**

- **Open to Icons, Fam and Buddies.**
- **10–20 minutes total.** Resumes where you left off.
- **You may skip straight to the exam** — but skipping earns **nothing**. The
  badge requires completing the modules.
- The badge is **purely a credential** — recognition, no unlocks.
- It lives only here; onboarding does not offer it. Its presence is signalled
  by the pulsing-dot pattern.

### The survey

Inside Grow, **Icons only** (no Fam version). Earns a **credential badge**:
"You helped Saathban's research."

**Consent screen first:**
> "Your answers help Saathban's research. They're seen only by the Saathban
> team, never by anyone else here, and you can stop at any point."

**Include only questions that feed features** — every answer must change what
the person sees:
- What they know well and could share
- Whether they'd mentor younger people
- Which activities interest them
- Whether they'd take part in learning or group activities
- Whether they'd want skill-based earning work, and what kind
- How much time per week feels comfortable
- What makes them comfortable with a companion (gender, age, background, other)
- What matters most for Saathban to feel right for them

**Explicitly excluded:**
- **Anything the app already knows** — city, area, gender, how they heard about
  Saathban, WhatsApp, email, contact consent.
- **Income and willingness-to-pay.** Pricing research inside a companionship
  product changes what the app *is* to the person. If Saathban needs it, it
  belongs in a separate, clearly-labelled exercise.
- **Direct loneliness measurement** ("do you have enough people to talk to?") —
  the question most likely to hurt someone on a bad day, alone with their phone.

**Storage:** survey answers are **super-admin-only**, stored separately from
daily logs, never visible to Fam, Buddies, moderators or ordinary admins.

---

## 17. Games — the missing seat option

Seat options become **person · bot · open to community · send a link**.

"Send a link" holds that seat and produces a link for WhatsApp. The first
person to open it takes the seat; with no account they sign up and land
straight in it, already connected to the host. **Single-use and time-limited**,
so a forwarded link cannot let three strangers into a family game.

---

## 18. Admin — three levels

| Level | Can do |
|---|---|
| **Moderator** | Community safety only: reports queue, hide content, mute, **suspend an account with a typed reason**. No Buddy applications, no documents, no health data, no broadcasts |
| **Admin** | Everything a moderator can, plus Buddy vetting queue and documents, events, member questions, broadcasts, milestone messages. **Not** the audit log, **not** Icons' private logs, **not** Buddy allotment |
| **Super admin** | Everything, plus the audit log, break-glass with a typed reason, creating and demoting admins, account deletion, **allotting Buddies to Icons**, and survey answers |

**A moderator's suspension notifies all admins with the reason.** They can act
at 2am against active harassment, but never invisibly.

### The front door is a worklist

Opening admin shows **what needs a human right now**, in priority order:
reports older than a few hours first, then Buddy applications waiting,
unanswered questions, quiet-day welfare flags, documents received. Each row is
one tap into the thing. **Filtered by what you can act on.**

Sections still exist, reached from a menu, for browsing rather than reacting.

---

## 19. Notifications

**An interruption must be about a person, not about the app.**

**On by default:** someone messaged you · someone's waiting on your move · a
circle member added a reminder · Saathban replied to your question · someone
reacted to your photo · a game invite · a family group message · your Buddy or
Icon got in touch · a badge earned · an allotment to confirm.

**Off by default, available in settings:** streak nudges · "you haven't logged
today" · feed activity · anything the app wants rather than a person does.

Only reminders, the daily riddle and turn nudges are scheduled; everything else
is triggered by a human doing something.

---

## 20. Testing — non-negotiable

For **every** item in this file:

1. Walk it in a real browser as **every affected role**, at phone width.
2. Screenshot **every state**, in **both languages**, RTL verified visually.
3. **Prove each check can fail** before trusting that it passes. A checker that
   silently matches nothing reports everything as present.
4. Test the **row, not the return value** — a function reporting success while
   changing nothing passes a return-value assertion.
5. Verify the **live object**, not the migration that was supposed to create it.
6. Test **negative cases at the database**: a Buddy must not read an Icon's
   journey; a Fam member must not post to community; an unapproved Fam change
   must not have taken effect; a stranger must not read anything.
7. State **which tree** a run was verified against — working tree and origin
   are different claims.
8. Commit with `git commit -- <your paths>`, then `git show HEAD --stat` and
   confirm only your files are in it.
