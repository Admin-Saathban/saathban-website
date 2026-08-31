/* ════════════════════════════════════════════════
   Brand tokens — the single source of truth for
   colour and type across BOTH the marketing site
   (src/App.jsx) and the app (src/app/).

   Nothing here is app-specific or marketing-specific.
   Do not hardcode a hex or a font stack anywhere else.
   ════════════════════════════════════════════════ */

/* ─── Colour: THE MARKETING PALETTE ───

   EVERY KEY HERE IS PREFIXED `site`, AND THE TWO COLOUR OBJECTS IN
   THIS FILE MAY NEVER AGAIN SHARE A KEY NAME. That is a rule, not a
   style, and it exists because sharing them cost real defects:

     - the probation chip sat at 2.08:1, less than half the AA floor,
       on the control that says whether a volunteer may be alone with
       an isolated person. It read as safe because the key was named
       `sage` and sage HAD been a pale green;
     - screens came out brown after the app palette turned neutral,
       because `brown` went on being called brown while holding ink;
     - own-message bubbles diverged into four different colours across
       four files, nobody able to see it from inside any one of them.

   Each of those is the same fault: A NAME THAT OUTLIVED ITS VALUE.
   Two objects with identical keys made every call site ambiguous to
   the reader — `C.cream` said nothing about WHICH cream, so a value
   could change under a name and no one reviewing a diff would see it.

   The prefix makes the object visible at the point of use. `C.siteBrown`
   in src/App.jsx cannot be confused with the app's `C.brown`, and a
   marketing colour that drifts into src/app/ is now a name that does
   not resolve rather than a colour that quietly looks wrong.

   APP_COLORS keeps its unprefixed keys: the app is much the larger
   consumer, and renaming there would be 171 files of churn for the
   same guarantee this side already provides.

   Imported as `C` by src/App.jsx and src/shared/eventsData.js, which
   are its only two consumers. */
export const COLORS = {
  siteCream: "#FAF3E9", siteBrown: "#573425", siteGreen: "#063214",
  siteGreenLight: "#0a4a1e", siteGreenMuted: "#2a5e3a", siteBrownLight: "#7a5443",
  siteOlive: "#637354", siteSage: "#8fa67e", siteWarmGray: "#d4cdc4",
  siteBg: "#FAF3E9", siteWhite: "#FFFFFF", siteDark: "#1a1a1a",
  siteTextMain: "#2d2418", siteTextMuted: "#6b5e52", siteAccent: "#573425",
  // Form validation only. Never the only signal — always pair the colour
  // with words (SPEC.md: no dependence on colour alone).
  siteError: "#8C2F22",
};

/* ─── The APP's palette — PRODUCT_DECISIONS §0.5 ───

   The owner's ruling of 30 August: the app does not follow the
   Saathban colour scheme. Cream, the warm browns and the serif belong
   to the marketing site and the logo, not to something a person opens
   every morning. COLORS above is untouched and is still the site's —
   src/App.jsx imports it from this same file, so the two now disagree
   about colour ON PURPOSE.

   SAME KEY NAMES AS COLORS, deliberately. Every screen in src/app/
   already reads `C.bg`, `C.warmGray`, `C.cream`; keeping the shape
   means the switch is one imported symbol per file rather than a
   rewrite of nine hundred style objects. Keys that named a warm colour
   now hold a neutral — `cream` is white, `brown` is ink. The names are
   wrong and the values are right, which is the correct trade for one
   night: renaming them across 175 files is a separate, mechanical pass.

   ONE ACCENT. Green marks the thing you are meant to do next and
   nothing else. A screen with four green elements has no accent. */
/* ─── SURFACE TONES ───

   The app went from cream-everything to white-everything, and the
   second is worse: with one surface doing every job, nothing tells a
   region from the region next to it. A post, the bar it sits under and
   the comment attached to it were all #FFFFFF, so the eye had only
   position to go on.

   FIVE TONES, AND THEY ARE A LADDER, not a palette. Each one is a
   step of separation, not a decoration:

     ground   what shows BETWEEN things. Cards float on it.
     content  the thing itself — a post, a chat bubble, a card.
     tint     material attached to content: comments, replies, quoted
              text. Warm, so it reads as a response rather than as a
              second post.
     nav      chrome — header and bottom bar. Distinct from content
              because it is not content: it is the frame around it.
     pressed  the moment of touch, and the resting state of the thing
              you are currently on.

   THE TINT IS ONE VALUE. It arrived three times over — #FBF0E6 in
   messages, #f3e9df in circle, fam and groups, #F5EEE6 in people —
   three creams nobody chose, each a shade off the others, which is how
   a system dies. Lane 3's is the one that stays. Wherever a warm band
   means "attached to the thing above it", it is this and only this.

   NAV IS NOT BRANDED. A grey-green a hair off white, plus a hairline.
   Colouring the chrome green would make the bar the loudest object on
   every screen, and the bar is furniture. If the hairline alone reads
   clearly enough on a real phone, the tint can go and the hairline can
   stay — that is the direction to fail in, not the other one. */
