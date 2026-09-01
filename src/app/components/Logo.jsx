/* ════════════════════════════════════════════════
   The Saathban wordmark, at the size you actually ask for.

   PRODUCT_DECISIONS §1 says the logo is too small throughout the app.
   It is, and raising the CSS height was not the fix, because of what
   the file turns out to be: /logo-extended.png is a 2000×2000 square
   of cream — rgba(250,243,233), the app's own background — with the
   wordmark sitting in a band from y=692 to y=1164. The ink is 23.6%
   of the file's height and 84% of its width.

   So `height: 30` in the app header was drawing a SEVEN PIXEL
   wordmark inside a 30px cream square, and every attempt to fix it by
   raising the number mostly bought more empty cream. Measured, not
   guessed: the ink box was found by scanning the decoded image for
   pixels differing from the corner colour, since the file is opaque
   and an alpha test finds nothing.

   This component crops to that band, so `height` means the height of
   the letters. A caller asking for 28 gets 28px of wordmark instead
   of 28px of mostly-nothing.

   It is a background-image rather than an <img> because cropping an
   <img> needs a wrapper and an absolutely-positioned child, and this
   way the element IS the wordmark — one box, the right size, with the
   accessible name on it.

   If the asset is ever replaced with a tightly-cropped file, set INK
   to the new bounds (or to the whole canvas) and every call site
   follows without changing.
   ════════════════════════════════════════════════ */

/* Measured from the file itself. */
const INK = { x: 166, y: 692, w: 1677, h: 473, canvas: 2000 };

/* THE CREAM PLATE CANNOT SIT ON NEAR-BLACK, and the file gives us no
   choice about the plate: as the note above records, /logo-extended.png
   is OPAQUE — dark ink baked onto a solid cream square, with no alpha
   to knock out. Dropping it on the new #1B1E22 header would put a cream
   rectangle in the corner of every screen.

   `variant="light"` turns the wordmark white without a second asset:

     filter: invert(1) grayscale(1)   ink becomes light, cream becomes
                                      near-black; grayscale kills the
                                      magenta that inverting a dark
                                      green otherwise produces
     mix-blend-mode: screen           screen against a dark backdrop
                                      leaves near-black untouched and
                                      lets the light ink through, so the
                                      plate disappears

   It is a treatment, not a hack around a missing file, and it is
   reversible: if a tightly-cropped transparent asset ever lands, delete
   the filter and the blend and set INK to the new bounds — every call
   site follows, exactly as the original note promised. */
/* THE CREAM PLATE IS GONE FROM THE DARK CHROME.

   The filter-and-blend treatment got the plate out of the way, and it
   was still the wrong answer: inverting a wordmark drawn for cream
   leaves grey letters with soft edges, and against jet they read as a
   photograph of a logo rather than a logo. The owner is right that it
   sits wrong.

   variant="light" now draws the word instead of the picture, in the
   heading face the app already loads. A wordmark IS type — this is the
   letters set properly rather than a bitmap of them, so it is sharp at
   every density, scales with the header rather than resampling, weighs
   nothing, and takes colour like anything else.

   LIGHT RATHER THAN GOLD, though the owner offered both. The bell is
   becoming gold in the same strip; a gold wordmark beside it would put
   two warm marks either side of a teal accent and the chrome would have
   three colours competing. The wordmark is the quietest thing up there
   and should stay so — it is a label, not a control.

   The image path is untouched for the marketing site and for anywhere
   the mark sits on cream. */
export default function Logo({ height = 28, alt = "Saathban", variant = "dark", style }) {
  const s = height / INK.h;
  const light = variant === "light";

  if (light) {
    return (
      <span
        role="img"
        aria-label={alt}
        style={{
          display: "block",
          fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
          fontSize: Math.round(height * 0.78),
          lineHeight: 1,
          fontWeight: 600,
          /* Wide tracking is what makes a word read as a mark rather
             than as a heading that happens to be centred. */
          letterSpacing: "0.16em",
          /* The trailing letter-space pushes the word off centre by half
             a space; this takes it back. */
          textIndent: "0.16em",
          color: "#F2F3F5",
          whiteSpace: "nowrap",
          ...style,
        }}
      >
        SAATHBAN
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={alt}
      style={{
        display: "block",
        width: Math.round(INK.w * s),
        height,
        flexShrink: 0,
        backgroundImage: "url(/logo-extended.png)",
        backgroundSize: `${Math.round(INK.canvas * s)}px ${Math.round(INK.canvas * s)}px`,
        backgroundPosition: `-${Math.round(INK.x * s)}px -${Math.round(INK.y * s)}px`,
        backgroundRepeat: "no-repeat",
        ...(light
          ? { filter: "invert(1) grayscale(1) brightness(1.1) contrast(1.15)",
              mixBlendMode: "screen" }
          : null),
        ...style,
      }}
    />
  );
}
