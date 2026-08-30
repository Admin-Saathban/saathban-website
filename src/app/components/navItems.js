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
/* More is no longer a destination — NAVIGATION_SPEC §6 makes it a
   drawer. It keeps a `to` so /app/more still resolves for a
   bookmark or a deep link, but `drawer` is what the bar reads: the
   bar renders this one as a button that opens the panel rather than
   as a NavLink that navigates away from where you are. Going to a
   whole other screen to pick a screen is the thing §6 removes. */
  const more = { to: "/app/more", key: "hub.more", emoji: "☰", drawer: "more" };

  if (role === "saath_icon") {
    /* §1 merged Home and Community into one screen, so a Community
       tab would now be a second door to the tab you are already on.
       Messages takes the slot: it was reachable only from inside
       Community, and the user never found it. */
    return [
      home,
      games,
      { to: "/app/groups", key: "hub.groups", emoji: "🧑‍🤝‍🧑" },
      { to: "/app/outdoor", key: "hub.outdoor", emoji: "🌳" },
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

/* More — NAVIGATION_SPEC §6: SEVEN ROWS, NO GROUP HEADERS.

   "Every so often" and "Now and then" were synonyms. A person could
   not predict which group held what, so the labels cost a glance and
   returned nothing. Seven rows do not need chapters.

   Gone from here because they live elsewhere now: My profile and
   Notifications are in the header (§3); Out & about and Groups are
   bar tabs (§1); My Circle is deleted outright (§2.2) — it was People
   wearing a different hat, and circle membership surfaces where it is
   used: on a person, in Fam, in Settings.

   The Icon guard on My Journey is the games/links lane's finding and
   is kept: /app/history is guarded to saath_icon, so offering it to a
   Fam member is a door onto a redirect. A row that bounces you is
   worse than a row that is not there. */
export function moreGroups(role) {
  const icon = role === "saath_icon";

  const rows = [
    { to: "/app/calendar", key: "hub.calendar", emoji: "📅" },
    icon && { to: "/app/history", key: "hub.journey", emoji: "🧭" },
    /* Kept even while its shelves are empty — §16: the interest
       counts are the demand data. */
    { to: "/app/skills", key: "hub.grow", emoji: "🌱" },
    { to: "/app/badges", key: "hub.badges", emoji: "🎖️" },
    { to: "/app/saved", key: "hub.saved", emoji: "🔖" },
    { to: "/app/settings", key: "hub.settings", emoji: "⚙️" },
    { to: "/app/help", key: "hub.help", emoji: "💬" },
  ].filter(Boolean);

  /* One group, no label. The shape stays a list of groups so callers
     and the destination test rig do not have to change. */
  return [{ id: "all", labelKey: null, items: rows }];
}


/* Every destination a role can reach, bar and More together. Used by
   the test rig to prove nothing is reachable from neither. */
export function allDestinations(role, opts) {
  return [
    ...barItems(role, opts).map((i) => i.to),
    ...moreGroups(role, opts).flatMap((g) => g.items.map((i) => i.to)),
  ];
}
