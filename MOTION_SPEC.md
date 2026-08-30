# MOTION_SPEC.md — How the app moves

Applies to **every screen, menu, sheet and button in Saathban**, outside of
games. Games have their own rules — see `GAMES_IMMERSION_SPEC.md`.

This file exists because five lanes each invented their own transition. One
vocabulary, written once, means a person always knows where they are because
they watched themselves get there.

---

## 1. The one rule everything follows

**A thing arrives from where you touched it, and leaves the same way.**

Nothing teleports. Nothing fades in from nowhere. If a user taps something in
the bottom-right, whatever opens must visibly come from the bottom-right.

The corollary: **the back gesture always reverses the arrival animation.**
If it slid in from the right, back slides it out to the right.

---

## 2. Three containers. There are no others.

| Container | Used for | Motion |
|---|---|---|
| **Full screen** | Anywhere a person stays and does something: a chat, a group, a post, a profile, search, Calendar, My Journey | Slides in from the side that was touched. Covers everything |
| **Drawer** | More, and Notifications. Nothing else | Grows from the button that opened it, over a dimmed screen. Never full width |
| **Sheet** | One decision, then gone: say hello, play something, post menu, visibility picker, seat picker | Rises from the bottom edge |

A lane that needs a fourth container must ask, not invent one.

## 3. Timings

| Motion | Duration | Easing |
|---|---|---|
| Full-screen push in / out | 220ms | ease-out in, ease-in out |
| Drawer open | 200ms | ease-out with slight overshoot |
| Drawer close | 160ms | ease-in |
| Sheet up | 240ms | ease-out |
| Sheet down | 180ms | ease-in |
| Dim layer fade | matches its container |
| Tab change | 180ms slide |

All of it respects `prefers-reduced-motion`: transitions become instant
cross-fades, nothing bounces, nothing scales.

## 4. The More drawer, precisely

- Opens from the **right**, because the More tab sits bottom-right.
  This is deliberate and overrides the common convention of left-hand
  hamburger drawers. Consistency with the rule beats convention.
- **Grows out of the More button** — starts small at the bottom-right corner
  and expands up and to the left into position. Not a flat slide.
- **Does not touch the screen edges.** A gap at the top and a gap at the
  bottom, so it reads as a card floating in front of the screen rather than a
  wall attached to the edge. Rounded corners on the left side. Soft shadow.
- Width ~80% of the screen. The screen behind stays visible at **42% dim**.
- **Tapping any row inside opens that destination full screen.** Back from
  that destination returns to the drawer, still open.
- **Tapping the dimmed area closes the drawer and does nothing else.** The
  first tap anywhere outside is consumed by closing. A second tap is needed to
  act on whatever is underneath. This is deliberate: it prevents accidental
  navigation.
- The bottom bar remains visible behind the dim but is not tappable while the
  drawer is open.

Notifications behaves identically, growing from the bell in the top-right.

## 5. The shutter

Both the header and the bottom bar hide on scroll-down and return on
scroll-up, like Facebook and Instagram.

**Tuned for older users:**
- Returns on the **slightest** upward scroll — do not require a deliberate
  swipe. Threshold no more than a few pixels.
- **Never hides on a page that barely scrolls.** If content is under
  roughly 1.5 screen heights, the bars stay put permanently.
- Both bars move together, so the frame behaves as one thing.

The composer at the top of Home is **not sticky** — it scrolls away with the
feed like any other content. There is **no floating compose button**. To
write, scroll up or tap the Home tab, which jumps to the top.

## 6. Existing bug this replaces

There is currently a **dark circular control clipped half off the right edge**
on every screen in the live build. It appears in every screenshot supplied.
Whatever it is, it must be either properly positioned or removed. A second
floating object over a dense feed will hide content.

## 7. What "every action is illustrative" means in practice

The owner's phrase. Concretely:

- A three-dot menu grows **out of the three dots**, not from a screen edge.
- A sheet triggered by a button near the bottom rises **from that button**.
- Sharing a post lands you **on the post**, highlighted — see `POSTS_SPEC.md` §8.
- Creating a group lands you **inside the group**.
- Checking in at a place lands you **on that place**, with your face on it.
- Accepting a request lands you **in the chat**.

**There are no toasts confirming an action.** No "Shared ✓", no "Saved
successfully". The result existing is the confirmation. This is already
principle 3 in `PRODUCT_DECISIONS.md`; this file states how it looks.
