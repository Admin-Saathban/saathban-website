/* ════════════════════════════════════════════════
   The board you play on — chosen at setup, by the host, for everyone.

   Four little boards rather than four words. The swatch IS the thing
   you are choosing, drawn from the same tokens the table will use, so
   the choice and its consequence are the same object — the argument
   the colour gotis make one row further up this screen.

   LOCKED IS A DOOR, NOT A WALL. An unearned theme is shown, dimmed,
   with the number of tables still to play. Never a price, never a
   padlock alone, and never hidden: hiding it would mean nobody
   discovers there is anything to earn, and a padlock alone says "no"
   where the honest sentence is "not yet, and here is how far".

   Earned-ness is DERIVED from finished tables — nothing is stored, so
   there is nothing to mint, spend or lose. See themes.js.

   STATE IS NEVER COLOUR ALONE: the chosen board carries a ring AND a
   tick AND the word; a locked one carries reduced contrast AND a line
   of text. Somebody who cannot separate the swatches by hue still has
   two other signals.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { THEMES, THEME_ORDER, themeUnlocked, tablesUntil } from "./themes.js";

/* A tiny board: the theme's ground, its frame, and a hint of the four
   seats so it reads as a ludo board rather than as a paint chip. */
function Swatch({ theme, size = 46 }) {
  const cell = size / 5;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: theme.ground,
        border: `2px solid ${theme.frame}`,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        placeItems: "center",
        padding: cell * 0.35,
        gap: cell * 0.3,
        flexShrink: 0,
        boxShadow: `0 1px 4px ${theme.glow}`,
      }}
    >
      {["#F6BE00", "#1565C0", "#B4201A", "#0A8340"].map((c) => (
        <span
          key={c}
          style={{ width: cell, height: cell, borderRadius: 3, background: c, opacity: 0.9 }}
        />
      ))}
    </span>
  );
}

export default function ThemePicker({ value, onPick, gamesFinished = 0 }) {
  const { t, ts } = useI18n();

  return (
    <div style={{ margin: "4px 0 18px" }}>
      <p
        style={{
          fontSize: ts(15),
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: C.olive,
          margin: "0 0 8px",
          textAlign: "center",
        }}
      >
        {t("games.setup.themes.label")}
      </p>

      <div
        role="radiogroup"
        aria-label={t("games.setup.themes.label")}
        style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}
      >
        {THEME_ORDER.map((key) => {
          const theme = THEMES[key];
          const open = themeUnlocked(key, gamesFinished);
          const left = tablesUntil(key, gamesFinished);
          const chosen = value === key;
          const name = t(`games.setup.themes.${key}`);
          const lockLine =
            left === 1 ? t("games.setup.themes.lockedOne") : t("games.setup.themes.locked", { n: left });

          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={!open}
              onClick={() => open && onPick(key)}
              className={open ? "sb-pressable" : undefined}
              aria-label={
                open ? name : t("games.setup.themes.lockedAria", { name, n: left })
              }
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minHeight: A11Y.minTapTargetPx + 26,
                minWidth: 74,
                padding: "8px 6px",
                borderRadius: 16,
                border: chosen ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
                background: chosen ? "#EEF3E8" : C.white,
                fontFamily: "inherit",
                cursor: open ? "pointer" : "default",
                /* Dimmed, not hidden — and never so dim that the name
                   drops under the contrast floor. */
                opacity: open ? 1 : 0.62,
              }}
            >
              <Swatch theme={theme} />
              <span style={{ fontSize: ts(15), fontWeight: 700, color: C.textMain }}>
                {chosen ? "✓ " : ""}
                {name}
              </span>
              {!open && (
                <span style={{ fontSize: ts(13), color: C.textMuted, lineHeight: 1.3 }}>
                  {lockLine}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
