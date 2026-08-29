# Feedback layer — wiring + adoption recipe

`src/app/lib/feedback.jsx` is the one feedback pattern: toasts,
guarded actions, and the glow on the thing you just made.

## 1. The mount (AppRoot owner applies this once)

Inert until surfaces adopt it: with an empty store the host renders
`null`, so the wrapper is a pass-through.

```diff
--- a/src/app/AppRoot.jsx
+++ b/src/app/AppRoot.jsx
@@ imports
 import { AuthProvider, RequireAuth } from "./lib/session.jsx";
+import FeedbackProvider from "./lib/feedback.jsx";
@@ inside <AuthProvider>
       <AuthProvider>
+        <FeedbackProvider>
         …existing <style> + <Routes>…
+        </FeedbackProvider>
       </AuthProvider>
```

It must sit **inside** `AuthProvider` and **inside** `LanguageProvider`
(the host reads `ts()` and `t()`), and it uses `useNavigate`, so it
must also be inside the router — which it is, since AppRoot renders
under the app's `<BrowserRouter>`.

## 2. Adoption, per surface

```jsx
import { useToast, useAction, useFresh } from "../../lib/feedback.jsx";

const { toast } = useToast();
const fresh = useFresh();

// a guarded action: no double-submit, outcome announced
const [share, sharing] = useAction(
  async () => { const id = await createPost(body); fresh.mark(id); return id; },
  { success: () => t("feedback.postShared"), retry: true }
);

<PrimaryBtn onClick={share} disabled={sharing}>
  {sharing ? t("feedback.sending") : t("community.feed.postCta")}
</PrimaryBtn>

// the created row glows + scrolls into view
<Card {...fresh.props(post.id)}>…</Card>
```

### The API

| Export | What it does |
|---|---|
| `useToast()` | `{ toast, success, info, error, dismiss }`. Text is already translated by the caller. Opts: `tone`, `actionLabel`, `onAction`, `key` (same key replaces rather than stacks). |
| `useAction(fn, opts)` | `[run, pending]`. Ignores a second call while in flight. `opts`: `success`, `error` (string or fn), `retry`, `key`, `rethrow`. Raw PostgREST errors are never shown — they fall back to `feedback.somethingWrong`. |
| `useFresh()` | `{ mark(id), props(id) }` — `props` gives a ref + the `.sb-fresh` class (2.4s glow, reduced-motion safe) and `mark` scrolls the node into view. |
| `useToastThenGo()` | `(text, to, {delay=1200})` — says it, then navigates. The host is app-wide, so the line survives the route change. |
| `pushToast(text, opts)` | Module-level escape hatch for non-component code. |

### Rules

- **Never colour alone**: every toast carries a glyph (✓ / ⚠ / ·) and
  words; errors are `role="alert"`, the rest `role="status"`.
- **Optimistic only where safe**: render the thing immediately with a
  quiet pending mark, reconcile on confirm, and on refusal put the
  draft back with a kind error + Retry. Never optimistically render a
  storage path as an image `src` (it 404s until the upload lands).
- **Per-control pending, not per-screen.** A picker that invites
  several people in a row must disable each row while its own call is
  in flight, never the whole surface.
- **Don't add a second host.** Lane-local `Toast` components in
  `routes/*/ui.jsx` are retired as each surface adopts (see
  FEEDBACK.md for which).
