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
export function IconChip({
  name,
  size = 22,
  tone = "ink",        // "ink" | "bronze" | "blue"
  active = false,
  onDark = false,
  label,
  badge,
  style,
  ...rest
}) {
  const bed =
    active ? APP_COLORS.accent
    : tone === "bronze" ? CHIP.bronzeBed
    : tone === "blue" ? CHIP.blueBed
    : onDark ? CHIP.restDark
    : CHIP.restLight;

  const ink =
    active ? CHIP.activeInk
    : tone === "bronze" ? CHIP.bronze
    : tone === "blue" ? CHIP.blue
    : onDark ? APP_COLORS.navInk
    : APP_COLORS.textMain;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size + 16,
        height: size + 16,
        borderRadius: CHIP.radius,
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
      <Icon name={name} size={size} label={label} />
      {badge}
    </span>
  );
}

/* For the few places that need the component itself (a table of
   name → glyph, a legend) rather than one rendered icon. */
export const ICON_NAMES = Object.keys(ICONS);
