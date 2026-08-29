# Milestones lane — wiring notes

Self-contained under `src/app/routes/milestones/`, wired to real Supabase
(migration 0017) through `src/app/lib/points.js`. **Not yet registered in
`AppRoot.jsx`** (that file held other sessions' uncommitted changes while
this lane landed):

## 1. Route registration (AppRoot.jsx)

```jsx
import MilestonesRoutes from "./routes/milestones/MilestonesRoutes.jsx";

// inside <Routes>, alongside the other lanes:
<Route
  path="milestones/*"
  element={
    <RequireAuth roles={["saath_icon", "admin"]}>
      <MilestonesRoutes />
    </RequireAuth>
  }
/>
```

Icons see their milestones + celebrations; admins see the milestone-message
desk on the same path. Natural nav entries for the same seam pass: a link
from the Icon home's score card ("your milestones"), and an admin-layout tab.

## 2. How the loop runs (migration 0017)

- `badges` — 9 definitions, EN + UR content (Urdu pending native review),
  each tied to a `trigger_kind`. Participation only: firsts and presence,
  never amounts or ranks.
- `earned_badges` — unique (person, badge): every award path is idempotent.
  Owner + admins read; client updates are column-locked to `seen_at`
  (celebration shown once); the personalised message writes only through
  the RPC.
- **Awarding is server-side**: AFTER INSERT triggers on `daily_logs` and
  `community_posts` call `compute_badge_awards()`; `award_my_badges()` is
  the client catch-up for rows that predate the triggers (the Milestones
  screen calls it on mount). `first_outing` computes dynamically against
  `outdoor_checkins` (0016) — no trigger on the outdoor lane's table; the
  badge lands on the next compute after a check-in.
- `my_progress()` — points (flat 10/log, rest days count), lifetime
  presence days (the 100-day arc, never resets), current streak with
  single-day forgiveness.
- `attach_milestone_message()` — admin-only; writes the note onto the
  award, inserts a `kind='milestone'` notification (0007), audit-logs.
- `rest_day` added to `log_module` — the Icon home's rest-day toggle now
  has a schema home (QUESTIONS.md item 5): insert a `rest_day` row for the
  day and presence/points/streak all count it. Home lane: adopt when ready.

## 3. Strings → locales

UI copy in `milestonesCopy.js` (`COPY`) for a one-file extraction under
`milestones.*`. Badge names/descriptions are DATA (badges table, both
languages) — the screens pick `name_en`/`name_ur` by active locale; no
extraction needed for them.

## 4. Previewing without registration

With `npm run dev` and a session signed in at `/app/auth`:

    http://localhost:5173/src/app/routes/milestones/preview.html

Dev-only; outside the production entry graph.

Open questions appended to /QUESTIONS.md (Milestones section).
