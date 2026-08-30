# OUT_AND_ABOUT_SPEC.md

Out & about is promoted from a Home tile to a bottom-bar tab. Owner: "out and
about is what does real function, it has many settings."

This file is a redesign of the existing screens, not a rebuild of the data.
The check-in, activity and place rails already exist and `PARITY.md` records
them working across all four roles. Do not touch the RLS.

---

## 1. What is wrong with the screens today

From the owner's screenshots:

- The Outdoor screen opens with **four lines of explanation** before a single
  place appears. The same fault as the Home explainer: the product describing
  itself to itself.
- **Karachi / Lahore as a toggle** asks a person to choose their own city
  every time.
- **"Places near you · Add a place"** as underlined text links, and directly
  beneath it a dashed **"Somewhere else? Add a place"** box. The same action
  twice, in two visual styles, neither matching the rest of the app.
- The **"Who's up for something?" form is seven questions on one scroll.**
- **"Ask them to confirm? / They can just come along / Ask them / Not now"** is
  unintelligible. If a reader can't tell what it does after three reads, a
  68-year-old is lost.
- The event card's action says **"Open"**. Open what?
- **"👉 Tap a place to see who's there"** — added by the flow lane as a fix for
  place cards saying only their name. The instruction becomes unnecessary once
  the cards show who is there (§3).

## 2. The screen, rebuilt

Top to bottom:

1. Back · **Out and about** · search
2. **"Ask who's up for something"** — one primary button
3. **The weather line**, directly beneath it: "34° in Karachi now, cooler
   after 5pm". This sits here because this is the moment someone decides *when*
   to ask people out. In Lahore in June, 4pm is a bad idea and the app knows
   the time.
4. **Happening today** — events, with **"I'll come"** and **"Who's going"**.
   Never "Open".
5. **Places near you**, with the city stated as quiet tappable text on the
   right — not a toggle to answer.
6. **"Add a place you like"** — once, as a plain row with a plus.

## 3. Place rows

Each place shows, without tapping:

- Name and area
- **Who is there now — faces first, then words.** "Three people here now" with
  overlapping avatars. A 70-year-old recognises Fatima's face faster than she
  reads a sentence. This is the whole point of the feature and it is currently
  hidden one tap in.
- **"Quiet right now"** when empty. Never "0 people", which is a scoreboard.
- **Access chips** (§4)

## 4. Access notes — the highest-value addition

Green chips for what is there: **Shade · Benches · Toilet · Flat walk.**
Grey chips for what to know: **Steps at gate · No shade.**

Grey is **not red and not a warning.** "Steps at gate" is information, not a
hazard.

For a 70-year-old this is the difference between going and not going, and no
map app tells them.

### 4.1 Who writes them — NOT SETTLED

Owner leaned toward: a **fixed admin-seeded list** of places, with users able
to say "I'm at X" as a moment rather than create a permanent place. Recurring
spots get promoted by an admin into the suggested list.

A lane must confirm before building. **Wrong notes are worse than none** — if
it says "flat walk" and there are steps, someone made a trip they could not
complete. Whatever is chosen, every place needs a quiet "something wrong
here?" link.

## 5. Check-ins

- **Expire by themselves after about two hours.** Nobody has to remember to
  check out, and nobody appears to be sitting in a park at midnight.
- The existing "You're checked in here until about 5:30" + Leave copy is good
  (`FLOW.md` records it). Keep it.
- Check-in stays Icon-only per SPEC; `PARITY.md` records the gentle
  ineligible-state copy for other roles. Keep it.

## 6. Visibility — chosen per action

Owner's ruling, and it applies to check-ins, moments and happenings alike.

At the moment of acting, the person chooses, and **the app says in plain words
what each choice does.** Not mode names.

- **Public** — reaches people by the ordinary widening rules
- **Private** — plus an option to **notify chosen friends**, so the people who
  matter still hear about it

The `PRODUCT_DECISIONS.md` §6 privacy vocabulary already exists — reuse it,
do not invent a parallel set of words.

### 6.1 Every resulting notification carries its own off-switch

Inline in the notification: **mute this person** and **mute this kind of
thing**. Both reversible from Settings. A notification a person cannot stop
from the place they receive it is a notification they will stop by leaving.

### 6.2 "Public" still means people, not strangers

Whether a stranger in the city can join depends on the filters the person set
when they posted — RSVP, numbers, who can see it. Those controls must all be
at their disposal in the flow (§7). The existing copy — "Your people will hear
about this. Not the whole neighbourhood." — is the right register.

## 7. "Who's up for something" — one question per screen

Same shape as group creation. The seven-question scroll becomes seven screens
with a progress line, or fewer if some collapse.

The questions, in order, and mostly as they already are:

1. What are you up for? (chips + free text)
2. Where? (places, plus "my home", "on the phone")
3. When? (Now · Later today · Another day)
4. How many can come?
5. Who can see it?

**Delete "Ask them to confirm?"** in its current wording. If a confirm step is
genuinely needed, it must be one plain question with two plain answers. As
written, nobody can tell what it does.

**Landing:** the new happening appears in the list, highlighted.
`AUDIT_11.md` already classifies `outdoor/WhatsOn.jsx` "started something" as
NAVIGATE for exactly this reason — it currently toasts instead.

## 8. Moments — "I'm at X"

A person can say where they are without creating a permanent place.

- It sits in the tab while it is live.
- When it is over it moves to **past**, visible to the people who were there.
- It clears after **48 hours**, leaving a window to report anything.

## 9. Suggested additions — owner said "open for suggestions"

Not yet ruled on. Listed for a decision, not for building:

1. **Getting there together.** "Anyone else coming from Model Town?" turns a
   solo trip into company, which is the entire product.
2. **Afterwards.** Whoever came is now someone you have met; the app quietly
   offers to connect you.
3. **Recurring meet-ups.** A walking group meets every Tuesday. Today that is
   seven separate acts of creation.

## 10. Existing bugs in this area, already found by lanes

Carry these into the work rather than rediscovering them:

- **"Gatherings" links** pointed at `/app/events`, which now redirects to
  `/app/outdoor` — present, tappable, inert. LANE 3 fixed two instances and a
  peer found a third in the admin sidebar. Re-verify after any route change
  here.
- The **admin sidebar's "Gatherings"** sent an admin to What's on, the same
  page as the row above it (LANE 4, fixed).
- `outdoor/PlaceView.jsx` had its own toast host, now retired into the shared
  feedback store; its `Toast` component in `routes/outdoor/ui.jsx` is unused
  and can be deleted (`FEEDBACK.md`).
