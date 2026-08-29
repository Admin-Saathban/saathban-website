# Skills lane — wiring notes

Self-contained under `src/app/routes/skills/`: real Supabase reads/writes against
`public.skill_interest` (migration **0012**, added by this lane), no edits
outside this folder.

## 1. Route registration (AppRoot.jsx)

```jsx
import SkillsRoutes from "./routes/skills/SkillsRoutes.jsx";
import { RequireAuth } from "./lib/session.jsx";

// inside <Routes> — any signed-in role can express interest:
<Route
  path="skills/*"
  element={
    <RequireAuth>
      <SkillsRoutes />
    </RequireAuth>
  }
/>
```

`SkillsRoutes` renders its own `AppHeader` and owns two paths:

| Path | Screen | Access |
|---|---|---|
| `/app/skills` | `SkillsPage` — three cards + "Tell me when this opens" | any signed-in role |
| `/app/skills/admin` | `SkillsAdmin` — interest counts | admin only |

**Admin guard:** `SkillsAdmin` self-redirects a non-admin and the
`skill_interest_counts()` RPC is admin-only at the database, so the single
`skills/*` registration above is safe. If you prefer a route-level guard for the
counts page, register it separately behind `RequireAuth roles={["admin"]}` (or
move the admin view under the admin lane — see QUESTIONS.md Q3).

## 2. Migration 0012

`supabase/migrations/0012_skill_interest.sql` — applied to the remote project via
MCP during this lane's build. Table `skill_interest` (one row per person per
skill, all RLS-scoped to `auth.uid()`), plus `skill_interest_counts()`
(SECURITY DEFINER, admin-only, aggregates only — never identities).

## 3. Data contract

- **My interest:** `select skill from skill_interest` (RLS → own rows).
- **Toggle:** insert / delete a `(profile_id, skill)` row.
- **Admin counts:** `rpc('skill_interest_counts')` → `[{ skill, interested }]`,
  all three skills always present (zero-safe — never a hidden empty shelf).
