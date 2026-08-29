# Events lane — wiring notes

Self-contained under `src/app/routes/events/`, wired to real Supabase
(migration 0012) and to the shared events file. **Not yet registered in
`AppRoot.jsx`** — that file held other sessions' uncommitted changes while
this lane landed, so registration is left to the next seam pass:

## 1. Route registration (AppRoot.jsx)

```jsx
import EventsRoutes from "./routes/events/EventsRoutes.jsx";

// inside <Routes>, alongside the other lanes — any signed-in role:
<Route
  path="events/*"
  element={
    <RequireAuth>
      <EventsRoutes />
    </RequireAuth>
  }
/>
```

No `roles` prop: every role sees published gatherings (Fam explicitly per
SPEC.md). `EventsRoutes` renders its own `AppHeader` and gates its own tabs
(My calendar → Icons, Manage → admins) with in-route redirects; RLS makes
those redirects cosmetic, not security. Optional same-pass nav: an Events
card on the `/app` front door, and an Events row wherever the Icon home
grows its section links.

## 2. Data sources

- **`src/shared/eventsData.js`** — the marketing site's events, extracted
  from `App.jsx` (render-verified identical). Content only: no RSVP, shown
  with a "From saathban.com" pill and merged into the same list.
- **`events` table (0012)** — app-managed gatherings. Published rows are
  readable by every signed-in role; drafts by admins only. Create/edit is
  the Manage tab.
- **RSVP** — `rsvp_to_event(p_event)` / `cancel_event_rsvp(p_event)` RPCs
  only (capacity under a row lock; cancelled→going re-checks). Icons only
  in v1. Others see a going-count via `event_going_count()`, never a list;
  admins see the door list and set `checked_in_at` (at-event check-in).
- **`calendar_entries` (0012)** — personal/birthday/custom-reminder rows,
  owner-only at the database. My calendar merges them with the caller's
  going RSVPs; birthdays repeat yearly client-side (`nextOccurrence`).

## 3. Strings → locales

**Done.** All copy lives in `locales/en.js` + `ur.js` under `events.*`
(`eventsCopy.js` is gone); Urdu is drafted, pending the native review
queued in QUESTIONS.md #4.

## 4. Previewing without registration

With `npm run dev` running and a session signed in at `/app/auth`
(any role; the session is shared via localStorage on this origin):

    http://localhost:5173/src/app/routes/events/preview.html

Dev-only; outside the production entry graph.

Open product questions moved to /QUESTIONS.md (Events section).
