# Games — wiring for the screens other lanes own

Migrations 0022/0022b (see GAMES_CONTRACT.md). Routes, feed cards, and
data layer are done inside the games + community lanes. Two one-line
integrations remain on screens other lanes own:

## 1. Notifications lane — deep links on the bell

`notifications` has a new nullable `link` column (e.g.
`/app/games/s/<session-id>`). Game notifications (invites, table
ready, your turn, game over) all carry one. In the bell's row
renderer, when `n.link` is present make the row a `<Link to={n.link}>`
(or navigate on tap) instead of inert text. Rows with `link == null`
behave exactly as today — no other notification kind is affected.

Select the column in the bell's fetch: add `link` to the column list.

## 2. Icon hub lane — "your turn" chips

A self-contained component renders green chips ("Your move — Race to
100") linking to each board where it's the Icon's turn, and renders
`null` when no table is waiting. One import in the hub, anywhere above
the fold:

```jsx
import YourTurnChips from "../games/YourTurnChips.jsx";
…
<YourTurnChips />
```

It fetches its own data (30s poll), localizes itself, and respects the
tap-target/text floors. No props.

## Already done, no action needed

- `/app/games` shell (registry, my tables, create/invite/open-table,
  Race to 100 board with visible countdown + bot-timeout + away/
  reclaim, chat + stickers), `/app/games/puzzle` (Daily Riddle).
- AppRoot registration (`games/*`, behind RequireAuth; `games/ludo/*`
  stays the ludo lane's and wins by specificity).
- Community cards for `game_open` (tap to claim a seat, auto-start on
  full) and `puzzle_result`, plus the claim action.
- Locale groups `games.*` and `community.shares.gameOpen*/puzzle
  Result*` in en + ur.

Delete this file once §1 and §2 are wired.
