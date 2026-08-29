/* ════════════════════════════════════════════════
   The Saathban sticker set — 26 warm SVGs in the brand palette,
   shared by every chat surface (game chat, DM threads, groups).

   Wire protocol: a sticker travels as a plain text body
   ":sticker/<id>:" (fits every messages table unchanged — dm_messages,
   game_messages, group posts). Renderers call parseStickerRef(body)
   and draw <Sticker id size/> when it matches; legacy emoji-only
   bodies keep rendering large through each surface's existing check.
   Adoption recipe for new surfaces: STICKERS_WIRING.md.

   Labels are bilingual data on each sticker (the badges-table
   precedent — content, not UI copy), picked by the active lang for
   aria-labels. The Nastaliq text stickers use the Noto Nastaliq Urdu
   face the app already loads unconditionally (locales/index.js), so
   they render as calligraphy in BOTH language modes.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "../../../shared/tokens.js";

const NASTALIQ = "'Noto Nastaliq Urdu', serif";

export function stickerRef(id) {
  return `:sticker/${id}:`;
}

const REF_RE = /^:sticker\/([a-z0-9-]{1,40}):$/;
export function parseStickerRef(body) {
  const m = typeof body === "string" ? body.trim().match(REF_RE) : null;
  return m ? m[1] : null;
}

/* ─── Small shared parts ─── */

const Spark = ({ x, y, s = 6, fill = C.olive }) => (
  <path
    d={`M ${x} ${y - s} L ${x + s * 0.35} ${y - s * 0.35} L ${x + s} ${y} L ${x + s * 0.35} ${y + s * 0.35} L ${x} ${y + s} L ${x - s * 0.35} ${y + s * 0.35} L ${x - s} ${y} L ${x - s * 0.35} ${y - s * 0.35} Z`}
    fill={fill}
  />
);

const Leaf = ({ x, y, r = 0, s = 1, fill = C.sage }) => (
  <path
    d="M0 0 C -10 -4, -16 -14, -12 -24 C -2 -22, 4 -12, 0 0 Z"
    transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
    fill={fill}
  />
);

/* Calligraphy-style text sticker: Nastaliq word, a flourish underline,
   and a couple of sparks. Wide viewBox so the word breathes. */
const TextSticker = ({ word, color = C.green, accent = C.olive, size = 34 }) => (
  <>
    <text
      x="70"
      y="52"
      textAnchor="middle"
      direction="rtl"
      fontFamily={NASTALIQ}
      fontSize={size}
      fontWeight="600"
      fill={color}
    >
      {word}
    </text>
    <path
      d="M 22 72 C 50 82, 90 82, 118 72"
      fill="none"
      stroke={accent}
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    <Spark x={20} y={26} s={5} fill={accent} />
    <Spark x={122} y={30} s={4} fill={accent} />
  </>
);

/* Compact sprout companion (the app's character). */
const SproutBody = ({ mood = "smile" }) => (
  <>
    <path d="M48 34 C48 26, 48 22, 48 16" stroke={C.greenMuted} strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M48 24 C38 22, 32 15, 32 7 C42 7, 48 14, 48 24 Z" fill={C.sage} />
    <path d="M48 21 C56 19, 62 13, 63 6 C54 6, 49 12, 48 21 Z" fill={C.greenMuted} />
    <circle cx="48" cy="60" r="26" fill={C.sage} stroke={C.greenMuted} strokeWidth="2" />
    {mood === "tease" ? (
      <>
        <path d="M38 55 q4 -4 8 0" stroke={C.green} strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="58" cy="56" r="3" fill={C.green} />
        <path d="M40 68 C 46 73, 54 72, 58 67" stroke={C.green} strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="39" cy="57" r="3" fill={C.green} />
        <circle cx="57" cy="57" r="3" fill={C.green} />
        <path d="M39 67 C 44 72, 52 72, 57 67" stroke={C.green} strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    )}
  </>
);

/* ─── The set ─── */

const S = [];
const add = (id, en, ur, wide, node) => S.push({ id, en, ur, wide, node });

