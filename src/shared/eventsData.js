/* ════════════════════════════════════════════════
   Events — the single source of truth (SPEC.md §Events + Calendar):
   this file is read by BOTH the marketing site (src/App.jsx, the
   Events section and ?event= detail pages) and the app's events area
   (src/app/routes/events/).

   Content moved verbatim from src/App.jsx. Editing rules are
   unchanged: to add a new event, copy one object and fill in the
   details; `detail: null` marks an upcoming event with no detail page
   (its card stays non-clickable on the marketing site).

   App-managed events (RSVP, capacity) live in the `events` table
   (migration 0012) — the app shows both; the marketing site reads
   only this file.
   ════════════════════════════════════════════════ */

import { COLORS as C } from "./tokens.js";

// to add a new event: copy one object below and fill in the details
export const EVENTS = [
  {
    id: "chai-conversations-lahore",
    title: "Chai & Conversations — Lahore",
    date: "Mar 22, 2025",
    loc: "Alhamra Arts Council, Lahore",
    desc: "An afternoon of storytelling and warm chai with senior residents of local aged care homes in Lahore.",
    color: C.brown,
    detail: {
      fullDate: "Saturday, 22nd March 2025",
      time: "3:00 PM – 5:00 PM",
      venue: "Alhamra Arts Council, Mall Road, Lahore",
      about: `Chai & Conversations was Saathban's first community event in Lahore. A warm, intimate afternoon bringing together senior residents from local aged care homes and young volunteers from universities across the city.\n\nOver steaming cups of chai and homemade biscuits, our Saath-Icons shared stories from their lives; tales of Partition, of building careers and families, of the Lahore they once knew. Our Saath-Buddies listened, laughed, and left changed.\n\nThe event reminded us why Saathban exists: not to deliver a service, but to restore a connection.`,
      highlights: [
        "30+ senior citizens attended from 3 local aged care homes",
        "20 student volunteers from LUMS",
        "Handwritten letters exchanged between Saath-Buddies and Saath-Icons",
      ],
      agenda: [
        { time: "3:00 PM", item: "Arrival & welcome tea" },
        { time: "3:30 PM", item: "Opening remarks by Saathban co-founders" },
        { time: "4:15 PM", item: "Letter-writing activity" },
        { time: "4:45 PM", item: "Group photo & closing chai" },
      ],
      gallery: [
        { label: "Welcome gathering", emoji: "🫖" },
        { label: "Storytelling circle", emoji: "💬" },
        { label: "Ghazal performance", emoji: "🎵" },
        { label: "Letter writing", emoji: "✉️" },
      ],
      quote: { text: "I haven't laughed like that in years. These young people gave me something I didn't know I was missing.", author: "Saath-Icon, 74, Lahore" },
    },
  },
  {
    id: "bridging-generations-workshop",
    title: "Bridging Generations Workshop",
    date: "May 3, 2026",
    loc: "Virtual Event",
    desc: "Interactive workshop pairing Saath-Buddies with Saath-Icons for meaningful intergenerational dialogue.",
    color: C.green,
    detail: null, // upcoming — no detail page yet
  },
  {
    id: "walk-with-me",
    title: "Walk With Me — Senior Wellness Walk",
    date: "Jun 15, 2026",
    loc: "Lahore Canal Bank",
    desc: "A gentle group walk promoting physical and mental health among senior citizens.",
    color: C.olive,
    detail: null,
  },
];
