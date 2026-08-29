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
  olive: "#6b7c5e", sage: "#8fa67e", warmGray: "#d4cdc4",
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

// ─── Accessibility floors (SPEC.md: hard requirement, not a later pass) ───
// Minimums, not defaults — going above these is fine, below is not.
export const A11Y = {
  minBodyPx: 18,
  minTapTargetPx: 48,
};