// — Warm things —
add("chai", "Chai", "چائے", false, (
  <>
    <ellipse cx="48" cy="76" rx="30" ry="7" fill={C.warmGray} opacity="0.5" />
    <path d="M22 44 h44 v14 a22 14 0 0 1 -44 0 Z" fill={C.white} stroke={C.brown} strokeWidth="3" />
    <path d="M24 46 h40 v6 a20 8 0 0 1 -40 0 Z" fill={C.brownLight} />
    <path d="M66 48 c10 0 12 12 0 14" fill="none" stroke={C.brown} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M36 34 c-3 -6 3 -8 0 -14 M50 34 c-3 -6 3 -8 0 -14" stroke={C.olive} strokeWidth="3" strokeLinecap="round" fill="none" />
  </>
));
add("rose", "A rose", "گلاب", false, (
  <>
    <path d="M48 50 C48 66, 48 74, 48 84" stroke={C.greenMuted} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <Leaf x={48} y={74} r={40} s={0.9} />
    <Leaf x={48} y={66} r={-140} s={0.8} fill={C.greenMuted} />
    <circle cx="48" cy="36" r="17" fill={C.brownLight} />
    <path d="M48 22 a14 14 0 0 1 13 19 a10 10 0 0 1 -9 -16 M48 22 a14 14 0 0 0 -13 19 a10 10 0 0 0 9 -16"
      fill={C.brown} opacity="0.75" />
    <circle cx="48" cy="36" r="6" fill={C.brown} />
  </>
));
add("motia", "Jasmine", "موتیا", false, (
  <>
    {[0, 72, 144, 216, 288].map((r) => (
      <ellipse key={r} cx="48" cy="30" rx="9" ry="15" fill={C.white} stroke={C.warmGray} strokeWidth="1.5"
        transform={`rotate(${r} 48 46)`} />
    ))}
    <circle cx="48" cy="46" r="8" fill={C.olive} />
    <Leaf x={30} y={82} r={30} />
    <Leaf x={66} y={82} r={-30} fill={C.greenMuted} />
  </>
));
add("dua", "Dua", "دعا", false, (
  <>
    <path d="M46 82 C30 80, 22 66, 24 46 C25 38, 30 36, 32 42 L36 56 L36 34 C36 28 42 28 42 34 L43 52 L44 30 C44 24 50 24 50 30 L50 52"
      fill={C.cream} stroke={C.brown} strokeWidth="3" strokeLinejoin="round" />
    <path d="M50 82 C66 80, 74 66, 72 46 C71 38, 66 36, 64 42 L60 56 L60 36 C60 30 54 30 54 36 L53 52"
      fill={C.cream} stroke={C.brown} strokeWidth="3" strokeLinejoin="round" />
    <Spark x={48} y={14} s={6} fill={C.olive} />
  </>
));
add("sprout", "The sprout", "کونپل", false, <SproutBody />);
add("crescent", "Crescent", "ہلال", false, (
  <>
    <path d="M60 12 a38 38 0 1 0 0 72 a30 30 0 1 1 0 -72 Z" fill={C.green} />
    <Spark x={66} y={48} s={8} fill={C.olive} />
    <circle cx="24" cy="26" r="2.5" fill={C.warmGray} />
    <circle cx="30" cy="70" r="2" fill={C.warmGray} />
  </>
));
add("lantern", "Lantern", "قندیل", false, (
  <>
    <path d="M48 8 v8" stroke={C.brown} strokeWidth="3" strokeLinecap="round" />
    <rect x="38" y="16" width="20" height="6" rx="3" fill={C.brown} />
    <path d="M34 22 h28 l4 34 a18 12 0 0 1 -36 0 Z" fill={C.cream} stroke={C.brown} strokeWidth="3" />
    <path d="M48 26 q8 14 0 26 q-8 -12 0 -26 Z" fill={C.olive} />
    <rect x="42" y="66" width="12" height="6" rx="3" fill={C.brown} />
  </>
));
add("heart-leaf", "Leafy heart", "پیار", false, (
  <>
    <path d="M48 82 C20 62, 14 40, 26 28 C34 20, 44 24, 48 32 C52 24, 62 20, 70 28 C82 40, 76 62, 48 82 Z"
      fill={C.sage} stroke={C.greenMuted} strokeWidth="3" />
    <path d="M48 36 C48 50, 48 62, 48 74" stroke={C.greenMuted} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M48 52 C42 50, 38 46, 38 42 M48 62 C54 60, 58 56, 58 52" stroke={C.greenMuted} strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </>
));

