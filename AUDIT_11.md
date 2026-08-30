# §11 audit — every action ends where its result lives

PRODUCT_DECISIONS §11. Every action in the app, checked against the rule
that a result must be shown where it lives rather than announced by a
toast. Read with `PRODUCT_DECISIONS.md`; §11 is the authority, this is
the worklist.

**Method.** Every `pushToast` / `useToastThenGo` call site in `src/app`
(55 of them, 20 files), read in context to see what the surrounding code
already does with the result.

---

## The finding that matters

**Most of the app already lands on its result and fires a toast anyway.**

`groups/GroupPage.jsx` posts, refetches, finds the new row and calls
`fresh.mark(added.id)` to highlight it — and *then* says "Posted ✓".
`circle/CirclePage.jsx` puts the new invite code on the screen and then
says "Invite created". `home/VoiceNote.jsx` hands the note to its parent,
which renders it, and then says "Voice note saved".

So for most of these the §11 fix is not new navigation. It is **deleting
the toast**, because the thing it announces is already visible three
inches above it. That is worth stating plainly, because "audit every
action against §11" sounds like a rewrite and mostly is not.

The toasts that are genuinely load-bearing are the **errors**, and §11
does not touch them: a failure has no result and no home to land on.

---

## Classification

| Verdict | Meaning |
|---|---|
| **REDUNDANT** | The result is already on screen. Delete the toast. |
| **NAVIGATE** | The result has a screen the person is not taken to. |
| **NAME IT** | No screen exists for the result. The confirmation must say what happened and where it went, not "✓". |
| **KEEP** | An error, or a genuine non-result. §11 does not apply. |

---

## Findings by owner

### Unclaimed tonight — fixed in this pass

| File | Action | Verdict | Fix |
|---|---|---|---|
| `circle/CirclePage.jsx` | invite created | REDUNDANT | code is rendered by `setCode` |
| `groups/GroupPage.jsx` | post shared | REDUNDANT | already refetches and `fresh.mark`s the new post |
| `groups/GroupPage.jsx` | member invited | NAME IT | says who was invited and that they must accept |
| `groups/GroupPage.jsx` | left the group | NAME IT | you are navigated away; the line names the group |
| `groups/CreateGroup.jsx` | group created | REDUNDANT | already navigates to the new group |
| `home/VoiceNote.jsx` | voice note saved | REDUNDANT | the note renders in place |
| `home/IconHome.jsx` | log saved | REDUNDANT | the day's chip updates in place (§4) |
| `home/LogSetupPanel.jsx` | settings saved | REDUNDANT | the switches are the result |

### -42 — §12, §13, §16, §17

| File | Action | Verdict | Note |
|---|---|---|---|
| `outdoor/WhatsOn.jsx` | started something | NAVIGATE | §11: land on the new happening in the list. §12 puts it under Walkable — it should be there, highlighted, not behind a toast |
| `outdoor/WhatsOn.jsx` | joined something | REDUNDANT | the row already changes to joined |
| `events/EventsList.jsx` | RSVP'd | REDUNDANT | the row shows going/not going |
| `events/MyCalendar.jsx` | added / removed | REDUNDANT | the entry appears and disappears in the list |
| `events/SuggestGathering.jsx` | suggested | NAME IT | it goes to a moderator; say so, and where to see it |
| `games/SeatLinks.jsx` | link sent / copied | NAME IT | §17's link holds a seat — name the seat it holds and that it is single-use |
| `skills/SkillsPage.jsx` | interest noted | REDUNDANT | the button's own state is the result. Good candidate for `InfoPanel` per §16 |

### -f2 — A1 share

| File | Action | Verdict | Note |
|---|---|---|---|
| `games/BoastSheet.jsx` | shared | NAVIGATE | §11 names this case exactly: a share to community lands on the post in the feed, briefly highlighted |

### -38 — §6, §7, §10

| File | Action | Verdict | Note |
|---|---|---|---|
| `people/ThreadPage.jsx` | reported | NAME IT | say what happens next and roughly when — "a moderator will look within hours" |
| `people/ThreadPage.jsx` | carrom already set up | KEEP | an explanation, not a result. `InfoPanel` fits it better than a toast |

### Games rails

| File | Action | Verdict | Note |
|---|---|---|---|
| `games/PuzzlePage.jsx` | shared / boast | NAVIGATE | same as BoastSheet |
| `games/SessionPage.jsx` | assorted | KEEP | errors |
| `games/JoinByLink.jsx` | seated | REDUNDANT | you arrive at the table, which is the result |
| `games/NewGame.jsx` | errors | KEEP | |

---

## The dismissing info panel

`src/app/components/InfoPanel.jsx`, built to §11's letter:

- stays 5.6 seconds
- any tap or scroll dismisses it immediately
- **hover and touch both pause the countdown** — the one gesture meaning
  "I am still reading" must not be the one that takes the words away
- has a cross for anyone who wants certainty
- **cannot carry an action**: there is no children slot and no action
  prop, so it cannot grow a button without someone deliberately editing
  the file. "Just this once" is how every explain-only surface ends up
  with a Buy Now on it.

It is **not** the toast host. `lib/feedback.jsx` announces that something
happened; this explains something that did not. Use it for anything
not-yet-available (§16's placeholders) and for short explanations.