export const SURFACE = {
  ground:  "#EFF3EE",   // the floor — a soft sage tint, not a grey
  content: "#FFFFFF",   // posts, chats, cards, sheets
  tint:    "#FBF0E6",   // comments, replies, quoted material
  /* THE CHROME IS DARK NOW. Header and bottom bar both. A near-black
     frame stops the chrome competing with content for the eye at all,
     rather than competing quietly at one step of lightness — and it is
     what makes the active tab's accent chip readable as a position
     marker instead of one more pale thing among pale things. */
  nav:       "#1B1E22",  // header and bottom bar
  navInk:    "#F2F3F5",  // labels and resting icons on the dark chrome
  navActive: "#7FD99A",  // the tab you are on, where accent-on-dark would sink
  navEdge:   "#2A2E33",  // the hairline, now a lift rather than a shadow
  pressed: "#E8EDE8",   // touched, or the row you are on

  /* THE ONE SURFACE THAT CARRIES A HUE, and it earns it: this is the
     app saying yes. The option you chose, the switch that is on, the
     panel for a thing that is done, the person who is present.

     Lane 4 asked for it rather than guessing, and asking was right —
     neither of the two nearest tokens fits. `tint` is cream and would
     look wrong beside the green border these always carry; `pressed`
     is grey-green and would flatten the affordance on a screen whose
     whole task is choosing one of two.

     IT WAS ALREADY FIVE COLOURS: #EEF3E8 (29 uses), #eef3ea (8),
     #e8f0e6 (6), #f4f7f1 (5), #EAF2E3 (2) — the cream problem again in
     the green family, fifty uses deep, and Lane 4 caught their own
     sixth on the way to becoming a seventh. The majority value wins,
     the same rule that settled the cream: adopt what is already there
     rather than mint something nobody has seen.

     SELECTION AND COMPLETION SHARE IT DELIBERATELY. They are the same
     affirmative family, and giving them two identical values under two
     names is exactly how five creams happened. What tells them apart is
     the border and the words, which differ already. */
  /* MOVED WITH THE GROUND, and it had to be. #EEF3E8 sits a distance
     of 6 from the new #EFF3EE ground — indistinguishable, so every
     chosen option, every switch that is on and every done panel would
     have quietly stopped reading as chosen. Retuned to the new accent's
     family: distance 21 from the ground, 5.28:1 under accent ink.

     The brief did not name this token. It did not have to: changing the
     ground changes what every wash ON the ground is worth, and a value
     that survives a palette change unexamined is exactly how `sage`
     ended up meaning solid accent. */
  selected: "#DCEDE7",

  /* WHOSE MESSAGE THIS IS — authorship, not affirmation.

     Lane 4 asked whether their own-message bubble should take
     `selected` because the hex sits a few points away, and answered
     their own question correctly: no. Authorship is identity. It is not
     the option you chose, the switch that is on, or a thing that is
     done, and mapping it on hex proximity is how a token stops meaning
     anything. It is a real job, so it gets a real name.

     THE APP HAD FOUR ANSWERS FOR IT: solid C.green in DMs and in game
     chat, C.sage in voice notes (which now IS green, having been
     collapsed onto the accent), and this pale wash in group chat. Your
     own message looked like a different concept depending on which
     chat you were standing in.

     THE PALE WASH WINS, AND NOT BY VOTE — it lost 3–1. Two reasons,
     both already written down elsewhere in this file and in SPEC:

     ONE ACCENT (line 41). Green marks the thing you are meant to do
     next and nothing else. A chat is a column of your own messages, so
     solid green makes half the screen the accent colour and the accent
     stops meaning anything precisely where a Send button needs it.

     INK ON LIGHT — AND THIS IS TYPOGRAPHY, NOT A CONTRAST FLOOR.

     I first wrote this as an accessibility argument: that cream on
     dark green at the 16px floor breached a floor that only held in
     English. Lane 3 measured it and it does not. #FFFFFF on #0B5D2A is
     8.04:1 — AAA, not merely AA — against 14.35:1 for ink on this
     wash. The new pairing is better; the old one was never failing.

     The real reason is sound and is not a ratio: light-on-dark makes
     strokes bloom and read thinner, and Nastaliq has less stroke to
     lose than Latin. Argued as a floor it was checkable and false,
     which would have handed the next person a reason to dismiss a
     ruling that is correct on the accent rule alone.

     A wrong reason for a right answer is worse than no reason: it
     survives exactly until somebody checks it, and takes the answer
     with it. */
  mine: "#DCEDE7",   // own-message bubble; same wash as `selected`, retuned with it

  /* ── THE COMMENT PAIR ── owner-specified, and a PAIR on purpose.

     A comment is not a warm aside, it is a different voice, and it now
     says so in a cool wash with a rule down its inline-start edge:
     2.5px of `commentRule` and a 10px indent, which is the shape a
     quoted reply has had since email. Lane 3 consumes both for the DM
     thread; the feed's comment band uses them too, so the two places a
     person reads replies finally match.

     THIS IS NOT A REVISION OF `tint`. tint (#FBF0E6) stays warm and
     stays what it was — attached material that is not a reply: the help
     panel, the pending-request card, the SOS pill. Cool for another
     voice, warm for more of the same thing. */
  comment:     "#EBF0F4",
  commentRule: "#8FA6BC",
};

