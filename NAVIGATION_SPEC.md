# NAVIGATION_SPEC.md

**Read `00_REDESIGN_INDEX.md` first.** This file reverses parts of work that
LANE 2 completed and verified on the night of 29 August. Those reversals are
deliberate product decisions made by the owner on 30 August **after seeing the
result on his phone**. They are not defects and the lane that built them did
nothing wrong.

---

## 0. What this reverses, explicitly

| LANE 2 built, 29 Aug | Now | Why |
|---|---|---|
| Bar: Home · Messages · Games · People · More | Home · Games · Groups · Out & about · More | Messages becomes a top-right world (§3). People was a search box with a different name and is deleted (§2.1) |
| Out & about, Friend groups, Grow as three labelled doors on Home, **kept in More too** | Deleted from Home. Out & about and Groups are bar tabs; Grow stays in More only | LANE 2's note — "two ways to one room isn't the defect" — was reasonable, but with the tiles present the feed sat below the fold. Density won |
| Home = the real Feed | **Unchanged and correct.** Keep it | — |
| One menu, header hamburger deleted | **Unchanged and correct.** Keep it | — |
| Back = one step of history | **Unchanged and correct.** Keep it | — |

Nothing else of LANE 2's night is touched. Profile photo, Settings' account and
privacy half, the medicines default fix and the first-run gate all stand.

---

## 1. The bottom bar

**Icon:** Home · Games · Groups · Out & about · More

Five items, labels under every icon, filled pill on the active one — the pill
rule from `PRODUCT_DECISIONS.md` §3 is unchanged.

**Fam and Buddy** keep a reduced bar as today, with Messages moved to the
header for them too.

The bar **shutters on scroll** — see `MOTION_SPEC.md` §5.

### 1.1 Games stays in the bar

The owner asked whether Games could move to More to free vertical space. It
cannot: the bar is the same height with four items or five, so removing one
frees nothing. Games stays because it is the most-used thing in the app for
this audience.

## 2. What was deleted, and where its jobs went

### 2.1 People (tab) — deleted

| Job it did | Now lives in |
|---|---|
| Finding people | Unified search (§5) |
| Connection requests | Their own inbox, badged |
| Seeing who you know | Messages (chats) and Groups (members) |
| "Invite someone" | Search, and inside each group |

**Note for whoever does this:** `ConnectPage.jsx` is built and mounted on no
route — reported by both LANE 3 and LANE 4, owned by LANE 2's merge. "Connect
with Saath-Icons" currently lands on the Requests inbox: the label promises
finding people, the destination is people who already found you. **Resolve
this as part of deleting the People tab**, not separately, or the same
unreachable page will be inherited by the new structure.

### 2.2 My Circle (More row) — deleted

It was People wearing a different hat. Circle membership surfaces where it is
used: on a person, in Fam, in Settings.

## 3. The header

Left to right: **profile avatar · SAATHBAN · search · bell · messages**

- **Avatar (top-left)** opens the profile, full screen, sliding **from the
  left** — because it was touched on the left. `MOTION_SPEC.md` §1 applies in
  both directions; this is the test case for it.
- **Search** opens full screen from the right (§5).
- **Bell** opens Notifications as a **drawer** growing from the bell.
- **Messages** opens the Messages world (see `MESSAGES_SPEC.md`).
- Bell and Messages both carry counts.
- The header shutters with the bottom bar.

The Saathban logo stays at the increased size set in `PRODUCT_DECISIONS.md` §1.

## 4. Home

Top to bottom, and nothing else:

1. **Header** (§3)
2. **Composer** — "Say something to your neighbours", with a photo icon. This
   did not exist before. There was no visible way to write a post from Home,
   which is why the feed read as something you watch rather than somewhere you
   are. Scrolls away with the feed; not sticky; no floating button.
3. **Today's log** — one row: sun icon, "Good morning, {name}" and
   "Today's log — 1 of 2" beneath it, chevron. **Not a bordered card.** The
   greeting no longer owns a row of its own.
4. **The feed**, immediately.