// — Nastaliq words —
add("mashaallah", "MashaAllah", "ماشاءاللہ", true, <TextSticker word="ماشاءاللہ" color={C.green} accent={C.olive} size={30} />);
add("shabash", "Shabash", "شاباش", true, <TextSticker word="شاباش" color={C.brown} accent={C.brownLight} size={36} />);
add("jeetay-raho", "Jeetay raho", "جیتے رہو", true, <TextSticker word="جیتے رہو" color={C.green} accent={C.sage} size={32} />);
add("wah-wah", "Wah wah", "واہ واہ", true, <TextSticker word="واہ واہ" color={C.brown} accent={C.olive} size={34} />);
add("salaam", "Salaam", "سلام", true, (
  <>
    <TextSticker word="سلام" color={C.green} accent={C.sage} size={38} />
    <path d="M118 20 a9 9 0 1 0 0 16 a7 7 0 1 1 0 -16 Z" fill={C.olive} />
  </>
));
add("shukriya", "Shukriya", "شکریہ", true, (
  <>
    <TextSticker word="شکریہ" color={C.brownLight} accent={C.brown} size={34} />
    <circle cx="20" cy="24" r="6" fill={C.brownLight} opacity="0.8" />
  </>
));

// — Game reactions: celebration —
add("six", "A six!", "!چھکا", false, (
  <>
    {[["18","20"],["78","20"],["14","52"],["82","52"]].map(([x, y], i) => (
      <path key={i} d={`M ${x} ${y} l ${i % 2 ? -8 : 8} ${i < 2 ? -8 : 8}`} stroke={C.olive} strokeWidth="3.5" strokeLinecap="round" />
    ))}
    <rect x="26" y="24" width="44" height="44" rx="10" fill={C.cream} stroke={C.green} strokeWidth="3.5" />
    {[["36","34"],["48","34"],["60","34"],["36","58"],["48","58"],["60","58"]].map(([x, y]) => (
      <circle key={x + y} cx={x} cy={y} r="4" fill={C.green} />
    ))}
    <text x="48" y="88" textAnchor="middle" fontFamily={NASTALIQ} fontSize="15" fill={C.brown}>چھکا!</text>
  </>
));
add("garland", "Garland", "ہار", false, (
  <>
    <path d="M14 26 C 22 62, 74 62, 82 26" fill="none" stroke={C.greenMuted} strokeWidth="3.5" />
    {[[14, 26], [26, 44], [48, 52], [70, 44], [82, 26]].map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r="8" fill={i % 2 ? C.brownLight : C.white} stroke={C.brown} strokeWidth="2" />
        <circle cx={x} cy={y} r="3" fill={C.olive} />
      </g>
    ))}
    <Leaf x={36} y={54} r={70} s={0.6} />
    <Leaf x={62} y={54} r={-250} s={0.6} />
  </>
));
add("anaar", "Sparkler", "اَنار", false, (
  <>
    <path d="M42 88 L54 88 L50 58 L46 58 Z" fill={C.brown} />
    <Spark x={48} y={40} s={14} fill={C.olive} />
    <Spark x={26} y={30} s={6} fill={C.sage} />
    <Spark x={70} y={28} s={7} fill={C.brownLight} />
    <Spark x={48} y={14} s={5} fill={C.greenMuted} />
    <circle cx="30" cy="52" r="2.5" fill={C.olive} />
    <circle cx="66" cy="50" r="2.5" fill={C.olive} />
  </>
));
add("champ", "Champion sprout", "چیمپیئن", false, (
  <>
    <SproutBody />
    <path d="M26 44 C 30 58, 66 58, 70 44" fill="none" stroke={C.brownLight} strokeWidth="4" strokeLinecap="round" />
    {[[30, 50], [48, 55], [66, 50]].map(([x, y]) => (
      <circle key={x} cx={x} cy={y} r="4" fill={C.brownLight} />
    ))}
    <Spark x={16} y={22} s={6} />
    <Spark x={80} y={22} s={6} />
  </>
));
add("clap", "Applause", "تالیاں", false, (
  <>
    <path d="M30 74 C18 64, 16 48, 26 36 L34 44 L30 30 C30 24 37 24 38 30 L42 46 L42 26 C42 20 49 20 49 26 L49 50"
      fill={C.cream} stroke={C.brown} strokeWidth="3" strokeLinejoin="round" transform="rotate(-14 48 48)" />
    <path d="M64 78 C78 70, 82 54, 74 42 L66 50 L70 34 C70 28 63 28 62 34 L59 48"
      fill={C.cream} stroke={C.brown} strokeWidth="3" strokeLinejoin="round" transform="rotate(12 48 48)" />
    <path d="M20 22 l4 6 M48 12 l0 8 M76 22 l-4 6" stroke={C.olive} strokeWidth="3.5" strokeLinecap="round" />
  </>
));
add("jeet", "Victory", "!جیت", true, (
  <>
    <path d="M52 20 h36 v10 a14 16 0 0 1 -12 16 c-2 8 -6 12 -10 13 v9 h10 v6 h-28 v-6 h10 v-9 c-4 -1 -8 -5 -10 -13 a14 16 0 0 1 -12 -16 v-10 Z M52 26 h-6 v6 a9 10 0 0 0 7 9 Z M88 26 h6 v6 a9 10 0 0 1 -7 9 Z"
      fill={C.olive} transform="translate(-22 8) scale(0.9)" />
    <text x="98" y="56" textAnchor="middle" direction="rtl" fontFamily={NASTALIQ} fontSize="36" fontWeight="600" fill={C.green}>جیت!</text>
    <Spark x={124} y={22} s={6} />
  </>
));