/* ─── WHAT A COLOUR MEANS ───

   Semantic colour came off the icons when the emoji did, and it should
   not have: the emoji were the problem, not the colour. A line-art
   heart that stays grey after you press it does not tell you it worked.

   So: DRAWN ALWAYS, COLOURED WHEN IT MEANS SOMETHING. At rest an icon
   is grey line-art. Active, it takes the colour of what it now means —
   a liked heart is red, a confirmed check is green, a warning is amber.

   Never colour alone (SPEC, accessibility): every one of these is
   paired with a fill, a word, or a state change as well. Red on a heart
   is the second signal, not the only one. */
export const MEANING = {
  liked:     "#E0245E",  // a heart you have pressed
  confirmed: "#0E6B5C",  // done, going, yes — the app accent, moved with it
  warning:   "#B26A00",  // amber that still passes on white
  danger:    "#B3261E",  // destructive, and always worded
  rest:      "#65676B",  // line-art at rest: the muted ink

  /* ── WHAT EACH REACTION MEANS WHEN IT IS ON ──

     I ruled the opposite of this a few hours ago: that only the heart
     earns a colour of its own and the other three keep the accent,
     because inventing three colours would be brand noise wearing the
     costume of meaning. The owner has since picked all four from a live
     comparison, which is a better instrument than my argument — they
     looked at it. Four named colours, one owner, no hexes at call
     sites.

     Lane 3 asked for these by name before building against them rather
     than writing the hexes down and sweeping later. That is the right
     instinct and it is why they are here: a raw hex beside a token name
     that will exist tomorrow is precisely how COLORS.cream and
     APP_COLORS.cream came to mean two different colours. */
  thumb:     "#1877F2",
  flower:    "#E91E8C",
  hands:     "#F5A623",
};

export const APP_COLORS = {
  /* the ground and the surfaces — the named ladder above, reachable as
     C.ground / C.surface / C.tint / C.nav / C.pressed in every file
     that already imports APP_COLORS as C. No new import, so adopting
     the system is an edit to the style object and nothing else. */
  ground:  SURFACE.ground,
  surface: SURFACE.content,
  tint:    SURFACE.tint,
  nav:       SURFACE.nav,
  navInk:    SURFACE.navInk,
  navActive: SURFACE.navActive,
  navEdge:   SURFACE.navEdge,
  comment:     SURFACE.comment,
  commentRule: SURFACE.commentRule,
  pressed: SURFACE.pressed,
  selected: SURFACE.selected,
  mine: SURFACE.mine,

  bg: SURFACE.ground,     // older name for the ground; same value
  white: SURFACE.content,  // older name for a content surface
  cream: SURFACE.content,  // was the warm ground; now simply a surface

  /* ink */
  textMain: "#1C1E21",
  textMuted: "#65676B",
  brown: "#1C1E21",        // was warm ink; now the same ink as everything
  brownLight: "#65676B",
  dark: "#1C1E21",

  /* the one accent: Saathban green, and its two working shades */
  /* ONE ACCENT, AND IT IS TEAL NOW. #0B5D2A everywhere it appeared:
     buttons, active states, Send, links. green/accent/sage are the same
     value and always were — see the header note about names outliving
     values — so all three move together rather than leaving one of them
     pointing at the old brand green for something to drift back onto. */
  green: "#0E6B5C",
  greenLight: "#12836F",
  greenMuted: "#3F8A7C",
  sage: "#0E6B5C",         // was a second green; collapsed onto the accent
  olive: "#65676B",        // was a third; it was never an accent, it was a label
  accent: "#0E6B5C",

  /* lines and dividers — neutral, and used far less than they were */
  warmGray: "#DADDE1",

  /* the only colour allowed to mean something on its own is none of
     them: an error is always paired with words (§0.1) */
  error: "#B3261E",
};

