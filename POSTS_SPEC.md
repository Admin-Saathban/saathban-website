# POSTS_SPEC.md

The composer, what a post can be, what its menus hold, and the "asking for
help" post type.

---

## 1. The composer

Did not exist. There was no visible way to write a post from Home.

**On Home:** one row — "Say something to your neighbours" and a photo glyph.
No avatar on the row (the header already carries it; two of the same face in
one screen is noise). Scrolls away with the feed. No floating button.

**Opened**, it is full screen:

- Close · "New post" · **Share** (primary, top-right)
- Your name, and beneath it the **visibility line**: a globe glyph, "Anyone on
  Saathban", a chevron. Default public. Stated in plain words rather than a
  toggle to hunt for.
- The text area
- Colour swatches (§3)
- Style tags (§4)
- Then: Photo · Something to come to · With someone

## 2. Visibility

Three options: **Anyone on Saathban · Friends · Just for me.**

"Just for me" — owner's ruling, renamed from "Only me". It is the setting
people use for journaling rather than hiding, and the name should invite that.

Default is public. For Icons who do not know what public means, the line under
the composer says what it does rather than naming a mode.

## 3. Colour backgrounds

Six warm swatches plus a plain "Aa". Applies to **short text only** — once a
post runs long or carries a photo it renders plain, so long posts never become
unreadable on yellow. Same rule Facebook uses.

## 4. Style tags

Four: **A milestone · Something good · A memory · Asking for help.**

The tag is separate from the colour. Colour is how it looks; the tag is what
kind of thing it is.

The tag is what lets a milestone earn a badge **without Saathban inventing
meaning** — the person declared it themselves. This keeps
`PRODUCT_DECISIONS.md` principle 10 intact (the app only speaks on someone's
behalf for real milestones).

**"Asking for help" is not a violation of principle 1.** Principle 1 forbids
*the app* framing an Icon as needing help. A person choosing to say "I can't
manage the ladder" is the opposite of that, and it is the most valuable post
type a neighbourhood app has. See `00_REDESIGN_INDEX.md` §2.6.

## 5. Tagging — "With someone"

- The tagged person gets a notification, can **remove the tag**, and can turn
  tagging off entirely in Settings.
- For an event, a tagged person becomes a **co-host** and it appears in
  Out & about under both names — **but only after they accept.**
  Fam-proposes-Icon-disposes, applied to everyone.

## 6. Help posts

### 6.1 Three states

**Asked → Someone's coming → Done.**

- **Asked**: the post, with one green **"I can help"** button beneath it.
- **Someone's coming**: a tinted strip on the post — "Tariq is coming on
  Thursday" — with the helper's face. The button becomes
  **"Tariq's already coming — offer anyway?"**, still tappable. Nobody is
  blocked; they are informed.
- **Done**: "Tariq sorted this out". Share disappears; the heart stays.

### 6.2 The rules

- Replies are ordinary comments. The **offer is a button, separate from the
  talk.** A comment thread under a request for help produces sympathy and no
  help.
- The poster **sets how many helpers** they want. Default one.
- The poster marks it done.
- **A moderator can remove an offer** (someone claims a job and vanishes),
  which reopens the slot. The moderator tells them — they are already in the
  chat. Silent removal means that person never helps again.
- An offer opens a **chat**. No phone number moves without the person handing
  it over themselves.

### 6.3 Closing without a named helper

Owner's ruling, and it closes a real trap. Off-app helpers cannot be credited
(no strangers enter the system), but Fatima's nephew will often be the one who
does it. Without a way out she either credits someone who didn't help or
leaves it open and keeps receiving offers.

So: a **Close** action on your own help post.

- Close it plainly → "Fatima says this is sorted."
- Or add a line — "my nephew did it" → that shows instead.

Either way the offers stop. **Delete stays available but is not the default** —
deleting is the rude option.

### 6.4 The incomplete-profile line

When the asker has not finished their profile, helpers see a small grey line
above the button: **"New here — hasn't finished their profile yet."**

Factual. No adjective, no red, no warning triangle, never the word "beware".
The helper draws their own conclusion. Anything stronger makes every new
member look like a threat, and new members are the people who most need help.

### 6.5 Sharing a help post outward

A shareable link exists. **It shows the text and nothing else** — no profile,
no location, no way to reach the person except through the app. The link
carries someone's difficulty; it must not carry their address.

### 6.6 Reach

Starts at the neighbourhood and widens by the same rules as the feed. The
poster chooses, with the neighbourhood as the default.

