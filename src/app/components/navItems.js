/* ════════════════════════════════════════════════
   Where every role can go, in three tiers.

   PRODUCT_DECISIONS §3. One list, consumed by the bottom bar (the
   daily tier) and by the More screen (weekly and rare). Kept apart
   from both so the two can never disagree about what exists — a bar
   item with no matching More entry, or a destination reachable from
   neither, is the failure this file exists to make impossible.

   §0.6 — A SECTION THAT WOULD BE EMPTY IS ABSENT. That rule bites
   hardest in always-present chrome, so nothing here is "rendered
   disabled": an item a role cannot use is not in that role's list at
   all, and a tier that ends up with nothing in it is not drawn, not
   drawn as an empty heading.

   The distinction that took some getting right: an EMPTY SECTION is
   absent, but a DOOR to something deliberately not built yet is
   present and explains itself. Grow with Saathban is the second kind
   — §16 says keep it visible while empty because the interest counts
   are the demand data — so it stays, and its own screen does the
   explaining with the dismissing info panel (§11).
   ════════════════════════════════════════════════ */

import { roleHomePath } from "../lib/session.jsx";

/* The bar itself: at most five, labelled, never icon-alone (§3). */
export function barItems(role, { buddyActive = true } = {}) {
  const home = { to: roleHomePath(role), key: "hub.home", emoji: "🏠", end: true };
  const games = { to: "/app/games", key: "hub.games", emoji: "🎲" };
  const more = { to: "/app/more", key: "hub.more", emoji: "☰" };

  if (role === "saath_icon") {
    return [
      home,
      { to: "/app/community", key: "hub.community", emoji: "🪷" },
      games,
      { to: "/app/people", key: "hub.peopleShort", emoji: "🫶" },
      more,
    ];
  }

  if (role === "family_member") {
    return [
      home,
      { to: "/app/community/messages", key: "hub.messages", emoji: "💬" },
      games,
      more,
    ];
  }

  if (role === "saath_buddy") {
    /* A Buddy before `active` has no Icons and no community access, so
       Messages and Games are doors onto nothing for them. Absent
       rather than present-and-dead: the vetting screen is their whole
       app until they are through it. */
    return buddyActive
      ? [home, { to: "/app/community/messages", key: "hub.messages", emoji: "💬" }, games, more]
      : [home, more];
  }

  /* Admins have a worklist, not a daily life in the app (§18). */
  return [];
}

/* More, in two groups: weekly-ish, then rare (§3). */
export function moreGroups(role, { buddyActive = true } = {}) {
  const icon = role === "saath_icon";
  const buddy = role === "saath_buddy";
  const canRoam = !buddy || buddyActive;

  const weekly = [
    canRoam && { to: "/app/outdoor", key: "hub.outdoor", emoji: "🌳" },
    canRoam && { to: "/app/groups", key: "hub.groups", emoji: "🧑‍🤝‍🧑" },
    { to: "/app/history", key: "hub.journey", emoji: "🧭" },
    /* Kept even while its shelves are empty — §16. */
    { to: "/app/skills", key: "hub.grow", emoji: "🌱" },
    { to: "/app/events/calendar", key: "hub.calendar", emoji: "📅" },
  ].filter(Boolean);

  const rare = [
    { to: "/app/notifications", key: "hub.notifications", emoji: "🔔" },
    /* My Circle is the Icon's own — session.jsx guards /app/circle to
       saath_icon, so offering it to anyone else is a door into a
       redirect. */
    icon && { to: "/app/circle", key: "hub.circle", emoji: "⭕" },
    { to: "/app/profile", key: "hub.profile", emoji: "🙂" },
    { to: "/app/settings", key: "hub.settings", emoji: "⚙️" },
  ].filter(Boolean);

  return [
    { id: "weekly", labelKey: "hub.tierWeekly", items: weekly },
    { id: "rare", labelKey: "hub.tierRare", items: rare },
  ].filter((g) => g.items.length > 0);
}

/* Every destination a role can reach, bar and More together. Used by
   the test rig to prove nothing is reachable from neither. */
export function allDestinations(role, opts) {
  return [
    ...barItems(role, opts).map((i) => i.to),
    ...moreGroups(role, opts).flatMap((g) => g.items.map((i) => i.to)),
  ];
}