/* The APP's type — PRODUCT_DECISIONS §0.5. A system stack, and NO
   SERIF ANYWHERE. Playfair is the brand's voice on a page somebody
   reads once; it is not the face for a log a person fills in every
   morning. The system stack also means no webfont on the critical path
   and the shapes a person already reads everywhere else on their
   phone. */
export const APP_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// ─── Type ───
// serif  — headings, pull quotes, anything with a voice
// sans   — body copy, UI chrome, form controls
// quote  — the oversized decorative " glyph only
export const FONTS = {
  serif: "'Playfair Display', serif",
  sans: "'DM Sans', sans-serif",
  quote: "Georgia, serif",
};

// The union of every weight the marketing site loads across its three
// <style> blocks, for the app to import once.
//
// NOTE: the marketing site still carries its own three @import lines with
// narrower weight sets. They are deliberately left alone — collapsing them
// onto this URL would add weights those pages do not currently load, which
// is a rendering change. Worth unifying, but as its own reviewed step.
export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap";

/* ─── Accessibility floors ───

   AMENDED 30 AUGUST 2026 — 00_REDESIGN_INDEX §2.1, which changes
   principle 9. Was 18px body and 48px targets everywhere; now 16px
   body and 44px targets outside games.

   THIS IS NOT A RELAXATION OF THE PRINCIPLE, IT IS A RELOCATION OF
   IT. The 18px floor was the single largest reason the app fitted
   about a third of what Facebook fits on one screen, and density was
   the owner's loudest complaint. A 75-year-old who needs 20px still
   gets 20px — from the text size control in Settings, which is four
   steps from 1.0 to 1.5 — rather than it being imposed on everyone
   who does not. Someone who was comfortable at the old default now
   picks "Large" (16 × 1.15 ≈ 18.4px) once, and it is remembered.

   THE CONSEQUENCE IS A TESTING OBLIGATION, and it is the reason this
   comment is here rather than a one-line edit: every screen must be
   looked at at every size. A size setting nobody tested is how
   Nastaliq ends up overlapping, because Urdu needs a taller line box
   than Latin at the same nominal size and 1.5× multiplies the
   difference rather than the text.

   Inside a game screen neither floor applies —
   GAMES_IMMERSION_SPEC §3. */
/* ─── ICON CHIPS ("alive", I2) ───

   Every header and bar icon sits in a soft rounded chip. At rest the
   chip is a whisper; on the dark chrome it is a white film. The tab you
   are ON fills its chip with the accent and turns its icon white, so
   position is carried by a shape you can find without reading.

   TWO OF THEM KEEP THEIR OWN COLOUR because they are landmarks rather
   than states: the bell is bronze and Messages is blue. Those are the
   two icons people hunt for, and hunting is easier when the thing has a
   colour of its own. Everything else is ink.

   Exported so the chip is a shared treatment. The whole point of I2 is
   that it is one component's behaviour — a lane building its own chip
   is five chips again, which is the road this palette was rescued from.

   Non-text contrast (WCAG 1.4.11) needs 3:1. On the dark chrome bronze
   measures 4.28:1 and blue 3.79:1 against #1B1E22; both clear it, and
   both are paired with a label besides. */
export const CHIP = {
  restLight: "rgba(14,107,92,0.08)",   // on a light surface
  restDark:  "rgba(255,255,255,0.14)", // on the dark chrome
  activeInk: "#FFFFFF",                // icon inside the accent-filled chip
  bronze:    "#A8781F",                // the bell
  bronzeBed: "rgba(168,120,31,0.18)",
  blue:      "#2E7CC0",                // Messages
  blueBed:   "rgba(46,124,192,0.18)",
  radius:    14,
};

export const A11Y = {
  minBodyPx: 16,
  minTapTargetPx: 44,
};