### 6.7 Two things that must not exist

- **No counter of unanswered requests**, anywhere, ever. That is a scoreboard
  of neglect.
- **Buddies do see help requests from their allotted Icons** (owner's ruling).
  Nothing about this may be surfaced to the Icon as monitoring.

### 6.8 Lifetime

A done help post stays in the feed unless its creator deletes it or changes
its setting. Owner's ruling. Flagged in `00_REDESIGN_INDEX.md` §4.2 because a
permanent feed of solved problems is also a permanent record of everyone's
difficulties.

## 7. Voice posts

- **One minute maximum.** Rendered as a card with a play button.
- **Only the poster may use voice.** Replies are text and stickers. A thread
  of twenty audio clips is unlistenable, unsearchable, and unscannable by a
  moderator.

**Three costs a lane must plan for before shipping this:**

1. **Storage and bandwidth.** Audio is orders of magnitude heavier than text.
   Supabase is on the free tier and has already frozen once under six-session
   load. This may be what forces the paid tier.
2. **Moderation.** A reported voice note must be listened to, in full, in real
   time, by a volunteer moderator. Decide who does that before shipping.
3. **It is invisible to search** and unreadable in a noisy room. Voice is an
   addition to the feed, never the only way to say something.

## 8. Stickers

Sourced, not commissioned — owner's ruling, and it is faster and cheaper.

**One filter a lane must apply:** the licence must permit redistribution
inside an application (CC0, or a purchased commercial licence).
Free-to-download is not free-to-ship. Verify per pack, record which licence,
and keep the record in the repo.

## 9. The two sheets

Both rise from the bottom. Both come from the reconnect row
(`NAVIGATION_SPEC.md` §4.3), and "Play something" also from inside a chat.

### 9.1 Say hello

**Not an instant send.** A sheet with a message **already written** in the box,
cursor in it, editable, Send beneath. Mic and photo glyphs beside Send.

Nothing sends until Send is pressed. Sending closes the sheet and **opens the
chat with the message in it**. Closing the sheet means nothing happened.

**The suggested line must rotate** — three or four written variants. Otherwise
Nasreen receives the identical sentence from four different people and it
reads as a robot.

### 9.2 Play something

Same shape. The games you both play, one tap each. A sub-line gives a reason
where one exists — "You played this together in May".

Tapping a game **creates the table with her seat held, sends the invite, and
lands you on the board.** No menu, no confirm step. She gets a notification
that opens straight into the seat.

## 10. Post menus

Both grow **out of the three dots** (`MOTION_SPEC.md` §7).

### 10.1 Your own post

Pin to your profile · Change who can see it (showing current value) · Edit ·
Turn off replies to this · Copy link · — · **Delete** (the only red item,
alone under a divider).

### 10.2 Someone else's post

Save this · Tell me about replies · Copy link · — · Hide this post ·
**Show less from {name}** · **Report this**.

Two wordings that matter:

- **"Show less from Tariq", with a sub-line "He won't know."** Not "Mute", not
  "Unfollow". The fear that the other person finds out is what stops people
  using these controls. Reversible from Settings.
- **No Block in this menu.** Blocking a neighbour is a serious act and belongs
  on their profile, after a moment's thought — not one tap from a feed.

## 11. Sharing lands on the post

Press Share → the composer closes → the feed scrolls to the top → the post is
there with a coloured bar down its left edge, fading after ~3 seconds.

**No toast. No "Shared ✓". No "Posted successfully."**

`AUDIT_11.md` has already found that most of the app lands on its result and
then fires a toast anyway, and that the §11 fix is usually **deleting the
toast**. This is that, applied to the composer. `FEEDBACK.md`'s `useFresh`
highlight is the mechanism — it exists and works; the toast beside it goes.

The highlight is **tied to the action, not stored.** Coming back to the app
later must not show a still-highlighted post.

### 11.1 When a post lives in two places

An event post is the primary object; the event card inside it is the same
thing rendered small. A line at the foot of the post says the second place it
lives and takes you there: **"Also sitting in Out and about — See it there."**

Honest, and it offers the door rather than hiding the duplication.

### 11.2 When a post fails to send

Your users will have bad signal. The post renders greyed with a **Retry**, and
**the words come back**. This already works — `FEEDBACK.md` verifies it on a
throttled connection, including the draft returning to the composer. Do not
regress it, and make sure it covers a recorded voice note, which is far more
expensive to lose than typed text.
