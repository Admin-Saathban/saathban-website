/* ════════════════════════════════════════════════
   One icon set, one weight, one colour.

   The owner's verdict on 30 August: emoji used as icons is the single
   largest reason the app reads as a prototype. He is right, and the
   reason is not taste. An emoji is a picture drawn by whoever made the
   font — Apple's 🌳 is a different weight, colour, perspective and
   optical size from Google's, so a row of them has no shared line
   weight and no shared palette. Nothing lines up, because nothing was
   drawn together.

   Lucide (ISC licence, redistributable inside an app — see
   00_REDESIGN_INDEX §4.4 on why free-to-download is not
   free-to-ship) is one family at one stroke weight, and every glyph
   here inherits `currentColor`, so an icon is whatever colour its text
   is and never introduces a second palette.

   ── WHY THIS FILE EXISTS RATHER THAN DIRECT IMPORTS ──

   Every call site says `<Icon name="camera" />`, never a direct
   lucide import. Three reasons, in order of how much they will matter
   later:

   1. The set is swappable in ONE file. If the licence changes or the
      owner prefers Phosphor, this map changes and nothing else does.
   2. The NAMES ARE OURS AND SEMANTIC. "outdoor" not "TreePine",
      "mood" not "Smile". When Out & about is renamed the icon name
      does not have to lie.
   3. It is where the accessibility rule lives — aria-hidden by
      default, because an icon sits beside a word and a reader
      announcing both says it twice. Pass `label` where the icon IS
      the control.
   ════════════════════════════════════════════════ */

import { CHIP, APP_COLORS } from "../../shared/tokens.js";
import {
  Apple, ArrowLeft, ArrowRight, Bed, Bell, Bot, Bookmark, Cake, Calendar,
  CalendarDays, Camera, Candy, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleUser, Clock, Compass, CupSoda, Dices, DoorOpen, Droplet, Egg, Feather,
  Flame, Flower2, Footprints, Globe, Hand, HandHeart, Hash, Heart,
  HeartHandshake, House, Image, Landmark, Link2, Lock, LogOut, Mail, Medal,
  Megaphone, Menu, MessageCircle, Mic, Milk, Moon, NotebookPen, PartyPopper,
  Pill, Pin, Plus, Puzzle, RefreshCw, Salad, Sandwich, Scale, Search, Send,
  Settings, ShoppingBag, Smile, Sprout, Stethoscope, Sun, Sunrise, ThumbsUp,
  Trees, TreePine, TriangleAlert, Trophy, User, Users, Utensils, Volume2,
  Waves, Wrench, X, MapPin, Target, FileText,
} from "lucide-react";

/* Our names on the left, always. Never Lucide's on a call site. */
const ICONS = {
  // ── the bottom bar (§1) ──
  home: House, games: Dices, groups: Users, outdoor: TreePine, more: Menu,

  // ── the header (§3) ──
  search: Search, bell: Bell, messages: MessageCircle, profile: CircleUser,

  // ── the More drawer (§6) ──
  calendar: Calendar, journey: Compass, grow: Sprout, badges: Medal,
  saved: Bookmark, settings: Settings, help: MessageCircle,

  // ── the daily log ──
  log: Sun, mood: Smile, sleep: Moon, medication: Pill, exercise: Footprints,
  diet: Utensils, water: Droplet, weight: Scale, note: NotebookPen,
  voice: Mic, bloodPressure: Stethoscope, tracker: Hash,

  // ── meals and foods, for the log's diet module ──
  breakfast: Sunrise, lunch: Sun, dinner: Moon, snack: CupSoda,
  egg: Egg, bread: Sandwich, greens: Salad, fruit: Apple, milk: Milk,
  sweet: Candy,

  // ── post and share types (§7) ──
  badge: Trophy, walk: Footprints, activity: HandHeart, event: CalendarDays,
  gameOpen: Dices, riddle: Puzzle, helpAsk: Hand, helpOffer: HeartHandshake,
  milestone: Flame, memory: Feather, good: Flower2,

  // ── out and about: place types (§12) ──
  park: Trees, mosque: Landmark, market: ShoppingBag, museum: Landmark,
  promenade: Footprints, water_place: Waves, place: MapPin,

  // ── calendar entry kinds ──
  birthday: Cake, appointment: Stethoscope, visit: DoorOpen, pinned: Pin,
  gathering: PartyPopper,

  // ── games ──
  dice: Dices, bot: Bot, invite: Link2, celebrate: PartyPopper,
  announce: Megaphone, rematch: RefreshCw, snakes: Waves, leave: LogOut,
  sound: Volume2, seatOpen: User,

  // ── actions and furniture ──
  camera: Camera, globe: Globe, check: Check, close: X, add: Plus,
  chevron: ChevronRight, chevronBack: ChevronLeft, down: ChevronDown,
  back: ArrowLeft, forward: ArrowRight, time: Clock, heart: Heart,
  like: ThumbsUp, person: CircleUser, people: Users, photo: Image,
  send: Send, locked: Lock, letter: Mail, warn: TriangleAlert,
  tools: Wrench, rest: Bed, carrom: Target, document: FileText,
};

