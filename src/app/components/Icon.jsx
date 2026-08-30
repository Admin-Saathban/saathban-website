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

   Every call site says `<Icon name="camera" />`, not
   `import { Camera } from "lucide-react"`. Three reasons, in order of
   how much they will matter later:

   1. The set is swappable in ONE file. If Lucide's licence changes or
      the owner prefers Phosphor, this map changes and nothing else
      does. Direct imports would put that decision in ninety files.
   2. The NAMES ARE OURS AND SEMANTIC. "outdoor" not "TreePine",
      "mood" not "Smile". When Out & about gets renamed the icon name
      does not have to lie, and a lane that wants "the outdoor icon"
      does not have to know which tree Lucide picked.
   3. It is where the accessibility rule lives. See below.

   ── AN ICON IS NEVER THE ONLY THING SAYING IT ──

   PRODUCT_DECISIONS §0.1: meaning is never carried by colour alone,
   and §3 extends it — a bottom bar is never icon-only, because an
   emoji or a glyph is a rebus a person has to solve every time.

   So this renders `aria-hidden` by DEFAULT. An icon is decoration
   sitting beside a word, and a screen reader that announces both reads
   everything twice. Where an icon genuinely IS the control — a bare
   close button — pass `label`, and it becomes an `img` role with that
   accessible name. Those are the only two states; there is no third
   where an icon is meaningful and silent.
   ════════════════════════════════════════════════ */

import {
  ArrowLeft, ArrowRight, Bell, Bookmark, Calendar, Camera, Check, ChevronLeft,
  ChevronRight, CircleUser, Clock, CloudSun, Compass, Dices, Droplet, Footprints,
  Heart, House, MapPin, Medal, Menu, MessageCircle, Moon, Pill, Plus, Search,
  Settings, Sprout, Sun, ThumbsUp, TreePine, Users, Utensils, X,
} from "lucide-react";

/* Our names on the left, always. Never Lucide's on a call site. */
const ICONS = {
  // ── the bottom bar (§1) ──
  home: House,
  games: Dices,
  groups: Users,
  outdoor: TreePine,
  more: Menu,

  // ── the header (§3) ──
  search: Search,
  bell: Bell,
  messages: MessageCircle,
  profile: CircleUser,

  // ── the More drawer (§6) ──
  calendar: Calendar,
  journey: Compass,
  grow: Sprout,
  badges: Medal,
  saved: Bookmark,
  settings: Settings,
  help: MessageCircle,

  // ── the daily log ──
  log: CloudSun,
  mood: Sun,
  sleep: Moon,
  medication: Pill,
  exercise: Footprints,
  diet: Utensils,
  water: Droplet,

  // ── actions and furniture ──
  camera: Camera,
  check: Check,
  close: X,
  add: Plus,
  chevron: ChevronRight,
  chevronBack: ChevronLeft,
  back: ArrowLeft,
  forward: ArrowRight,
  time: Clock,
  place: MapPin,
  heart: Heart,
  like: ThumbsUp,
  person: CircleUser,
};

export default function Icon({
  name,
  size = 20,
  /* One weight everywhere. A set with mixed stroke widths is the same
     mismatch as mixed emoji, arrived at deliberately. */
  strokeWidth = 1.75,
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
      aria-hidden={label ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      style={{ flexShrink: 0, display: "block", ...style }}
      {...rest}
    />
  );
}

/* For the few places that need the component itself (a table of
   name → glyph, a legend) rather than one rendered icon. */
export const ICON_NAMES = Object.keys(ICONS);