// — Game reactions: gentle teasing & near-misses —
add("pakar-liya", "Gotcha!", "!پکڑ لیا", true, (
  <>
    <text x="80" y="50" textAnchor="middle" direction="rtl" fontFamily={NASTALIQ} fontSize="30" fontWeight="600" fill={C.brown}>پکڑ لیا!</text>
    <circle cx="22" cy="60" r="11" fill={C.sage} stroke={C.greenMuted} strokeWidth="2.5" transform="rotate(-20 22 60)" />
    <path d="M10 44 q6 8 4 14 M34 44 q-6 8 -4 14" stroke={C.brownLight} strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M 30 78 C 60 88, 100 88, 128 76" fill="none" stroke={C.brownLight} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 8" />
  </>
));
add("uff", "Oof — so close", "!اُف", true, (
  <>
    <text x="88" y="52" textAnchor="middle" direction="rtl" fontFamily={NASTALIQ} fontSize="38" fontWeight="600" fill={C.brown}>اُف!</text>
    <circle cx="26" cy="56" r="10" fill={C.sage} stroke={C.greenMuted} strokeWidth="2.5" />
    <circle cx="52" cy="56" r="12" fill="none" stroke={C.olive} strokeWidth="3" strokeDasharray="5 5" />
    <path d="M36 56 h4" stroke={C.brown} strokeWidth="3" strokeLinecap="round" />
  </>
));
add("agli-baar", "Next time", "اگلی بار", true, (
  <>
    <TextSticker word="اگلی بار" color={C.greenMuted} accent={C.sage} size={30} />
    <path d="M124 60 C 130 52, 130 40, 122 32 M122 32 l8 1 m-8 -1 l1 8" stroke={C.greenMuted} strokeWidth="3" strokeLinecap="round" fill="none" />
  </>
));
add("phir-se", "Once more!", "!پھر سے", true, (
  <>
    <text x="80" y="52" textAnchor="middle" direction="rtl" fontFamily={NASTALIQ} fontSize="32" fontWeight="600" fill={C.green}>پھر سے!</text>
    <path d="M22 34 a16 16 0 1 0 16 -16 M38 18 l-9 -2 m9 2 l2 9" stroke={C.olive} strokeWidth="3.5" strokeLinecap="round" fill="none" />
  </>
));
add("arre-arre", "Arre arre", "ارے ارے", true, (
  <>
    <text x="86" y="48" textAnchor="middle" direction="rtl" fontFamily={NASTALIQ} fontSize="30" fontWeight="600" fill={C.brown}>ارے ارے</text>
    <g transform="translate(-24 18) scale(0.62)">
      <SproutBody mood="tease" />
    </g>
    <path d="M 44 78 C 70 86, 104 86, 126 78" fill="none" stroke={C.brownLight} strokeWidth="3" strokeLinecap="round" />
  </>
));
add("star-wah", "Wah — a star", "!واہ", false, (
  <>
    <path d="M48 10 L57 36 L84 36 L62 52 L70 80 L48 62 L26 80 L34 52 L12 36 L39 36 Z"
      fill={C.olive} stroke={C.brown} strokeWidth="2.5" strokeLinejoin="round" />
    <text x="48" y="93" textAnchor="middle" fontFamily={NASTALIQ} fontSize="16" fill={C.green}>واہ!</text>
  </>
));

export const STICKER_SET = S;
const BY_ID = Object.fromEntries(S.map((s) => [s.id, s]));

export function stickerById(id) {
  return BY_ID[id] || null;
}

/* Render one sticker. Square ones use size×size; wide (calligraphy)
   ones keep their 140:96 ratio at the same visual height. */
export function Sticker({ id, size = 96, style }) {
  const s = BY_ID[id];
  if (!s) return null;
  const wide = !!s.wide;
  const w = wide ? Math.round((size * 140) / 96) : size;
  return (
    <svg
      viewBox={wide ? "0 0 140 96" : "0 0 96 96"}
      width={w}
      height={size}
      role="img"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      {s.node}
    </svg>
  );
}
