# Friend groups — wiring notes

Self-contained under `src/app/routes/groups/`: real Supabase reads/writes against
the group tables (migration **0026**, applied). One small edit outside the folder
(admin ModerationQueue — see below).

## 1. Route registration (AppRoot.jsx)

```jsx
import GroupsRoutes from "./routes/groups/GroupsRoutes.jsx";
import { RequireAuth } from "./lib/session.jsx";

// inside <Routes> — any signed-in role can be a member (Icons, Fam, active Buddies):
<Route
  path="groups/*"
  element={
    <RequireAuth>
      <GroupsRoutes />
    </RequireAuth>
  }
/>
```

`GroupsRoutes` renders its own `AppHeader`. Paths: `/app/groups` (list + invites),
`/app/groups/new` (create — Icons only; the `create_group` RPC enforces it), and
`/app/groups/:id` (Feed / Chat / Members). Notification deep links already point
at `/app/groups/<id>`.

## 2. Admin moderation (one small edit, made here)

`routes/admin/ModerationQueue.jsx` maps report kinds via `KIND_LABEL` /
`HIDE_TABLE`. Added `group → groups` and `group_post → group_posts` (the outdoor
lane set the precedent with `park_board`). Group reports now render with a label
and a working **Hide** (soft-hide via `hidden_at`/`hidden_by`, admin-update RLS).
The `community_reports.target_kind` CHECK was widened in 0026 to include
`'group'` and `'group_post'` (kept `park_board` — do not rebuild from the 0014
three-value list).

## 3. Migration 0026 (applied; registrar-reserved)

Tables `groups`, `group_members`, `group_invites`, `group_posts`,
`group_messages`; helpers `is_group_member` / `is_group_creator` /
`can_see_group`; RPCs `create_group`, `invite_to_group`, `respond_group_invite`,
`remove_group_member`, `leave_group`. Connections reuse the canonical
`game_connected(a,b)` (circle) OR-ed with an accepted DM (community friends), the
same connection gate the game invites use; invitees must be community-eligible
(`can_use_community`: Icons, Fam, active Buddies — the mixed-role rule). Invites
ride the notification rails (`kind='group'`, deep link). Removal is one tap, no
notification (circle's rule); a member leaves any time; if the creator leaves the
group is closed (cascade). Blocks carry over (`caller_hides` on reads; blocked
either-side can't be invited).

## 4. Copy — local, pending central merge

`groupsCopy.js` is a local bilingual module (English + Urdu draft). Merge into the
central `locales/` under `groups.*` when convenient; the Urdu needs native review.

## Verified end to end (test-icon ↔ test-fam, via the real RLS)

create group (icon) → invite (connection-gated, notification) → one-tap accept →
member post + chat (RLS member-write) → report the group and the post into
`community_reports` → admin Hide (post soft-hidden) + resolve → member leaves.
All outcomes checked: 1 member after leave, post hidden, 2 reports filed and
resolved, invite notification delivered.
