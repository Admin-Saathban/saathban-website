# The feedback layer — coverage

**Round of 2026-08-29 (feedback lane).** One shared pattern, applied
everywhere: `src/app/lib/feedback.jsx` (API + rules in
`src/app/lib/FEEDBACK_WIRING.md`).

Four guarantees per action:

1. **It says so.** Every create / send / join / save / share raises one
   warm line at the bottom of the screen — glyph + words, never colour
   alone, auto-dismissing, stacking to three, in both languages.
2. **It appears at once where that is safe.** Posts, DMs, reactions,
   board notes and group posts render immediately with a quiet pending
   mark and reconcile on confirm; a refusal returns the draft to the
   box with a kind line and **Retry**.
3. **The made thing shows itself.** New posts, outings, activities,
   reminders, calendar entries, groups, board notes and RSVP'd events
   glow for 2.4s and are scrolled into view (`useFresh`).
4. **It can only be done once.** Every submit disables while in
   flight and shows what it is doing ("Sending…", "Saving…").
   Guards are **per control**, never screen-wide: a picker that
   invites several people in a row disables each row on its own.

## Coverage

| Surface | Toast | Optimistic | Highlight | In-flight + double-submit |
|---|---|---|---|---|
| Community — share a post | ✓ shared / kind failure | ✓ pending card, draft restored on refusal | ✓ new post | ✓ |
| Community — reactions | ✓ only on failure (a nicety stays quiet) | ✓ instant, rolls back | — | n/a (idempotent) |
| Community — report / mute / block | ✓ + Undo on block | — | — | ✓ |
| Community — connect requests | ✓ named ("Request sent to {name}") | — | — | ✓ per person |
| Community — DM request from a post | ✓ | — | — | ✓ |
| DMs (people/ThreadPage) | ✓ failure + Retry | ✓ pending bubble, text/stickers | — | ✓ send disabled in flight |
| Circle — permission toggles | ✓ names the grant and its new state | ✓ (pre-existing patch + rollback) | — | ✓ per row |
| Circle — remove member | ✓ | ✓ (pre-existing) | — | ✓ |
| Circle — approve request | ✓ named | — | — | ✓ |
| Circle — create invite code | ✓ | — | — | ✓ |
| Reminders — save / update | ✓ distinct lines | — | ✓ pulses in the list | ✓ |
| Reminders — remove | ✓ | ✓ row leaves at once, returns on refusal | — | ✓ per row |
| Daily log — entries | ✓ once per module as it completes | ✓ (offline-first queue, pre-existing) | — | n/a (autosave) |
| Daily log — voice note | ✓ kept | ✓ local preview before upload | — | ✓ phase machine |
| Settings / log setup (own + Fam helper) | ✓ saved / "their log is updated" | ✓ (store writes through) | — | n/a |
| Events — RSVP / cancel | ✓ | — | ✓ the event | ✓ one at a time |
| Events — suggest a gathering | ✓ | — | — | ✓ |
| Calendar — add / remove entry | ✓ | — | — | ✓ |
| Outdoor — check in / leave | ✓ | — | — | ✓ |
| Outdoor — plan an outing | ✓ | — | ✓ new outing | ✓ |
| Outdoor — start an activity | ✓ | — | ✓ new activity | ✓ |
| Outdoor — join an activity | ✓ in / full / failure | ✓ counts update at once | — | ✓ per activity |
| Outdoor — park board | ✓ | ✓ words restored on refusal | ✓ new note | ✓ |
| Outdoor — report / block | ✓ + Undo | — | — | ✓ |
| Games — create a table | ✓ + per-invite lines | — | ✓ glows in My tables on return | ✓ |
| Games — invite from the lobby | ✓ named | — | — | ✓ per person (never a screen lock) |
| Games — accept / decline an invite | ✓ decline says it, then travels | — | — | ✓ |
| Games — riddle solve / share / cheer | ✓ (lane's own lines, shared host) | — | — | ✓ |
| Groups — create | ✓ | — | — | ✓ |
| Groups — accept / decline invitation | ✓ joined, then travels | — | ✓ the group | ✓ per invitation |
| Groups — post / chat | ✓ post; failure on chat | ✓ both, draft restored | ✓ new post | ✓ |
| Groups — invite / leave | ✓ named / left | — | — | ✓ per person |
| Skills — notify me | ✓ | ✓ (pre-existing set + rollback) | — | ✓ per card |

### Deliberately quiet

- **Reaction success.** A toast per tap would chatter; the filled
  reaction is its own feedback. Failure still speaks.
- **Typing in the daily log.** The log autosaves per keystroke; only
  the moment a module *completes* raises a line, once per module per
  day.
- **Navigation and reads.** Opening a page is not an action.

## Retired lane-local toasts

Each had its own single-slot host and timer; all now raise through the
shared store, so lines from different lanes stack and dismiss together
and survive a route change:

- `routes/outdoor/PlaceView.jsx` (host removed; `Toast` in
  `routes/outdoor/ui.jsx` now unused)
- `routes/community/Feed.jsx` + `ConnectPage.jsx` (`Toast` in
  `routes/community/ui.jsx` now unused)
- `routes/games/GamesHome.jsx`, `SessionPage.jsx`, `PuzzlePage.jsx`
  (`Toast` in `routes/games/ui.jsx` now unused)
- `routes/people/ThreadPage.jsx` (inline toast state)

The now-unused `Toast` components are left in place for their owning
lanes to delete — removing them is a one-line change with no callers.

## Notes for other lanes

- The games lane's decline-then-navigate timing is now structural
  rather than a race: `useToastThenGo()` says the line and travels,
  and the app-wide host keeps it readable on the next screen.
- Never optimistically render a storage path as an `<img src>` — it
  404s until the upload lands. The DM photo path keeps its existing
  "Sending photo…" state for exactly this reason (people lane's
  handover note).
- `useAction` never shows a raw PostgREST error; anything matching a
  server-shaped message falls back to `feedback.somethingWrong`.

## Verification

- Build green after every batch.
- All 44 `feedback.*` keys resolve in **both** locales (checked
  against the parsed locale objects, not by grep).
- Slow-path pass on a throttled connection: see the round log below.
