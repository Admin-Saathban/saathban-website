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
