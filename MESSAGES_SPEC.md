# MESSAGES_SPEC.md

Messages stops being a tab and becomes a **world**: an app inside the app,
with its own bottom bar and its own settings. Backing out returns you exactly
where you were.

**Note on scope:** the inside of a single chat (bubbles, sending, photos,
delete-for-everyone, the money-warning banner) is already settled in
`PRODUCT_DECISIONS.md` §6 and built by the people lane. **This file does not
redesign it.** Read §6 before changing anything inside a thread.

---

## 1. Getting in and out

- **Tap the messages icon** in the top-right header, or
- **Swipe** from the right edge of the screen.

Both do the same thing. Swipe back or tap the back arrow to leave. It is a
full-screen push from the right — `MOTION_SPEC.md` §2.

The Messages pill that currently sits inside Community is deleted; it is now
in the header on every screen.

## 2. The world's own bottom bar

Three items. The app's five tabs do not exist in here.

| Item | Holds |
|---|---|
| **Chats** | The conversation list |
| **Requests** | People who have written to you but aren't connected. Carries a count badge |
| **Menu** | Everything message-related that isn't a conversation |

## 3. Chats

- **No borders on rows.** Avatar, name, preview, separated by whitespace.
  Row height ~68px, which clears the 44px floor comfortably.
- **Photo with initials fallback.** Owner's ruling.
- **Unread is a dot, not a number.** A count creates a small debt — "you owe
  three replies". A dot says someone is there. Requests keeps a number,
  because that is a queue you clear.
- The preview says **what kind** of message it was: "Voice note · 0:12" with a
  mic glyph; "Liked your message" with a heart. Never a blank line.
- **Search by name** at the top. Name only, not message content.
- **Compose** is a pencil in the top-right of the world.
- **Presence**: on by default for friends, controlled in Menu (§5). Owner's
  ruling. The earlier concern — that visible presence invites "she was online
  and didn't reply to me" — is recorded and overruled.

## 4. Requests

- **Show the message itself.** Facebook hides it until you tap. We show it: a
  request with no visible content asks a 68-year-old to decide blind, and
  reading "we met at the Model Town walk" makes the decision obvious.
- Shows city and **friends in common** — the neighbourhood logic already in
  the app, doing visible work.
- Two actions: **Accept** and **Not now**. Never "Decline", never "Delete".
  Same outcome, no cruelty in it.
- Accepting lands you **in the chat** (`MOTION_SPEC.md` §7).
- Empty state is a door, not a scoreboard (`PRODUCT_DECISIONS.md` §0.6).
  `PARITY.md` records that the old Messages empty state was fixed once
  already — do not regress it.

### 4.1 Group invitations do NOT come here

Owner's ruling: group invitations stay inside the Groups tab. One kind of
thing per inbox. A person writing to you and a group asking you in are
different acts and must not share a queue.

## 5. Menu

Seven rows, no group headers:

1. Archived chats
2. Blocked people
3. **Who can write to you** — showing its current value beneath. Default
   "friends and neighbours". This is the setting that keeps Requests small
   rather than a spam pile. The three options are already defined in
   `PRODUCT_DECISIONS.md` §6 — use them, do not invent new ones
4. **Show when you're online** — toggle, defaulting on, sub-line "Friends only"
5. **Read receipts** — toggle
6. Sound and notifications
7. Text size in chats

**No "delete chat" in this menu.** Deleting is per-conversation, not a global
tool, and a row called Delete near an older person's thumb is a bad idea.

## 6. Reactions

WhatsApp behaviour, owner's ruling.

- **One heart, one tap.** No long-press, no six-emoji picker. Long-press is a
  gesture many older users never discover, and six options turn a warm gesture
  into a decision. Tap again to remove.
- It appears **in the thread** and in the chat list preview ("Liked your
  message"). No separate notification screen entry.
- **No points, no badge, no counter for reacting.** Consistent with
  `POINTS.md`: reactions award nothing, and that is deliberate.

## 7. Voice notes in a chat

Hold to record. Already in the backlog as a DM recorder that other surfaces
reuse. Nothing new here except that it is confirmed wanted, and that the same
recorder serves voice posts (`POSTS_SPEC.md` §7).

## 8. Play together, from inside a chat

A **Play together** action in the conversation. Opens the same sheet as the
feed's "Play something" (`POSTS_SPEC.md` §9): the games you both play, one tap
each, seat held, invite sent, and you land on the board.

This is the natural bridge between messaging and games and it reuses the
existing seat-link work — see `GAMES_BACKLOG.md` A1 and the per-seat links.

## 9. The "not heard from" faces row

Moved here from Home by the owner's ruling — it should not be permanently on
the home screen.

- A horizontal row of faces at the top of **Chats**: people you have talked to
  before and not exchanged anything with in two to three weeks.
- A small label — **"Not heard from"** — so it is not four unexplained circles.
- **Shown at most once a day**, and less often than that is fine. Not on every
  visit to Messages.
- **Dismissible from the right** with a cross. Dismissed, it does not return
  for some days.
- Tapping a face opens the **Say hello** sheet (`POSTS_SPEC.md` §9.1).
- **No green ring, no presence dot on this row.** These are not people who are
  active; they are people you have drifted from, and a liveness ring is the
  wrong signal.

It never says how long it has been, and never says either person has been
quiet. `PRODUCT_DECISIONS.md` §5 applies: the app never says a named person
hasn't done something.

## 10. Deliberately not built

- **Voice and video calls.** Owner: "a feature for later." Do not design
  around their absence in a way that makes adding them hard, but do not build
  them.
- **A Fam view of an Icon's chats.** Owner: no. Not even a
  content-free "they've been in conversation this week" signal.
