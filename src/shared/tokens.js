/* ════════════════════════════════════════════════
   Brand tokens — the single source of truth for
   colour and type across BOTH the marketing site
   (src/App.jsx) and the app (src/app/).

   Nothing here is app-specific or marketing-specific.
   Do not hardcode a hex or a font stack anywhere else.
   ════════════════════════════════════════════════ */

// ─── Colour ───
// Exported as COLORS; the marketing site imports it as `C`, which is what
// every style object in src/App.jsx already references.
export const COLORS = {
  cream: "#FAF3E9", brown: "#573425", green: "#063214",
  greenLight: "#0a4a1e", greenMuted: "#2a5e3a", brownLight: "#7a5443",
  olive: "#637354", sage: "#8fa67e", warmGray: "#d4cdc4",
  bg: "#FAF3E9", white: "#FFFFFF", dark: "#1a1a1a",
  textMain: "#2d2418", textMuted: "#6b5e52", accent: "#573425",
  // Form validation only. Never the only signal — always pair the colour
  // with words (SPEC.md: no dependence on colour alone).
  error: "#8C2F22",
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
  ground:  "#F2F3F5",   // the floor
  content: "#FFFFFF",   // posts, chats, cards, sheets
  tint:    "#FBF0E6",   // comments, replies, quoted material
  nav:     "#F7F9F7",   // header and bottom bar
  navEdge: "#E1E7E1",   // the hairline that does the real work
  pressed: "#E8EDE8",   // touched, or the row you are on
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
  confirmed: "#0B5D2A",  // done, going, yes — the app accent
  warning:   "#B26A00",  // amber that still passes on white
  danger:    "#B3261E",  // destructive, and always worded
  rest:      "#65676B",  // line-art at rest: the muted ink
};

export const APP_COLORS = {
  /* the ground and the surfaces — the named ladder above, reachable as
     C.ground / C.surface / C.tint / C.nav / C.pressed in every file
     that already imports APP_COLORS as C. No new import, so adopting
     the system is an edit to the style object and nothing else. */
  ground:  SURFACE.ground,
  surface: SURFACE.content,
  tint:    SURFACE.tint,
  nav:     SURFACE.nav,
  navEdge: SURFACE.navEdge,
  pressed: SURFACE.pressed,

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
  green: "#0B5D2A",
  greenLight: "#0E7536",
  greenMuted: "#3F7A55",
  sage: "#0B5D2A",         // was a second green; collapsed onto the accent
  olive: "#65676B",        // was a third; it was never an accent, it was a label
  accent: "#0B5D2A",

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
export const A11Y = {
  minBodyPx: 16,
  minTapTargetPx: 44,
};
