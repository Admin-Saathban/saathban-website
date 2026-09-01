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

- **The reconcile is not awaited — AND NOR IS THE HANDLER THAT CONTAINS IT.**
  Awaiting a refetch after a successful action holds the screen for a second
  round trip, after the thing the person asked for has already happened.

  This one is easy to get half right, and Lane 4 found the half. An
  un-awaited reconcile is not enough if a CALLER awaits the handler it lives
  in: the await simply moves up a level and the button holds anyway. Their
  Save button stayed on "Saving…" through an entire feed reload, after the
  words were already saved and on screen — the reconcile was not awaited by
  the request chain, but it was awaited by the component. The same stall
  wearing different clothes.

  So check the whole path, not the handler: if anything between the tap and
  the paint says `await`, the person is waiting for it.
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

## Destructive actions follow the rule too

They asked whether delete should be the one place that waits for the server,
and were right to want that decided here rather than left as a silent
exception in one file.

**It follows the rule.** Delete is confirmed before it happens, the card goes
at once, and a refusal puts it back from the value captured before the change.
Making it wait would mean the person most likely to be on a poor connection
watches a post they have just chosen to remove sit on screen for eight
seconds — measured, at 1200ms latency, 8642ms before the card moved. That is
the rule's own worst case, not an argument for an exception to it.

**With one requirement that only destructive actions carry.** A failed delete
must be reported in a way that SURVIVES being looked away from — not a toast
that fades after four seconds. Somebody who deletes a post and sees it go may
close the app believing it gone; if the request then fails, a message nobody
was there to read means they think something is deleted that is not. For a
post the person may be removing precisely because they regret it, that is a
privacy failure and not merely a stale screen.

**This requirement is NOT met today, and I am naming it rather than writing
a rule the app cannot obey.** `pushToast` in `lib/feedback.jsx` always sets a
dismiss timer — every toast fades, and there is no persistent tone. So a
failed delete currently reports through something that disappears. Closing
that gap needs a toast that stays until acknowledged, which is a change to
the feedback host rather than to any one caller. Until then, delete is
optimistic and its failure notice is transient, and that is a known hole
rather than a decision.

The general form: **optimistic is correct for anything reversible, and for
anything destructive that is confirmed first. The exception is not
"destructive" — it is "irreversible AND the failure cannot be told to
anyone".** If you cannot report the failure, do not claim the success.

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
