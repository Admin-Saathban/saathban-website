# Saathban stickers — adoption recipe

`src/app/assets/stickers/` owns the brand sticker set: 26 warm SVGs in
the palette (chai, roses, dua hands, the sprout, crescent, Nastaliq
calligraphy words — MashaAllah / Shabash / Jeetay Raho / Wah Wah /
Salaam / Shukriya — and game reactions for captures, wins, near-misses
and gentle teasing). Currently wired: **Ludo game chat** and **people DM
threads**. Groups / community DMs / rails session chat: three lines each,
below.

## Wire protocol

A sticker is an ordinary text message whose body is `:sticker/<id>:`
(`stickerRef(id)`), so it fits `dm_messages`, `game_messages`, and group
post bodies with **no migration**. Clients that haven't adopted yet show
the sentinel text — harmless, readable, and a nudge to adopt.

## Adopting a surface

```jsx
import StickerPicker from "../../assets/stickers/StickerPicker.jsx";
import { Sticker, parseStickerRef, stickerRef } from "../../assets/stickers/stickers.jsx";

// 1. send:              onPick={(id) => send(stickerRef(id))}
// 2. render, per message:
const stickerId = parseStickerRef(m.body);
{stickerId ? <Sticker id={stickerId} size={96} /> : <Text …>{m.body}</Text>}
// 3. picker toggle:     {open && <StickerPicker onPick={…} label={t("…")} />}
```

Notes:
- Render at `size={88–110}` in bubbles — large and joyful is the point.
- Keep your surface's existing emoji-only-body large rendering for the
  older emoji stickers already in the database.
- Wide (calligraphy) stickers size themselves 140:96 at the same height;
  no layout care needed beyond `maxWidth: 100%`.
- Labels are bilingual on the set itself; the picker aria-labels follow
  the active language automatically. RTL-safe: the grid mirrors under
  `dir=rtl` and the Nastaliq text inside the SVGs is `direction="rtl"`
  with a middle anchor.
- The rails' `game_messages.sticker` column (fixed 8-emoji set) keeps
  working independently; this set rides `body`.