export default function Icon({
  name,
  size = 20,
  /* One weight everywhere. A set with mixed stroke widths is the same
     mismatch as mixed emoji, arrived at deliberately. */
  strokeWidth = 1.75,
  /* A filled glyph is the SECOND signal beside colour. A heart that
     only turns red says one thing to somebody who cannot see red; a
     heart that fills in says it a second way, and never colour alone
     is a hard requirement here, not a preference. */
  fill = "none",
  label,
  style,
  ...rest
}) {
  const Glyph = ICONS[name];
  if (!Glyph) {
    /* A missing name renders NOTHING rather than a fallback glyph. A
       placeholder box would ship as a real icon nobody noticed; empty
       space gets seen and fixed. */
    if (import.meta.env?.DEV) console.warn(`Icon: no glyph named "${name}"`);
    return null;
  }
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      color="currentColor"
      fill={fill}
      aria-hidden={label ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      style={{ flexShrink: 0, display: "block", ...style }}
      {...rest}
    />
  );
}

/* ─── THE CHIP ("alive", I2) ───

   One component, because the picker chose a BEHAVIOUR and a behaviour
   implemented five times is five behaviours. Every header and bar icon
   goes through this; a lane writing its own rounded box around an Icon
   is how we got five creams and five greens.

   Three states and two landmarks:

     rest        a whisper of a chip — a tint on light, a white film on
                 the dark chrome
     active      the chip FILLS with the accent and the icon goes white,
                 so where-you-are is a shape you find without reading it
     bronze/blue the bell and Messages keep a colour of their own,
                 because they are landmarks rather than states and the
                 two things people hunt for are easier to hunt for when
                 they are not the same ink as everything else

   `onDark` rather than sniffing the background: a component cannot see
   what is painted behind it, and guessing is how a white icon ends up
   on a white bar. The caller knows. */
/* ── THE GOLD, AS A GRADIENT ──

   The bell is not a flat yellow: it is lit from above, so it reads as an
   object on the jet rather than a sticker on it. That needs two stops,
   which needs a real <linearGradient> in the document — a CSS gradient
   cannot fill an SVG path from outside.

   Injected once, like the drag stylesheet, rather than rendered per
   icon: a page with nine bells does not need nine identical defs, and an
   id that appears twice is an id that stops resolving. */
/* ── THE BELL IS DRAWN HERE, NOT BORROWED ──

   Lucide's bell is one stroked path, and the owner picked a bell with
   three things a single path cannot carry: a gradient down its body, a
   clapper in its own colour, and a soft highlight where the light lands.
   Fighting the library for that would mean colouring sub-paths by
   nth-of-type, which breaks the first time the library redraws its icon.

   So it is drawn. Still a drawn icon and still not an emoji — the point
   of the icon rule was never the library, it was that a glyph should not
   be handed to whoever made the font. */
function GoldBell({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
         style={{ flexShrink: 0, display: "block" }}>
      <path
        d="M12 3.2c-3.2 0-5.6 2.5-5.6 5.7v3.3l-1.7 3.3a.6.6 0 0 0 .5.9h13.6a.6.6 0 0 0 .5-.9l-1.7-3.3V8.9c0-3.2-2.4-5.7-5.6-5.7z"
        fill="url(#sb-gold)" stroke={CHIP.goldEdge} strokeWidth="1.1" strokeLinejoin="round"
      />
      {/* the clapper, lighter so the two shapes stay separate at 20px */}
      <path d="M9.7 18.1a2.4 2.4 0 0 0 4.6 0" fill="none"
            stroke={CHIP.goldClap} strokeWidth="1.6" strokeLinecap="round" />
      {/* where the light lands */}
      <ellipse cx="9.5" cy="8.2" rx="1.5" ry="2.4" fill="#FFFFFF" opacity="0.42"
               transform="rotate(-18 9.5 8.2)" />
    </svg>
  );
}

const GOLD_ID = "sb-gold-fill";

function ensureGold() {
  if (typeof document === "undefined" || document.getElementById(GOLD_ID)) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", GOLD_ID);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  svg.innerHTML =
    '<defs><linearGradient id="sb-gold" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + CHIP.goldTop + '"/>' +
    '<stop offset="52%" stop-color="' + CHIP.goldMid + '"/>' +
    '<stop offset="100%" stop-color="' + CHIP.goldLow + '"/>' +
    "</linearGradient></defs>";
  document.body.appendChild(svg);
}

