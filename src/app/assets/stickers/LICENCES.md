# Sticker licences

POSTS_SPEC.md §8 requires a per-pack record of the licence, kept in the
repo, because **free-to-download is not free-to-ship**: a great deal of
sticker art may be downloaded and even used in mockups but may not be
redistributed inside an application, which is exactly what shipping it in
a bundle does.

This file is that record. One entry per pack, and a pack with no entry
here must not be imported.

---

## Pack: `saathban-original` — the set in `stickers.jsx`

| | |
|---|---|
| **Stickers** | 26 |
| **Format** | Inline SVG, drawn as JSX paths in `stickers.jsx` |
| **Source** | **Authored in this repository.** Not downloaded, not purchased, not traced from third-party art. |
| **Licence** | Owned by the project. No third-party terms apply. |
| **Redistribution inside the app** | Permitted — there is no external rights-holder to permit or refuse it. |
| **Verified** | 2026-08-30, by reading the file: every sticker is a `<path>`/`<ellipse>` built from the brand palette in `shared/tokens.js`, and the two Nastaliq text stickers use the Noto Nastaliq Urdu webfont the app already loads. |

**A note on the font, because it is the one third-party thing here.** The
Nastaliq stickers render text in Noto Nastaliq Urdu, which the app loads
from Google Fonts and does not embed or redistribute. Noto is SIL Open
Font License 1.1, which permits use in an application. If a sticker is
ever rasterised and shipped as an image file, that becomes embedding and
the OFL terms should be re-read first — a rendered glyph in an SVG the
browser draws at runtime is not the same act as a PNG in the bundle.

---

## No third-party pack has been added, and why

§8's ruling is to **source** rather than commission, and this set was in
practice commissioned — drawn for the project rather than found. Sourcing
one would be cheaper and faster for the next set, and the ruling stands.

It was not done tonight because **verifying a licence is not something
this lane can honestly complete**. "CC0" on a download page is a claim by
whoever uploaded the file, not a warranty; packs are routinely re-uploaded
to aggregator sites with the original terms stripped; and the failure mode
is not a bug but a rights claim against the charity, months later, over
artwork nobody can now trace. That verification needs a person who can
accept the risk on the project's behalf.

So the position is:

- The set that ships today is safe to ship, for the strongest possible
  reason: the project owns it outright.
- Adding a sourced pack is a good idea and cheap **once somebody has
  confirmed the licence** — CC0 with a traceable original, or a purchased
  commercial licence with a receipt kept beside this file.
- Whoever adds one must add a row here first: pack name, where it came
  from, the exact licence, a link to the licence text as it stood on the
  day, and who verified it.

## Adding a pack — the checklist

1. Find the ORIGINAL publisher, not an aggregator mirror.
2. Read the licence text itself, not the download page's summary.
3. Confirm it permits redistribution **inside an application**, not merely
   personal or editorial use.
4. If it requires attribution, decide where that attribution appears in
   the app before importing anything.
5. Save the licence text into this folder next to the assets.
6. Add a row above, with the date and the name of the person who checked.

---

## Sourcing review — 31 August 2026

§8 says to source a pack rather than commission one. This is the review,
including the packs that were REJECTED, because a record that only lists
what was chosen cannot be checked by the next person.

**The npm `license` field is not the artwork's licence.** For emoji packs
it describes the wrapper code, and it is wrong often enough to be a trap:

| package | npm says | the artwork actually is | verdict |
|---|---|---|---|
| `emoji-datasource` | MIT | Apple / Google / Twitter artwork, **not redistributable** | **reject** |
| `twemoji` | MIT | CC-BY 4.0 (`LICENSE-GRAPHICS`) | usable with attribution |
| `openmoji` | CC-BY-SA-4.0 | CC BY-SA 4.0 — **share-alike** | avoid |
| `microsoft/fluentui-emoji` | MIT | MIT, confirmed in the repo's own `LICENSE` | **compliant** |

Each verdict above was read from the project's own licence file, not from
package metadata. `emoji-datasource` is the reason: it declares MIT and
ships artwork nobody may redistribute, which is precisely the
free-to-download-is-not-free-to-ship failure this file exists to prevent.

### Recommended: Microsoft Fluent Emoji

MIT, verified at `github.com/microsoft/fluentui-emoji/LICENSE`. Permits
redistribution inside an application; requires the MIT notice to ship
with it.

**It is MIT, not CC0.** §8 asks for "CC0 or a purchased commercial
licence". MIT meets the stated *rule* — it permits redistribution inside
an application — but it is neither of the two named examples, and it
carries a notice obligation CC0 does not. That difference is the owner's
to accept, so it is written down rather than quietly treated as
equivalent.

### Why the art was NOT swapped tonight

`stickerRef()` writes `:sticker/<id>:` into the body of a comment or a
message, so **every sticker anyone has ever sent is stored as its id**.
Replacing the set is therefore not an art change; it is a data change.
It is safe only if the id set is preserved exactly, which means mapping
26 authored concepts onto a third-party pack one by one and accepting
its nearest equivalent for each.

That is a decision about how the app looks and what those 26 things
mean, not a licensing question, and the current set is already
compliant — project-owned, no external rights-holder. So the sourcing
question is answered and recorded here; the swap is left for the owner.
