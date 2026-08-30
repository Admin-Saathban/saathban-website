# Saathban App Redesign — Index and Amendments

Written 30 August 2026. **Nothing in these files goes to a lane until the
product owner approves it.** These are proposals derived from a working
session, not instructions.

Read this file first. It lists every file produced, and — critically — every
place these files **contradict** `PRODUCT_DECISIONS.md` as it stands today.
A lane that reads a new spec without reading this index will believe two
conflicting things at once.

---

## 1. Files in this set

| File | Covers |
|---|---|
| `00_REDESIGN_INDEX.md` | This file. Amendments, conflicts, open questions |
| `MOTION_SPEC.md` | The whole app's motion grammar. Containers, direction, timing |
| `NAVIGATION_SPEC.md` | Bottom bar, header, Home, More drawer, search, Notifications |
| `MESSAGES_SPEC.md` | Messages as a world: chats, requests, menu, reactions, presence |
| `POSTS_SPEC.md` | Composer, post types, styles, voice, tagging, post menus, help posts |
| `GROUPS_SPEC.md` | Creation flow, group interior, admin, events, invites |
| `OUT_AND_ABOUT_SPEC.md` | Places, access notes, check-ins, "who's up for something" |
| `GAMES_IMMERSION_SPEC.md` | The games frame. Why Ludo feels dull and what actually fixes it |

---

## 2. Amendments to `PRODUCT_DECISIONS.md`

These are **changes to existing agreed principles**. They must be edited in
the master file, not silently overridden in a new one.

### 2.1 Principle 9 changes — this is the big one

**Was:** "18px text, 48px tap targets minimum, everywhere."

**Now:** "16px body text default, matching Facebook's density. Larger sizes
available in Settings and tested at every size. 44px minimum tap target
outside games. Inside a game screen, neither floor applies —
see `GAMES_IMMERSION_SPEC.md` §3."

**Why:** the 18px floor is the single largest cause of the app fitting roughly
a third of what Facebook fits on one screen. Density was the owner's loudest
complaint after Ludo. The floor moves into Settings as a comfort setting,
where a 75-year-old who needs 20px can have it, rather than being imposed on
everyone.

**Consequence:** every screen must be re-tested at each available text size.
A size setting nobody tested is how Nastaliq ends up overlapping.

### 2.2 Navigation section changes

**Was:** bottom bar of Home, Messages, Games, People, More.

**Now:** bottom bar of Home, Games, Groups, Out & about, More.

- **Messages** moves to the top-right header as an icon, and becomes a world
  with its own internal bottom bar. See `MESSAGES_SPEC.md`.
- **People** is deleted as a tab. It was a search field with a different name.
  Its jobs are absorbed: connections live in Messages and Groups, finding
  people lives in unified search, requests live in their own inboxes.
- **My Circle** is deleted from More. It was People wearing a different hat.
- **Groups** is promoted from a More row to a tab, and substantially expanded.
- **Out & about** is promoted from a Home tile to a tab.

### 2.3 The More tab changes

**Was:** two groups labelled "Every so often" and "Now and then", plus
"Something to add" over Settings. Nine rows.

**Now:** seven rows, no group headers at all. Calendar, My Journey, Grow with
Saathban, Badges, Saved posts, Settings, Help and support.

**Why:** the two group labels were synonyms and carried no information. A
user could not predict which group held what. "Something to add" described
nothing that was being added. Seven rows do not need chapters.

Removed from More because they now live elsewhere: My profile (header avatar,
top-left), Notifications (bell, top-right), My Circle (deleted),
Out & about and Friend groups (bottom bar).

### 2.4 Home changes

The three tiles (Out & about, Friend groups, Grow with Saathban) are **deleted
from Home**. All three were reachable from More at the same time, which is why
the app felt like a menu leading to menus.

The "What people are sharing, newest first. No rankings, no feeds within
feeds — just neighbours" explainer is **deleted**. That sentence is the product
describing itself to itself.

The "Good morning, {name}" heading no longer occupies its own row.

**A composer is added.** There was previously no visible way to write a post
from Home. This is probably why the feed read as something you watch rather
than somewhere you are.

The "Your move — Ludo" row is **deleted from Home**. Owner's ruling: a game is
an immersive thing you enter deliberately and leave deliberately; a nudge back
into a half-finished board turns it into a chore.

### 2.5 Feed filters change

**Was:** Everyone / Friends pills.

**Now:** no filters. One feed, ordered by a **rule set, not a model**:

1. Friends first
2. Then your neighbourhood
3. Then your city
4. Then the wider circle

Anything from someone you have not exchanged anything with in two weeks gets
pushed up. Nothing is ever permanently buried.

**This must not become an engagement-ranking model.** A model that learns who
you click is a popularity ranking of human beings, which violates principle 4.
The order must stay explainable in one sentence to any user who asks.

### 2.6 Principle 1 is clarified, not changed

Principle 1 is "nothing frames an Icon as needing help." This continues to
mean **the app must not frame them that way**. It does not prevent a person
choosing to ask for help in their own words — see the "Asking for help" post
type in `POSTS_SPEC.md` §6. The distinction is who is speaking.

---

## 3. Things confirmed unchanged

Stated so no lane "improves" them:

- Calendar, Fam, Buddy, Notifications and Profile are **out of scope** for this
  redesign. Owner considers them settled. Profile has known gaps (missing
  display-picture handling, missing options) that are ordinary bugs, not
  redesign work.
- All ten core principles stand except as amended in §2.1 and clarified in §2.6.
- No rankings, no leaderboards, no purchasable currency, anywhere, including
  inside games.

---

## 4. Open questions the owner has NOT ruled on

A lane that hits one of these must stop and ask, not choose.

1. **Who writes access notes on places** (admin-seeded vs user-suggested).
   Owner leaned toward a fixed admin list plus ad-hoc "I'm at X" moments.
   Not finally settled. See `OUT_AND_ABOUT_SPEC.md` §3.
2. **Whether a done help post stays in the neighbourhood feed forever.**
   Owner said yes, unless the creator deletes it. Flagged because a permanent
   feed of solved problems is also a permanent record of everyone's
   difficulties. Owner's ruling stands unless he revisits it.
3. **Whether "Show less from {person}" should exist** in a community of forty
   neighbours. Owner said keep it, reversible from Settings.
4. **Sticker licensing.** Owner's direction is to source free packs rather than
   commission art. The licence must permit redistribution inside an app
   (CC0 or a purchased commercial licence). Free-to-download is not
   free-to-ship. A lane must verify licence per pack before importing.
5. **Whether help posts get feed priority.** Not answered.
6. **Whether the host counts in an event's attendance number.** Not answered.

---

## 5. The working method has not changed

Discuss, settle, write into a spec file, then point a lane at a section of it.
Lanes do not receive these files until the owner says so.
