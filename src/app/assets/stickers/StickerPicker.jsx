/* The shared sticker picker — one grid for every chat surface.
   Cells are ≥56px tap targets; each carries a bilingual aria-label
   picked by the active language. Tapping calls onPick(id); the caller
   sends stickerRef(id) as the message body (STICKERS_WIRING.md). */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { STICKER_SET, Sticker } from "./stickers.jsx";

export default function StickerPicker({ onPick, label }) {
  const { lang } = useI18n();
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
        gap: 4,
        background: C.white,
        border: `1.5px solid ${C.warmGray}`,
        borderRadius: 16,
        padding: 8,
        maxHeight: "34vh",
        overflowY: "auto",
      }}
    >
      {STICKER_SET.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.id)}
          aria-label={lang === "ur" ? s.ur : s.en}
          title={lang === "ur" ? s.ur : s.en}
          style={{
            minHeight: 64,
            minWidth: A11Y.minTapTargetPx,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: `1.5px solid transparent`,
            borderRadius: 12,
            cursor: "pointer",
            padding: 4,
          }}
        >
          {/* Wide (calligraphy) stickers scale to fit the cell width. */}
          <Sticker id={s.id} size={s.wide ? 38 : 52} />
        </button>
      ))}
    </div>
  );
}
