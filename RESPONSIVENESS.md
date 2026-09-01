# Responsiveness — the app answers before the network does

The owner's words: the app feels "non-guidance type" — it does not tell him
what it is doing. This is the rule that fixes that class of complaint, and the
evidence that it was a real defect rather than a feeling.

## The one rule

**Every user action gets a visible response within ~100ms, from local state,
before the network is touched.** The server confirms behind it. A failure
reverts the change and says so plainly. **No user action may wait on a
round-trip to show that it happened.**

Not "usually". A person on a slow connection is exactly the person who needs
to know their tap landed.

## Why this is not a preference

Measured on the deployed build, at an emulated 300ms latency, pressing "Pin to
your profile" in the post menu:

| | first visible change |
|---|---|
| before | **373ms** |
| after | **6ms** |
| after, at 1200ms latency | **6ms** |

The last row is the point. Once the response is local, it stops depending on
the network at all — the same interaction costs the same on a good connection
and a bad one. Before the change, the sheet sat open and frozen for a round
trip **plus a full feed reload**, because the reload was awaited too.

## The four rules to build to

### 1. Every tappable thing has a pressed state

If a person cannot tell their finger landed, they tap again. Two taps on a
toggle is two toggles, and the second one undoes the first — a missing
pressed state is not cosmetic, it corrupts the action.

### 2. Every action that changes something shows the change immediately

Apply locally, fire the request behind, revert on failure. The shape used in
`community/Feed.jsx`:

```js
const act = (apply, request, undo) => {
  closeTheSheet();
  apply();                       // the screen changes now
  request()
    .then(() => reconcile())     // NOT awaited by the caller
    .catch(() => { undo(); tellThem(); });
};
```

Three things about it worth copying:

- **The reconcile is not awaited.** Awaiting a refetch after a successful
  action holds the screen for a second round trip, after the thing the person
  asked for has already happened.
- **`undo` restores the exact prior value**, captured before `apply` — not a
  guess at what it used to be.
- **Some actions keep their surface open.** Changing a post's visibility shows
  the new value on the row that was pressed; closing the sheet would hide the
  answer. Confirm in place when the result IS the surface.

### 3. Anything slower than ~400ms shows progress in place

In place — on the row, in the button — not a full-screen spinner that hides
what the person was reading. Under 400ms, show nothing: a flash of "loading"
is worse than a brief pause.

### 4. Every failure says what failed and what to do

"Something went wrong" is the last resort, not the first. When the server
gives a reason, show the server's reason. A refusal is not an error to retry:
do not offer "try again" for something that will never succeed.

## Two things that are NOT this rule

Both cost me a wrong diagnosis in the session that produced this file, so they
are written down.

**A tap that does nothing is not always slowness.** Reactions were reported as
needing two taps. They were already optimistic and painted in **5ms** — the
optimism was never the problem. The cause was elsewhere entirely.

**A cancelled tap may be the browser, not the app.** A touch that travels more
than about 15px is a scroll as far as Chrome is concerned, and it cancels the
click it would otherwise synthesise. That happens in every app. Do not build a
mechanism to fix it; do make sure your own gesture layer is not adding to it —
a gesture that begins on a control must never become a drag.

## Where the gesture layer must yield

`components/useTabSwipe.js` owns horizontal drags app-wide. It refuses a
gesture that starts on a `button`, `a`, `[role="button"]`, `[role="checkbox"]`,
`[role="switch"]`, `[role="tab"]`, `label`, `summary`, any input, or any
element that scrolls sideways. If you build a surface with its own drag, mark
it `data-sb-swipe` and the tab drag will leave it alone.

`components/useShutter.js` holds the bars still while a dialog is open or a
field is focused. Detected, not declared — no sheet has to opt in, because the
sheet that forgets is the one that flickers.

## A note on committing, in a shared checkout

Lanes share one working tree and one index. `git commit -- <paths>` keeps
YOUR commit clean, but it does not protect your files from anyone else — a
bare `git commit` in another lane takes whatever is in the index, including
what you have just staged.

So do not stage at all. Commit straight by pathspec:

```
git commit -F- -- <paths>
```

This takes the working-tree content of exactly those files, puts nothing of
yours in the shared index for anyone else to sweep up, and leaves their
staged work alone. `git add` followed by a commit leaves a window open for
as long as it takes to write the message — which is exactly how one lane's
locale keys ended up inside another lane's commit this week.

## The measurement

Do not report a latency fix without a number, and take it at two latencies.
One number tells you the interaction is fast today; two tell you whether it
depends on the network at all.
