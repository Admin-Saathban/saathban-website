# Community shares — wiring for the screens that trigger them

Migration 0018 makes a community post typed: `post_type`
(`text|badge|score|walk|event`), `ref_id`, and a `payload` snapshot.
The feed already renders all four share cards (localized, blockable,
reportable — a share is a post, every 0014 rule applies), and the
walk composer + Join live entirely in the community lane.

Two share types start on screens OTHER lanes own. The entire
integration is one call:

```js
import { createShare } from "../community/communityData.js";
await createShare(profileId, type, refId, payload);
```

RLS note: `createShare` passes only for Icons and the org account
(`can_post_community()`), which both trigger screens satisfy already.
Payloads are SNAPSHOTS — grab the values at share time; the card never
joins back to the source row.

## 1. Milestones lane — celebration screen ("Share with community")

On the celebration screen's share action, with the earned badge row
(`badges` joined via `earned_badges.badge_key`) in hand:

```js
await createShare(profile.id, "badge", earned.id, {
  emoji: badge.emoji,
  name_en: badge.name_en,
  name_ur: badge.name_ur,
});
```

The card renders `community.shares.badgeLine` with the name for the
viewer's language. Nothing else to pass — points/streaks stay private.

## 2. Home lane — ScoreShare's Community row

`ScoreShare.jsx`'s Community `ShareRow` currently toasts without
writing. Replace its `onClick` with:

```js
onClick={async () => {
  try {
    await createShare(profileId, "score", null, {
      points,
      done: doneCount,
      total: totalModules,
    });
    onToast(t("home.score.share.toastCommunity"));
  } catch {
    onToast(t("community.feed.postError"));
  }
  onClose();
}}
```

`ShareSheet` already receives `doneCount` and `points`; pass
`totalModules` and the profile id down from `ScoreShare` (both are in
scope there). Score-level only, by construction — the payload has
three numbers and nothing else (SPEC.md: never medication or notes).

## 3. Events lane — an "I'm going" share (optional, whenever wanted)

Anywhere an Icon has RSVP'd:

```js
await createShare(profile.id, "event", event.id, {
  title: event.title,
  event_date: event.event_date,
});
```

Card shows `community.shares.eventLine` + title/date and links to
`/app/events` for the RSVP tap-through. Show the affordance to Icons
only (fam/buddy shares would be refused by RLS).

## Already done, no action needed

- Walk shares ("Who's up for a walk?") — composer in the community
  feed, creates the board-visibility outing AND the post; Join creates
  the viewer's own outing row (Icons only, per 0016).
- Friends tab — the feed filtered to the viewer's circle connections.
- Locale keys (`community.shares.*`) exist in en + ur.
- End-to-end tests: `tests/community-shares.mjs` (16 checks).

Delete this file once §1 and §2 are wired.