/* ── THE UNREAD COUNT ──

   Upper right of the chip, as picked. The colour is the app's error red
   because unread is the one thing in this chrome that wants to be found
   before anything else on the screen.

   IT CARRIES A RING OF THE SURFACE IT SITS ON, and that is the whole
   reason this is a component rather than three lines inline. Messages is
   a SOLID WHITE bubble now — a red dot laid straight on it shares an
   edge with the white and the two shapes fuse into one blob at 20px. A
   two-pixel ring in the bar's own colour cuts the badge free of
   whatever is under it, white bubble or gold bell alike.

   Positioned with insetInlineEnd, so it mirrors in Urdu rather than
   sitting over the glyph.

   99+ because three digits do not fit and nobody needs the exact number
   past a hundred — what they need is "a lot". */
function ChipCount({ count, onDark }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: -3,
        insetInlineEnd: -3,
        minWidth: 17,
        height: 17,
        paddingInline: n > 9 ? 4 : 0,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        background: APP_COLORS.error,
        color: "#FFF7F5",
        border: `2px solid ${onDark ? APP_COLORS.nav : APP_COLORS.surface}`,
        fontSize: 10,
        lineHeight: 1,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function IconChip({
  name,
  size = 22,
  tone = "ink",          // "ink" | "bronze" | "blue"
  variant = "bar",       // "bar" | "header"
  active = false,
  onDark = false,
  label,
  badge,
  count = 0,
  style,
  ...rest
}) {
  const header = variant === "header";
  /* HEADER CHIPS ARE ALL THE SAME SOLID BED. Search, bell and More are
     three of a kind — they act on the screen you are looking at — so
     they look like three of a kind. The colour a bell or a bubble
     carries belongs to the GLYPH, not to the chip under it; tinting the
     bed as well made the header a row of coloured lozenges.

     The bar is unchanged and deliberately different: there a chip
     carries WHERE YOU ARE, so it is a film at rest and the accent when
     active. */
  const bed =
    header ? CHIP.headerBed
    : active ? APP_COLORS.accent
    /* NO TONED BEDS IN THE BAR EITHER. Every tab gets the same film
       at rest and the accent when it is the one you are on — that is
       what makes the chip read as POSITION. Messages carried a blue bed
       from the earlier treatment, so it looked selected on every screen
       while a different tab was actually lit. Its colour lives in the
       glyph now: a solid white bubble. */
    : onDark ? CHIP.restDark
    : CHIP.restLight;

  const ink =
    active ? CHIP.activeInk
    : tone === "bronze" ? CHIP.bronze
    : tone === "blue" ? CHIP.blue
    : onDark ? APP_COLORS.navInk
    : APP_COLORS.textMain;

  /* WHAT IS FILLED, AND WHY EACH ONE IS.

     Messages: a WHITE interior. A speech bubble drawn in outline is a
     ring, and a ring at 22px on a dark bar is mostly bar — the fill is
     what makes it read as a bubble at a glance, which is the point of it
     being a landmark. Active, the chip goes accent and the bubble goes
     solid white on it.

     The bell: gold with a top-light, so it sits ON the jet rather than
     being printed on it. Stroke stays bronze so the edge holds where the
     gradient is palest.

     Everything else stays line-art. Two filled icons in a strip are two
     landmarks; five would be a pattern, and a pattern has no landmarks. */
  /* MESSAGES IS A SOLID WHITE BUBBLE — filled, and no outline at all.
     An outlined bubble at 22px on a dark bar is mostly bar; the owner
     picked the solid, and a solid shape with a stroke around it in the
     same white is just a thicker solid. Active, the chip goes accent and
     the white bubble sits on it. */
  const solidWhite = tone === "blue";
  const glyphFill = solidWhite ? "#FFFFFF" : "none";

  if (tone === "bronze") ensureGold();

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: header ? CHIP.headerSize : size + 16,
        height: header ? CHIP.headerSize : size + 16,
        borderRadius: header ? CHIP.headerRadius : CHIP.radius,
        background: bed,
        color: ink,
        /* The chip is the thing that moves, not the icon inside it —
           one transition, so a tab lighting up and a bell being pressed
           feel like the same app. */
        transition: "background 160ms ease-out, color 160ms ease-out",
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    >
      {tone === "bronze"
        ? <GoldBell size={size} />
        : <Icon
            name={name}
            size={size}
            label={label}
            fill={glyphFill}
            /* No stroke on the solid bubble: a filled shape outlined in
               its own colour is just a fatter filled shape. */
            strokeWidth={solidWhite ? 0 : undefined}
          />}
      {badge}
      <ChipCount count={count} onDark={onDark} />
    </span>
  );
}

/* For the few places that need the component itself (a table of
   name → glyph, a legend) rather than one rendered icon. */
export const ICON_NAMES = Object.keys(ICONS);