**Deleted from Home:** the three tiles; the "What people are sharing, newest
first…" explainer; the Everyone/Friends filter pills; the "Your move — Ludo"
row (owner's ruling: a game is entered deliberately, never nudged into).

### 4.1 Borders

One rule, applied across the whole app: **an outline means you can tap it.**
Cards get a fill or nothing, separated by whitespace. Filters, headings and
containers lose their borders. This is mechanical and is the second largest
density win after the text size.

### 4.2 Feed order

No filters. One feed. Ordered by a **rule set, not a model** —
`00_REDESIGN_INDEX.md` §2.5 has the rules and the warning about why this must
never become an engagement ranking.

### 4.3 The reconnect row

Once a week at most, one at a time, inline in the feed. Someone you have
talked to before, not exchanged anything with in two to three weeks, currently
active.

- Shows: photo, name, city, and **"she's around today"**.
- Never says how long it has been. Never says either person has been quiet.
  Never implies neglect. This is `PRODUCT_DECISIONS.md` §5 — the app never
  says a named person hasn't done something.
- Two actions: **Say hello** and **Play something** (both defined in
  `POSTS_SPEC.md` §9).
- An **X** dismisses it. That person does not resurface for a month.

## 5. Search — one box, four kinds of result

Full screen, sliding from the right. **Not a drawer** — a drawer is for
choosing between things; search is a place you work, and it needs the keyboard
and the whole screen.

Results grouped under plain labels, in this order: **People · Groups ·
Out and about · Posts**. No tabs.

The action sits on the row: **Join** for a public group, **Ask** for a private
one. Finding a thing and acting on it is one screen.

Before typing: recent searches and a few suggested groups. Never a blank page.

## 6. More

A **drawer**, not a page. Full behaviour in `MOTION_SPEC.md` §4 — grows from
the More button, gaps top and bottom, dimmed screen behind, first outside tap
only closes.

Seven rows, **no group headers**:

1. Calendar — with a live count ("2 things today")
2. My Journey
3. Grow with Saathban
4. Badges
5. Saved posts
6. Settings
7. Help and support

Tapping any row opens it **full screen**. Back from there returns to the
drawer, still open.

**Deleted:** the "Every so often" and "Now and then" headers (synonyms
carrying no information), and "Something to add" over Settings (nothing is
being added).

## 7. Notifications

A **drawer** from the bell, same behaviour as More.

It must additionally hold the **report chain**: a person who reports something
gets a report ID and can follow what happened to it. Silence after reporting a
neighbour is its own discomfort. (`AUDIT_11.md` already flags
`people/ThreadPage.jsx`'s report as NAME IT — this is the destination it names.)

## 8. Text size

`PRODUCT_DECISIONS.md` §0.2 changes — see `00_REDESIGN_INDEX.md` §2.1.

- Body default **16px**, matching Facebook.
- Sizes offered in Settings, **and every screen tested at every size.**
  `QUALITY_REPORT.md` §3 already records that the daily-log lane and the admin
  lane use raw pixel sizes and never call `ts()`, so the text-size control
  silently does nothing on the screen a senior uses every day. That must be
  fixed as part of this, or the new setting is a lie on the most important
  screen in the app.
- Tap floor **44px** outside games. Inside games, see
  `GAMES_IMMERSION_SPEC.md` §3.

## 9. Language

**The switch lives in Settings only.** Owner's ruling: the whole interface is
not rearranged for it, and no flag or ا/A goes in the header.

The risk this leaves — someone opening the app in a language they cannot read
and being unable to find the setting — is handled at **first run** instead:

- On first launch, one screen offers the choice, **showing both scripts side
  by side as a live preview** so it is chosen by looking, not by reading a
  language name.
- The same screen says **where to change it later** ("You can change this any
  time in Settings").
- After that it is never asked again.

`QUALITY_REPORT.md` §4 records that community, events and circle still render
English only because their copy sits in lane-local modules outside
`locales/`. The language switch is a lie on those three screens until that
lift happens. It is listed there as a high-priority finding; treat it as part
of this work rather than a separate cleanup.

## 10. The floating circle

There is a **dark circular control clipped half off the right edge** on every
screen in every screenshot the owner has supplied. Whatever it is, position it
properly or remove it. Do not add a second floating object over the feed.
