# GROUPS_SPEC.md

Groups is promoted from a More row to a bottom-bar tab and substantially
expanded. The existing "Friend groups" is the same feature — owner's words:
"the existing one lacked many features and was not properly made, tested end
to end."

So this is a rebuild of an existing thing, not a new one. `groups/GroupPage.jsx`
and `groups/CreateGroup.jsx` exist and already do some of this correctly —
`AUDIT_11.md` records that both already land on their result.

---

## 1. Creation — one question per screen

Four screens, a thin progress line at the top, back at each step.

### Screen 1 — "What kind of group?"

Six large tappable tiles, two per row: **Walking · Chai and talk · Books ·
Family · Gardening · Something else.**

This is not decoration. Choosing a type:

- pre-fills the description,
- gives a **default cover image**, so nobody has to find a photo,
- and seeds the first post — "We walk on ___ at ___, meeting at ___" — so the
  group is not empty when the first person arrives.

**"Something else"** takes them to a blank manual path where they write
everything themselves. Owner's ruling: keep the shortcut and keep the escape.

### Screen 2 — "What's it called?"

One field. Sub-line: "You can change this later."

### Screen 3 — "Who can join?"

Two options, worded as **consequences, not labels**:

- **Anyone** — "Shows up in search. People join themselves."
- **Only people you let in** — "Hidden. You approve each person."

Not "Public / Private", which people guess at.

### Screen 4 — "Ask a few people in"

Search by name, faces with checkboxes, a **Make the group** button, and
**Skip for now** beneath it.

A group with one person is fine. A group nobody finished making is not.

### What is NOT in the flow

**Cover photo and description are not steps.** Both become a dismissible
"Finish setting up" row inside the group afterwards. Older users abandon at
the photo step, and a group that doesn't exist is worse than one without a
picture.

### Landing

**Make the group lands you inside the group.** `CreateGroup.jsx` already
navigates correctly (`AUDIT_11.md`); the toast beside it goes.

## 2. Who can create a group

**Any Icon.** No approval queue.

Invitations go to the person as a request they accept — see §5.

## 3. The group interior

Cover · name · member count · the group's own feed. A **Post** button for
members; **Join** or **Ask** for non-members.

Posting to a group happens **only from inside that group.** Owner's ruling and
the simpler rule: the place you are standing decides where the post goes, so
there is nothing to understand. The cost — opening the group first — is
accepted.

A "Finish setting up" row appears for the owner while cover or description are
missing. Dismissible.

## 4. Group events — one system, not two

A group event **is** an Out & about happening. There is not a second events
system.

- The group posts it; it appears in the group and in Out & about.
- **It inherits the group's privacy.** A public group's event is public. **A
  private group's event is visible only to members** and must never appear in
  the city-wide Out & about list.

**This is the sentence a lane will get wrong.** Built the simple way, "one
system" leaks a private group's meeting place and time to the whole city.
Write a negative test: a non-member must not be able to read a private
group's event by any path, including direct URL and the RLS layer.

## 5. Invitations

An invitation is a **request the person accepts**, not an addition.

- It arrives in the **Groups tab**, not in Messages requests. One kind of
  thing per inbox.
- It carries a count badge on the tab.
- Accepting lands you **inside the group.**

`FEEDBACK.md` records that group accept/decline already toasts and travels and
that the group already highlights on arrival. Keep the travel and the
highlight; drop the toast.

## 6. Group posts in the main feed

**Yes for public groups you have joined. No for private ones.** Owner's
ruling. Private group content never leaves the group.

## 7. Managing a group

Reached from the group's own three dots. **Members see none of it.**

1. **Member requests** — approve or decline
2. **People** — the member list, with remove
3. **Co-admins** — promote a member, demote a co-admin. The **owner** is the
   only one who can delete the group or hand ownership over
4. **Group settings** — name, description, cover, privacy
5. **Reported content** — reports raised inside this group
6. **Help centre** — placeholder for now: a box where a member types what
   they are facing, which alerts an admin or moderator

On the help centre placeholder: it must **say who receives it and roughly
when**. "We'll get back to you soon" with no name is what every dead form
says. `AUDIT_11.md` makes the same point about the report action.

## 8. Pinned welcome post

A group can pin one post. The seeded first post from §1 is pinned by default.

A group with a pinned "who we are, when we meet" is the difference between a
group that survives and one that dies in a week.

## 9. Roles

Creating is Icon-only, as today. `PARITY.md` records that the empty state was
already fixed to be role-aware — Fam and Buddy are told groups are started by
Saath-Icons and that their invitation will appear there. **Keep that copy**;
do not regress it into "Start one" for people who cannot.
