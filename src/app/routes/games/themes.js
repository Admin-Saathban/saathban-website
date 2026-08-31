/* ════════════════════════════════════════════════
   Table themes (backlog C1) — the surface a table is played on.

   The host picks one at setup and it applies to everyone at that
   table, because a theme is a property of the TABLE rather than of a
   person: two players looking at the same board must see the same
   board, or "the red one, three up from you" stops being a sentence
   anyone can say.

   HOW IT TRAVELS. `house_rules.table_theme`, exactly like
   `seat_colours` and `dice_count` — chosen at setup, stored verbatim
   by create_game_session, frozen into `state.rules` when the game
   starts. No schema, and no way for a theme to change under a player
   mid-game.

   WHAT IS EARNED, AND WHAT THAT MUST NEVER BECOME. Two themes are
   free and the rest are earned by playing. There is no price, no
   catalogue, and nothing to spend: an earned theme is a threshold
   reached, not a purchase made. Anything in this file that starts to
   look like a shop has gone wrong — see the backlog's standing rules,
   and POINTS.md on why this app derives what it can rather than
   storing a balance somebody could be tricked into decrementing.

   COLOURS COME FROM THE PALETTE, NEVER FROM A LITERAL. The seat
   palette has moved three times in a day. A theme that hardcoded
   "#FFD23F" would have silently disagreed with the board on each of
   those days, so the seat-derived parts are read from seatColors.js
   and only the SURFACE — wood, stone, night — is a theme's own.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C } from "../../../shared/tokens.js";

/* Every theme supplies the same token set. The board and its
   surroundings read these and nothing else, so adding a theme is
   adding one entry here — never a branch anywhere else. */
export const THEMES = {
  classic: {
    key: "classic",
    free: true,
    /* The board as it has always been: warm cream, brand green. */
    ground: C.cream,
    surround: C.bg,
    frame: C.warmGray,
    ink: C.textMain,
    inkMuted: C.textMuted,
    glow: "rgba(74,58,34,0.20)",
    /* LUDO_MOTION_SPEC §1: track cells are WHITE with thin dark
       gridlines — high contrast, easy for old eyes, not tinted and not
       textured. Classic means the board as it has always been, and §1
       moved what that is; the cream tint and the pale line below were
       the old baseline. Wood, Marble and Night are the themes that get
       to depart from it — Classic is the one that must not. */
    cell: C.white,
    cellAlt: "#FCFCFB",
    line: "rgba(58,52,42,0.55)",
  },
  wood: {
    key: "wood",
    free: true,
    /* A polished board on a table — the same warmth the carrom board
       got, so the two games feel like they live in one house. */
    ground: "#e7d3b3",
    surround: "#f2e2c6",
    frame: "#c9ad83",
    ink: "#3b2a1c",
    inkMuted: "#7a5c3e",
    glow: "rgba(90,60,25,0.28)",
    cell: "#f6ead2",
    cellAlt: "#e7d3b3",
    line: "#c9ad83",
  },
  marble: {
    key: "marble",
    free: false,
    ground: "#f4f2ee",
    surround: "#e8e6e1",
    frame: "#cfcbc3",
    ink: "#2f2c28",
    inkMuted: "#6d6862",
    glow: "rgba(60,58,54,0.22)",
    cell: "#ffffff",
    cellAlt: "#eceae5",
    line: "#cfcbc3",
  },
  night: {
    key: "night",
    free: false,
    ground: "#1e2430",
    surround: "#151a23",
    frame: "#39435420",
    ink: "#f0ece4",
    inkMuted: "#a9b0bd",
    glow: "rgba(0,0,0,0.45)",
    cell: "#273041",
    cellAlt: "#1e2430",
    line: "#3d4757",
  },
};

/* Order shown in the picker: free first, so the two anyone can use
   are the two they meet first. */
export const THEME_ORDER = ["classic", "wood", "marble", "night"];

export const FREE_THEMES = THEME_ORDER.filter((k) => THEMES[k].free);

export const DEFAULT_THEME = "classic";

/* A theme key from anywhere — house_rules, a picker, an old row —
   resolved to a real theme. An unknown or missing key is the classic
   board rather than a crash or a blank table: a session created
   before themes existed carries no key at all, and it must still
   open. */
export function themeOf(houseRules) {
  const key = houseRules?.table_theme;
  return THEMES[key] || THEMES[DEFAULT_THEME];
}

/* The CSS custom properties a themed surface sets. Applied to a
   wrapper so everything inside inherits them, which is what lets the
   board be repainted without every component learning about themes.

   The board's own SVG background is `transparent`, so the ground set
   here shows through it — that is the seam the theme travels along. */
export function themeVars(theme) {
  return {
    "--sb-table-ground": theme.ground,
    "--sb-table-surround": theme.surround,
    "--sb-table-frame": theme.frame,
    "--sb-table-ink": theme.ink,
    "--sb-table-ink-muted": theme.inkMuted,
    "--sb-table-glow": theme.glow,
    /* Interior tokens, for a board that repaints its own cells. The
       board lane reads these with a C.* fallback — var(--sb-table-cell,
       #fff) — so an unthemed table is byte-identical to before. */
    "--sb-table-cell": theme.cell,
    "--sb-table-cell-alt": theme.cellAlt,
    "--sb-table-line": theme.line,
  };
}

/* How many finished tables earn each theme. Registrar's ruling, and
   the reasoning is worth keeping next to the numbers: an unlocked
   theme is DERIVED from play and never stored.

   The test for whether a fact belongs in a table is not "is it a
   count" but "could I recompute it from what already happened". A
   theme can: it is a threshold over finished tables, and the same
   query gives the same answer for ever. A sticker cannot, because
   gifting and staking make it path-dependent — two people who played
   identical games can hold different stickers, and no query over play
   history can tell you which. So stickers get a row and themes get a
   query.

   The practical win arrives the day someone retunes a threshold. Move
   marble from 10 to 8 and derived themes simply obey; stored ones
   need a migration and a decision about everyone who unlocked under
   the old number. */
export const THEME_THRESHOLDS = { marble: 10, night: 25 };

/* Which themes this person has earned, from the number of tables they
   have finished.

   A TABLE PLAYED AGAINST BOTS COUNTS EXACTLY AS ONE PLAYED AGAINST
   PEOPLE. This is the whole point rather than an oversight: the person
   this app exists for is playing at eleven at night with nobody free,
   and a rule that only counted human tables would hand every reward to
   whoever has company. Anything else would be an audience-assuming
   feature wearing an anti-cheat costume. */
export function earnedThemes(gamesFinished = 0) {
  return THEME_ORDER.filter(
    (k) => THEMES[k].free || gamesFinished >= (THEME_THRESHOLDS[k] ?? Infinity)
  );
}

export function themeUnlocked(key, gamesFinished = 0) {
  const t = THEMES[key];
  if (!t) return false;
  return t.free || gamesFinished >= (THEME_THRESHOLDS[key] ?? Infinity);
}

/* How many more tables until this one opens — for a line that says
   what to do, rather than a padlock that says no. */
export function tablesUntil(key, gamesFinished = 0) {
  const need = THEME_THRESHOLDS[key];
  if (!need) return 0;
  return Math.max(0, need - gamesFinished);
}
