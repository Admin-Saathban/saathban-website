import { useState, useEffect, useRef, useCallback } from "react";

/* ════════════════════════════════════════════════
   SAATHBAN — Timeless Togetherness
   Where Generations Flourish Together
   ════════════════════════════════════════════════ */

// ─── Color Tokens (new brand palette) ───
const C = {
  cream: "#FAF3E9", brown: "#573425", green: "#063214",
  greenLight: "#0a4a1e", greenMuted: "#2a5e3a", brownLight: "#7a5443",
  olive: "#6b7c5e", sage: "#8fa67e", warmGray: "#d4cdc4",
  bg: "#FAF3E9", white: "#FFFFFF", dark: "#1a1a1a",
  textMain: "#2d2418", textMuted: "#6b5e52", accent: "#573425",
};

// ─── Data ───
const FOUNDERS = [
  {
    name: "Tahir Sajeel Farooq",
    role: "Co-Founder",
    img: "/founder2.png",
    bio: "Sajeel is one of the co-founders of Saathban. After graduating from the Lahore University of Management Sciences with a degree in Economics, he was offered a scholarship at the University of Chicago in one of the leading schools of Public Policy. At the University of Chicago, he is working with the world's leading scientists and Nobel laureates to develop technologies to help people in underdeveloped countries live better lives. He has extensive training in microeconomics, politics, and international finance and has a deep understanding of income traps in the developing world. His vision for Saathban is to create a space where people of all ages can connect and share wisdom with each other to make the world a better place. During his time with Saathban, he has helped build a strong organizational foundation, assemble an extraordinary team, and establish the systems that allow the mission to stand on its own feet and grow. He pays his regards to his father, from whom he learned to be kind.",
    message: "Saathban is a sincere gift to the elderly around the world. I hope to see it flourish and grow as a place that has no age limit.",
  },
  {
    name: "Maheen Shafiq",
    role: "Co-Founder",
    img: "/founder1.png", 
    bio: "Maheen co-founded Saathban with a simple belief: thriving societies are built not on generational separation, but on intergenerational connection. Her past experience involves dedicated work as a risk and implementation consultant for financial and non-financial institutions to architect systems that withstand systemic shocks. This expertise she is now applying to vanquish the risk and impact of isolation by building a community rooted in sustainable connections. Under her leadership, Saathban has mobilized a growing network of volunteers and is building new models of intergenerational connection that seek to redefine what it means to age in the modern world.",
    message: "The future of humanity depends not only on how long we live, but on how meaningfully we remain connected across generations. Our mission is to transform aging from an experience of gradual social invisibility into one of continued purpose, community, and human connection. We are working toward a world where elders are not merely cared for, but celebrated as active, connected, and essential members of society.",
  },
];

const TEAM = [
  { name: "Tahir Sajeel Farooq", role: "Co-Founder", initials: "TSF", color: C.green, img: "/founder2.png" },
  { name: "Maheen Shafiq", role: "Co-Founder", initials: "MS", color: C.brown, img: "/founder1.png" },
  { name: "Hamayoon Shah", role: "Research Head", initials: "RH", color: C.greenMuted, img: null },
/*{ name: "Research Assistant", role: "Research Assistant", initials: "RA", color: C.olive },
  { name: "Design Associate", role: "Design Associate", initials: "DA", color: C.sage }, */
  { name: "Syeda Duaa Batool Naqvi", role: "Strategy Associate", initials: "SA", color: C.brownLight, img: null },
];
//-- Events --
// to add a new event: copy one object below and fill in the details
const EVENTS = [
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

const BLOGS = [
  { title: "Living to 100 is No Longer a Miracle", 
    date: "May 05, 2026", 
    excerpt: "The most hopeful demographic story of our time.", 
    link: "/blog_1.pdf", 
    tag: "Research", 
    color: C.brown },
  { title: "Volunteering Changed My Perspective on Aging", date: "Jan 15, 2026", excerpt: "A young Saath-Buddy shares their transformative experience connecting with a Saath-Icon.", tag: "Stories", color: C.green },
  { title: "5 Simple Ways to Support an Elderly Neighbour", date: "Dec 10, 2025", excerpt: "Practical, everyday actions that combat loneliness and build lasting connections with senior citizens.", tag: "Well-being", color: C.olive },
];

// -- Research Reports --
// to add a new report: add an object to this array with title, year, summary, and a link.
const RESEARCH = [
  { title: "Ageing in a Young Nation",
    year: "2026",
    summary: "Our foundational secondary report examining global and Pakistan demographics with special emphasis on the elderly. Documenting ageing trends, policy landscape, and the institutional ecosystem.",
    link: "/ageing-in-a-young-nation.pdf",
    tag: "Our Report",
    tagColor: C.brown, },
  // ── Add more reports below ──
  // {
  //   title: "Report Title",
  //   year: "2026",
  //   summary: "Brief summary of the report.",
  //   link: "https://link-to-report.com",
  //   tag: "Research",
  //   tagColor: C.green,
  // },
];

const NAV_ITEMS = [
  { label: "Home", id: "home" }, { label: "About", id: "about" }, { label: "Our Work", id: "work" },
  { label: "Get Involved", id: "involve" }, { label: "Blog", id: "blog" }, { label: "Contact", id: "contact" },
];

const SOCIAL_LINKS = {
  email: "hr@saathban.com",
  instagram: "https://www.instagram.com/saathban?igsh=MWhiNzNvcGJnb21kNA==",
  facebook: "https://www.facebook.com/share/1Cgk1gCHuf/",
  linkedin: "https://www.linkedin.com/company/saathban/",
  script: "https://script.google.com/macros/s/AKfycbwhsLn3sQDn49QhtyPq5gvMj2cM4FD8e-mOColpr1zeiQN2RJK3j9fEBEh-_GRIZjmPHw/exec",
};

// ─── Carousel Component ───
function Carousel({ items, renderCard, perPage = 3 }) {
  const [idx, setIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const pp = isMobile ? 1 : perPage;
  const total = Math.ceil(items.length / pp);
  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(total - 1, i + 1));
  const visible = items.slice(idx * pp, idx * pp + pp);

  if (items.length <= pp) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${pp}, 1fr)`, gap: 28 }}>
        {items.map((item, i) => renderCard(item, i))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${pp}, 1fr)`, gap: 28, minHeight: 280 }}>
        {visible.map((item, i) => renderCard(item, i))}
      </div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 32 }}>
        <button onClick={prev} disabled={idx === 0}
          style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${idx === 0 ? C.warmGray : C.green}`, background: "transparent", cursor: idx === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", color: idx === 0 ? C.warmGray : C.green, fontSize: 18, fontWeight: 700 }}>
          ←
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} onClick={() => setIdx(i)}
              style={{ width: i === idx ? 24 : 8, height: 8, borderRadius: 4, background: i === idx ? C.green : C.warmGray, cursor: "pointer", transition: "all 0.3s ease" }} />
          ))}
        </div>
        <button onClick={next} disabled={idx === total - 1}
          style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${idx === total - 1 ? C.warmGray : C.green}`, background: "transparent", cursor: idx === total - 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", color: idx === total - 1 ? C.warmGray : C.green, fontSize: 18, fontWeight: 700 }}>
          →
        </button>
      </div>
    </div>
  );
}

// ─── Fade-In Observer ───
function FadeIn({ children, className = "", delay = 0, style: extra = {} }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.7s cubic-bezier(.4,0,.2,1) ${delay}s, transform 0.7s cubic-bezier(.4,0,.2,1) ${delay}s`, ...extra,
    }}>{children}</div>
  );
}

// ─── Section Title ───
function SecTitle({ children, sub, light }) {
  return (
    <div style={{ marginBottom: 52, textAlign: "center" }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.9rem,4vw,2.8rem)", color: light ? C.cream : C.green, margin: 0, fontWeight: 700, letterSpacing: "-0.01em" }}>{children}</h2>
      {sub && <p style={{ fontSize: 16, color: light ? "rgba(250,243,233,0.75)" : C.textMuted, marginTop: 14, maxWidth: 540, marginInline: "auto", lineHeight: 1.65 }}>{sub}</p>}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20 }}>
        <div style={{ width: 32, height: 3, borderRadius: 2, background: C.brown }} />
        <div style={{ width: 12, height: 3, borderRadius: 2, background: C.green }} />
        <div style={{ width: 6, height: 3, borderRadius: 2, background: C.sage }} />
      </div>
    </div>
  );
}

// ─── Button ───
function Btn({ children, onClick, variant = "primary", style: s = {}, href }) {
  const base = { fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15, border: "none", borderRadius: 50, cursor: "pointer", padding: "14px 36px", letterSpacing: "0.02em", transition: "all 0.35s ease", display: "inline-block", textDecoration: "none" };
  const styles = variant === "primary"
    ? { ...base, background: C.green, color: C.cream, boxShadow: "0 4px 24px rgba(6,50,20,0.25)", ...s }
    : variant === "brown"
      ? { ...base, background: C.brown, color: C.cream, boxShadow: "0 4px 24px rgba(87,52,37,0.25)", ...s }
      : { ...base, background: "transparent", color: C.green, border: `2px solid ${C.green}`, ...s };
  const Tag = href ? "a" : "button";
  return <Tag style={styles} onClick={onClick} href={href} target={href ? "_blank" : undefined} rel={href ? "noopener noreferrer" : undefined}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.03)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; }}>{children}</Tag>;
}

// ─── Card ───
function Card({ children, style: s = {}, hover = true, onClick }) {
  return (
    <div onClick={onClick} style={{ background: C.white, borderRadius: 16, padding: 32, boxShadow: "0 2px 20px rgba(6,50,20,0.06)", transition: "all 0.35s ease", cursor: onClick ? "pointer" : "default", ...s }}
      onMouseEnter={hover ? e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 36px rgba(6,50,20,0.1)"; } : undefined}
      onMouseLeave={hover ? e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 20px rgba(6,50,20,0.06)"; } : undefined}
    >{children}</div>
  );
}

// ─── Stat Counter ───
function Stat({ number, label, delay = 0 }) {
  return (
    <FadeIn delay={delay} style={{ textAlign: "center", flex: "1 1 140px" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, color: C.brown }}>{number}</div>
      <div style={{ fontSize: 14, color: C.textMuted, marginTop: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </FadeIn>
  );
}

// ─── Hero Illustration: Elderly person and child ───
function HeroIllustration() {
  return (
    <svg viewBox="0 0 400 440" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 380, height: "auto" }}>
      {/* Background circles */}
      <circle cx="200" cy="220" r="190" fill={C.green} opacity="0.06" />
      <circle cx="200" cy="220" r="140" fill={C.brown} opacity="0.06" />
      
      {/* Ground */}
      <ellipse cx="200" cy="400" rx="160" ry="16" fill={C.green} opacity="0.08" />
      
      {/* Tree in background */}
      <rect x="310" y="200" width="8" height="200" rx="4" fill={C.brown} opacity="0.2" />
      <circle cx="314" cy="180" r="40" fill={C.green} opacity="0.12" />
      <circle cx="295" cy="195" r="28" fill={C.sage} opacity="0.12" />
      <circle cx="330" cy="200" r="24" fill={C.green} opacity="0.08" />
      
      {/* Elderly person (Saath-Icon) — left side */}
      {/* Body */}
      <path d="M140 250 C140 230, 160 210, 170 210 L180 210 C190 210, 200 230, 200 250 L200 350 C200 360, 195 365, 185 365 L155 365 C145 365, 140 360, 140 350 Z" fill={C.brown} opacity="0.85" />
      {/* Head */}
      <circle cx="170" cy="185" r="30" fill="#D4A77A" />
      {/* Hair (white/silver) */}
      <path d="M145 175 C145 155, 160 145, 170 145 C180 145, 195 155, 195 175 C195 168, 185 160, 170 160 C155 160, 145 168, 145 175Z" fill="#E8E0D8" />
      {/* Gentle smile */}
      <path d="M160 193 Q170 200 180 193" stroke={C.brown} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Eyes */}
      <circle cx="162" cy="183" r="2.5" fill={C.brown} />
      <circle cx="178" cy="183" r="2.5" fill={C.brown} />
      {/* Glasses */}
      <circle cx="162" cy="183" r="8" stroke={C.brown} strokeWidth="1.5" fill="none" opacity="0.5" />
      <circle cx="178" cy="183" r="8" stroke={C.brown} strokeWidth="1.5" fill="none" opacity="0.5" />
      <line x1="170" y1="183" x2="170" y2="183" stroke={C.brown} strokeWidth="1.5" opacity="0.5" />
      {/* Walking stick */}
      <line x1="130" y1="260" x2="125" y2="400" stroke={C.brown} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      {/* Arm reaching toward child */}
      <path d="M195 260 Q210 250, 220 260" stroke="#D4A77A" strokeWidth="8" fill="none" strokeLinecap="round" />
      {/* Hand */}
      <circle cx="222" cy="262" r="6" fill="#D4A77A" />
      
      {/* Child (Saath-Buddy) — right side */}
      {/* Body */}
      <path d="M230 310 C230 295, 240 285, 248 285 L258 285 C266 285, 276 295, 276 310 L276 370 C276 378, 272 382, 265 382 L241 382 C234 382, 230 378, 230 370 Z" fill={C.green} opacity="0.8" />
      {/* Head */}
      <circle cx="253" cy="262" r="26" fill="#E0B68C" />
      {/* Hair */}
      <path d="M230 253 C230 237, 242 228, 253 228 C264 228, 276 237, 276 253 C276 247, 268 240, 253 240 C238 240, 230 247, 230 253Z" fill="#3D2B1F" />
      {/* Smile */}
      <path d="M244 270 Q253 278 262 270" stroke={C.brown} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Eyes */}
      <circle cx="245" cy="260" r="2.5" fill={C.brown} />
      <circle cx="261" cy="260" r="2.5" fill={C.brown} />
      {/* Child's arm reaching toward elder */}
      <path d="M232 300 Q222 290, 222 270" stroke="#E0B68C" strokeWidth="7" fill="none" strokeLinecap="round" />
      
      {/* Connection — hands meeting / heart */}
      <path d="M218 256 L222 250 L226 256 Q222 262, 218 256Z" fill={C.brown} opacity="0.3" />
      
      {/* Floating leaves */}
      <path d="M80 120 Q90 110, 100 120 Q90 130, 80 120Z" fill={C.green} opacity="0.2" transform="rotate(-30 90 120)" />
      <path d="M300 100 Q310 90, 320 100 Q310 110, 300 100Z" fill={C.sage} opacity="0.2" transform="rotate(20 310 100)" />
      <path d="M60 300 Q70 290, 80 300 Q70 310, 60 300Z" fill={C.green} opacity="0.15" transform="rotate(-15 70 300)" />
      
      {/* Small birds */}
      <path d="M100 80 Q105 70 110 78 Q115 70 120 80" stroke={C.green} strokeWidth="1.5" fill="none" opacity="0.2" />
      <path d="M280 60 Q285 50 290 58 Q295 50 300 60" stroke={C.green} strokeWidth="1.5" fill="none" opacity="0.15" />
    </svg>
  );
}

// ─── Event Detail Page ───
function EventDetailPage({ event, onBack }) {
  const d = event.detail;
  const px = { maxWidth: 900, margin: "0 auto", padding: "0 24px" };
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.textMain, background: C.bg, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@0,300;0,400;0,500;0,600;0,700&display=swap');
        @media(max-width:640px) {
          .event-detail-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
        }
      `}</style>

      {/* Back bar */}
      <div style={{ background: C.green, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(250,243,233,0.12)", border: "none", borderRadius: 40, padding: "8px 20px", color: C.cream, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.3s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(250,243,233,0.22)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(250,243,233,0.12)"}>
            ← Back to Events
          </button>
          <span style={{ color: "rgba(250,243,233,0.5)", fontSize: 13 }}>Saathban Events</span>
        </div>
      </div>

      {/* Hero banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`, padding: "64px 24px 56px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", border: "1px solid rgba(250,243,233,0.08)" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: `${C.brown}15` }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
          <span style={{ display: "inline-block", background: `${C.brown}`, borderRadius: 40, padding: "6px 18px", marginBottom: 20, fontSize: 12, fontWeight: 700, color: C.cream, letterSpacing: "0.08em", textTransform: "uppercase" }}>Past Event</span>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem,4vw,3rem)", color: C.cream, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>{event.title}</h1>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginTop: 20 }}>
            <span style={{ color: "rgba(250,243,233,0.8)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              📅 {d.fullDate}
            </span>
            <span style={{ color: "rgba(250,243,233,0.8)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              🕒 {d.time}
            </span>
            <span style={{ color: "rgba(250,243,233,0.8)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              📍 {d.venue}
            </span>
          </div>
        </div>
      </div>

      <div style={{ ...px, padding: "60px 24px" }}>

        {/* About the event */}
        <FadeIn>
          <div style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: C.green, marginBottom: 20 }}>About the Event</h2>
            {d.about.split("\n\n").map((para, i) => (
              <p key={i} style={{ fontSize: 16, lineHeight: 1.85, color: C.textMuted, marginBottom: 16 }}>{para}</p>
            ))}
          </div>
        </FadeIn>

        {/* Highlights + Agenda */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 56 }} className="event-detail-grid">
          <FadeIn delay={0.1}>
            <div style={{ background: C.white, borderRadius: 16, padding: 32, boxShadow: "0 2px 20px rgba(6,50,20,0.06)" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.green, marginBottom: 20 }}>Event Highlights</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {d.highlights.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${C.brown}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.brown }} />
                    </div>
                    <span style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div style={{ background: C.white, borderRadius: 16, padding: 32, boxShadow: "0 2px 20px rgba(6,50,20,0.06)" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.green, marginBottom: 20 }}>Event Agenda</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {d.agenda.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", paddingBottom: i < d.agenda.length - 1 ? 16 : 0, borderBottom: i < d.agenda.length - 1 ? `1px solid ${C.warmGray}50` : "none", marginBottom: i < d.agenda.length - 1 ? 16 : 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.brown, whiteSpace: "nowrap", paddingTop: 2, minWidth: 54 }}>{a.time}</span>
                    <span style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.55 }}>{a.item}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Photo gallery (placeholder) */}
        <FadeIn delay={0.2}>
          <div style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: C.green, marginBottom: 8 }}>Gallery</h2>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24, fontStyle: "italic" }}>Photos from the event.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {d.gallery.map((g, i) => (
                <div key={i} style={{ background: `linear-gradient(135deg, ${C.green}10, ${C.brown}06)`, borderRadius: 14, aspectRatio: "4/3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, border: `1px dashed ${C.warmGray}` }}>
                  <span style={{ fontSize: 36 }}>{g.emoji}</span>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{g.label}</span>
                  <span style={{ fontSize: 11, color: C.warmGray, fontStyle: "italic" }}>Add photo</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Quote */}
        <FadeIn delay={0.25}>
          <div style={{ background: `linear-gradient(135deg, ${C.green}08, ${C.brown}06)`, borderRadius: 20, padding: "44px 48px", textAlign: "center", border: `1px solid ${C.warmGray}50`, marginBottom: 56 }}>
            <div style={{ fontSize: 48, color: C.brown, opacity: 0.2, fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 8 }}>"</div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.1rem,2.5vw,1.4rem)", fontStyle: "italic", color: C.green, lineHeight: 1.7, maxWidth: 620, margin: "0 auto 16px" }}>
              {d.quote.text}
            </p>
            <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 600 }}>— {d.quote.author}</span>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.3}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 16, color: C.textMuted, marginBottom: 20 }}>Want to be part of our next event?</p>
            <Btn onClick={onBack}>← See All Events</Btn>
          </div>
        </FadeIn>
      </div>

      {/* Footer strip */}
      <div style={{ background: C.green, padding: "24px", textAlign: "center", marginTop: 40 }}>
        <span style={{ fontSize: 13, color: "rgba(250,243,233,0.5)" }}>© 2026 Saathban — Timeless Togetherness</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   MAIN APP
   ════════════════════════════════ */
export default function Saathban() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState("");
  const [subbed, setSubbed] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", message: "", contactType: "General" });
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState(false);
  const [sent, setSent] = useState(false);
  const [activeTab, setActiveTab] = useState("about");
  const [activeEvent, setActiveEvent] = useState(null);
  const [emailError, setEmailError] = useState("");
  const [subEmailError, setSubEmailError] = useState("");

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const scrollTo = useCallback((id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  if (activeEvent) {
    return <EventDetailPage event={activeEvent} onBack={() => { setActiveEvent(null); setTimeout(() => document.getElementById("work")?.scrollIntoView({ behavior: "smooth" }), 100); }} />;
  }
   
  const px = { maxWidth: 1160, margin: "0 auto", padding: "0 24px" };

  const SocialIcon = ({ href, icon, bg }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ width: 40, height: 40, borderRadius: 10, background: bg || "rgba(250,243,233,0.08)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s", flexShrink: 0 }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(250,243,233,0.22)"}
      onMouseLeave={e => e.currentTarget.style.background = bg || "rgba(250,243,233,0.08)"}>
      {icon}
    </a>
  );

  const ABOUT_TABS = [
    { key: "about", label: "Who We Are" },
    { key: "founders", label: "Our Founders" },
    { key: "mission", label: "Our Mission" },
    { key: "vision", label: "Our Vision" },
    { key: "team", label: "Our Team" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.textMain, background: C.bg, minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${C.bg}; }
        ::selection { background: ${C.green}; color: ${C.cream}; }
        input:focus, textarea:focus { outline: 2px solid ${C.green}; outline-offset: 2px; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; }
        .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        @media(max-width:900px) { .grid3, .grid4 { grid-template-columns: repeat(2, 1fr); } }
        @media(max-width:640px) { .grid2, .grid3, .grid4 { grid-template-columns: 1fr; } .hide-mobile { display: none !important; } .show-mobile { display: flex !important; } .hero-text { font-size: 2.4rem !important; } .section-pad { padding: 72px 0 !important; } .hero-flex { flex-direction: column; } }
        @media(min-width:641px) { .show-mobile { display: none !important; } }
        @media(max-width:640px) { .mission-grid { grid-template-columns: 1fr !important; gap: 28px !important; } .event-detail-grid { grid-template-columns: 1fr !important; gap: 20px !important; } }
        a { color: ${C.green}; text-decoration: none; }
        a:hover { color: ${C.greenLight}; }
      `}</style>

      {/* ────── Hidden SEO ────── */}
      <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }} aria-hidden="true">
        <h1>Saathban — Timeless Togetherness | Combating Elderly Loneliness in Senior Living Communities</h1>
        <p>Saathban is a vibrant ecosystem where generations flourish together. We work with old age homes, senior living communities, and senior community housing to improve elderly health, mental health, and well-being. Keywords: old age homes, senior living, senior citizens, senior community housing, senior living communities, aged care, social security, community, socialise, lonely, loneliness, well-being, elderly health, mental health, Saath-Icons, Saath-Buddies.</p>
      </div>

      {/* ═══════════ NAVIGATION ═══════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? "rgba(250,243,233,0.93)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.green}15` : "none",
        transition: "all 0.4s ease", padding: scrolled ? "8px 0" : "14px 0",
      }}>
        <div style={{ ...px, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }} onClick={() => scrollTo("home")}>
            <img src="/logo-small.png" alt="Saathban" style={{ height: 40, width: "auto" }} />
          </div>

          {/* Desktop links */}
          <div className="hide-mobile" style={{ display: "flex", gap: 28, alignItems: "center" }}>
            {NAV_ITEMS.filter(n => n.id !== "involve").map(n => (
              <span key={n.id} onClick={() => scrollTo(n.id)} style={{
                cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: C.brown, letterSpacing: "0.05em",
                textTransform: "uppercase", transition: "color 0.3s", padding: "4px 0",
              }} onMouseEnter={e => e.target.style.color = C.green} onMouseLeave={e => e.target.style.color = C.brown}>{n.label}</span>
            ))}
            <Btn variant="primary" onClick={() => scrollTo("involve")} style={{ padding: "10px 24px", fontSize: 13 }}>Get Involved</Btn>
          </div>

          {/* Mobile hamburger */}
          <div className="show-mobile" style={{ display: "none", cursor: "pointer", flexDirection: "column", gap: 5, padding: 8 }} onClick={() => setMenuOpen(!menuOpen)}>
            <div style={{ width: 24, height: 2.5, background: C.green, borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
            <div style={{ width: 24, height: 2.5, background: C.green, borderRadius: 2, transition: "all 0.3s", opacity: menuOpen ? 0 : 1 }} />
            <div style={{ width: 24, height: 2.5, background: C.green, borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: C.cream, borderTop: `1px solid ${C.warmGray}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {NAV_ITEMS.map(n => (
              <span key={n.id} onClick={() => scrollTo(n.id)} style={{ fontSize: 16, fontWeight: 600, color: C.green, cursor: "pointer", padding: "8px 0", borderBottom: `1px solid ${C.warmGray}` }}>{n.label}</span>
            ))}
          </div>
        )}
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section id="home" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden" }}>
        {/* Background decoration */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "55vw", height: "55vw", maxWidth: 700, maxHeight: 700, borderRadius: "50%", background: `radial-gradient(circle, ${C.green}08, transparent 70%)` }} />
          <div style={{ position: "absolute", bottom: "5%", left: "-8%", width: "40vw", height: "40vw", maxWidth: 500, maxHeight: 500, borderRadius: "50%", background: `radial-gradient(circle, ${C.brown}08, transparent 70%)` }} />
          <div className="hide-mobile" style={{ position: "absolute", top: "20%", left: "65%", width: 160, height: 160, borderRadius: "50%", border: `2px solid ${C.green}12`, animation: "float 6s ease-in-out infinite" }} />
          {/* Leaf pattern */}
          <svg style={{ position: "absolute", top: "15%", left: "5%", opacity: 0.05 }} width="120" height="120">
            {[0, 1, 2, 3].map(i => <path key={i} d={`M${30 + i * 25} 60 Q${40 + i * 25} ${40 - i * 5}, ${50 + i * 25} 60 Q${40 + i * 25} ${80 + i * 5}, ${30 + i * 25} 60Z`} fill={C.green} transform={`rotate(${i * 30} ${40 + i * 25} 60)`} />)}
          </svg>
        </div>

        <div style={{ ...px, position: "relative", zIndex: 1, width: "100%", paddingTop: 100, paddingBottom: 60 }}>
          <div className="hero-flex" style={{ display: "flex", alignItems: "center", gap: 48 }}>
            {/* Left: Text */}
            <div style={{ flex: "1 1 480px", maxWidth: 580 }}>
              <div style={{ display: "inline-block", background: `${C.green}10`, borderRadius: 40, padding: "8px 20px", marginBottom: 24 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.green, letterSpacing: "0.08em", textTransform: "uppercase" }}>Where Generations Flourish Together</span>
              </div>
              <h1 className="hero-text" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.6rem,5.5vw,4.2rem)", color: C.green, lineHeight: 1.12, fontWeight: 700, marginBottom: 10 }}>
                Timeless{" "}
                <span style={{ position: "relative", display: "inline-block" }}>
                  <span style={{ position: "relative", zIndex: 1 }}>Togetherness</span>
                  <span style={{ position: "absolute", bottom: 4, left: -4, right: -4, height: 14, background: `${C.brown}20`, borderRadius: 4, zIndex: 0 }} />
                </span>
              </h1>
              <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textMuted, marginTop: 20, maxWidth: 520 }}>
                Saathban is a vibrant ecosystem where generations flourish together. We are cultivating a space where wisdom is inherited, life is shared, and every age thrives as one unified, timeless community.
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 36, flexWrap: "wrap" }}>
                <Btn onClick={() => scrollTo("work")}>Explore Our Work</Btn>
                <Btn variant="outline" onClick={() => scrollTo("involve")}>Join the Movement</Btn>
              </div>
            </div>

            {/* Right: Illustration */}
            <div className="hide-mobile" style={{ flex: "1 1 340px", display: "flex", justifyContent: "center" }}>
              <HeroIllustration />
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", gap: 40, marginTop: 56, flexWrap: "wrap", padding: "32px 0", borderTop: `1px solid ${C.warmGray}` }}>
            <Stat number="500+" label="Seniors Reached" delay={0.1} />
            <Stat number="50+" label="Volunteers" delay={0.2} />
            <Stat number="12+" label="Events Held" delay={0.3} />
            {/* <Stat number="3" label="Reports" delay={0.4} /> //add whenever a good amount is reached*/}
          </div>
        </div>
      </section>

     {/* ═══════════ IMAGE BANNER ═══════════ */}
      <section style={{ padding: "60px 0", background: C.bg }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px" }}>
          <FadeIn>
            <img 
              src="/saathbanimage.png" 
              alt="Saathban community" 
              style={{ 
                width: "100%", 
                height: "auto", 
                borderRadius: 20, 
                boxShadow: "0 8px 32px rgba(6,50,20,0.12)",
                display: "block"
              }} 
            />
          </FadeIn>
        </div>
      </section>
       {/* ═══════════ ABOUT ═══════════ */}
      <section id="about" className="section-pad" style={{ padding: "100px 0", background: C.white }}>
        <div style={px}>
          <SecTitle sub="The Heart of Togetherness">About Saathban</SecTitle>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 44, flexWrap: "wrap" }}>
            {ABOUT_TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, padding: "10px 28px", borderRadius: 40, border: "none", cursor: "pointer",
                background: activeTab === t.key ? C.green : `${C.warmGray}60`,
                color: activeTab === t.key ? C.cream : C.brown, transition: "all 0.3s ease",
              }}>{t.label}</button>
            ))}
          </div>

          {/* About — Who We Are */}
          {activeTab === "about" && (
            <FadeIn>
              <div style={{ maxWidth: 860, margin: "0 auto" }}>
                <div style={{ marginBottom: 48 }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.green, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.green}10`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 18 }}>🌿</span></span>
                    The Gap We Bridge
                  </h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted, paddingLeft: 48 }}>For too long, society has moved in separate circles. We've placed our experience on the sidelines and our energy at the core. At Saathban, we believe that a community is only as strong as its connections. We are the bridge between the keepers of our legacy and the leaders of our future.</p>
                </div>
                <div style={{ marginBottom: 48 }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.green, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.brown}10`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 18 }}>🤝</span></span>
                    Beyond Care, Toward Contribution
                  </h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted, paddingLeft: 48 }}>We are a platform that celebrates age as it tends to bring about contentment, wisdom and peace. By creating a space for <strong style={{ color: C.green }}>Saath-Icons</strong> (our elders) and <strong style={{ color: C.brown }}>Saath-Buddies</strong> (our youth) to interact, we transform quiet moments into shared milestones.</p>
                </div>
                <div style={{ background: `linear-gradient(135deg, ${C.green}08, ${C.brown}06)`, borderRadius: 20, padding: "36px 40px", border: `1px solid ${C.warmGray}50` }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.green, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.sage}20`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 18 }}>🌳</span></span>
                    A Timeless Society
                  </h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted, paddingLeft: 48 }}>Inspired by the strength of a rooted tree and the warmth of a rising sun, Saathban is building a seamless reality where age is a badge of honor, and togetherness is our natural state.</p>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Founders */}
          {activeTab === "founders" && (
            <FadeIn>
              <div style={{ maxWidth: 960, margin: "0 auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36 }} className="mission-grid">
                  {FOUNDERS.map((f, i) => (
                    <div key={i} style={{ background: C.bg, borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 20px rgba(6,50,20,0.06)", border: `1px solid ${C.warmGray}50` }}>
                      {/* Photo */}
                      <div style={{ paddingTop: 32, display: "flex", justifyContent: "center", background: `linear-gradient(135deg, ${C.green}12, ${C.brown}08)`, }}>
                        <div style={{ width: 180, height: 180, borderRadius: "50%", overflow: "hidden", border: `3px solid ${i === 0 ? C.green : C.brown}25`, background: i === 0 ? `${C.green}10` : `${C.brown}10`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", }}>
                          <img
                            src={f.img}
                            alt={f.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "grayscale(100%)", display: "block", }}
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                          <div style={{ display: "none", position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, }}>
                            <span
                              style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: i === 0 ? C.green : C.brown, }}>
                              {f.name.split(" ").map((w) => w[0]).join("")}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Content */}
                      <div style={{ padding: 32 }}>
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.green, marginBottom: 4 }}>{f.name}</h3>
                        <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? C.green : C.brown, background: i === 0 ? `${C.green}10` : `${C.brown}10`, padding: "4px 14px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.06em", display: "inline-block", marginBottom: 16 }}>{f.role}</span>
                        <p style={{ fontSize: 15, lineHeight: 1.75, color: C.textMuted, marginBottom: 20 }}>{f.bio}</p>
                        {/* Message */}
                        <div style={{ background: i === 0 ? `${C.green}06` : `${C.brown}06`, borderLeft: `3px solid ${i === 0 ? C.green : C.brown}`, borderRadius: "0 12px 12px 0", padding: "16px 20px" }}>
                          <div style={{ fontSize: 28, color: i === 0 ? C.green : C.brown, opacity: 0.25, fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 6 }}>"</div>
                          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontStyle: "italic", color: i === 0 ? C.green : C.brown, lineHeight: 1.7 }}>{f.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Mission */}
          {activeTab === "mission" && (
            <FadeIn>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="mission-grid">
                <div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: C.green, marginBottom: 18 }}>Our Mission</h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted }}>We are working toward dismantling the barriers of age by facilitating purposeful interactions between generations. By creating structured opportunities for mentorship and shared experiences, we ensure that every individual remains an active contributor to the social, emotional, and cultural wealth of our society.</p>
                </div>
                <div style={{ background: `linear-gradient(135deg, ${C.green}08, ${C.brown}06)`, borderRadius: 20, padding: 40, display: "flex", flexDirection: "column", gap: 20, border: `1px solid ${C.warmGray}50` }}>
                  {["Dismantle barriers of age through purposeful interaction", "Facilitate mentorship between Saath-Icons & Saath-Buddies", "Create structured opportunities for shared experiences", "Ensure every individual contributes to our collective wealth"].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${[C.green,C.brown,C.sage,C.olive][i]}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: [C.green,C.brown,C.sage,C.olive][i] }} />
                      </div>
                      <span style={{ fontSize: 15, color: C.textMain, lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Vision */}
          {activeTab === "vision" && (
            <FadeIn>
              <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 60, marginBottom: 20, opacity: 0.15 }}>✦</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: C.green, marginBottom: 20 }}>Our Vision</h3>
                <p style={{ fontSize: 18, lineHeight: 1.8, color: C.textMuted, marginBottom: 24 }}>To redefine aging as a period of renewed status and social vitality. We imagine a future where the artificial divide between young and old is gone, replaced by a seamless society that treasures experience as much as energy and views togetherness as our greatest strength.</p>
                <div style={{ background: `linear-gradient(135deg, ${C.green}10, ${C.sage}15)`, borderRadius: 16, padding: "28px 36px", display: "inline-block", marginTop: 12 }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontStyle: "italic", color: C.green, lineHeight: 1.6 }}>"Age is a badge of honor, and togetherness is our natural state."</p>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Team */}
          {activeTab === "team" && (
            <FadeIn>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, maxWidth: 960, margin: "0 auto" }} className="grid3r">
                {TEAM.map((m, i) => (
                  <Card key={i} style={{ textAlign: "center", padding: 28 }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 16px", overflow: "hidden", border: `2px solid ${m.color}25`, background: `${m.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {m.img ? (
                        <img src={m.img} alt={m.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "grayscale(100%)" }}
                          onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                      ) : null}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: m.color, display: m.img ? "none" : "block" }}>{m.initials}</span>
                    </div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 4 }}>{m.name}</h4>
                    <p style={{ fontSize: 13, color: C.brown, fontWeight: 600, letterSpacing: "0.02em" }}>{m.role}</p>
                  </Card>
                ))}
              </div>
            </FadeIn>
          )}
        </div>
      </section>

      {/* ═══════════ OUR WORK ═══════════ */}
      <section id="work" className="section-pad" style={{ padding: "100px 0", background: C.bg }}>
        <div style={px}>
          <SecTitle sub="From grassroots events to research — here's how we make a difference.">Our Work</SecTitle>

          {/* Reports Carousel */}
          <FadeIn>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.green, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: `${C.green}10`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </span>
              Research & Reports
            </h3>
            <div style={{ marginBottom: 56 }}>
              <Carousel items={RESEARCH} perPage={2} renderCard={(r, i) => (
                <Card key={i} style={{ borderLeft: `4px solid ${r.tagColor}`, height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <h4 style={{ fontSize: 17, fontWeight: 700, color: C.green, flex: 1, lineHeight: 1.4 }}>{r.title}</h4>
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.tagColor, background: `${r.tagColor}10`, padding: "4px 12px", borderRadius: 20, whiteSpace: "nowrap", marginLeft: 12 }}>{r.year}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.tagColor, background: `${r.tagColor}10`, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.06em", display: "inline-block", marginBottom: 10 }}>{r.tag}</span>
                  <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, marginBottom: 16 }}>{r.summary}</p>
                  {r.link ? (
                    <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: r.tagColor, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>View Report →</a>
                  ) : (
                    <span style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>Full report coming soon</span>
                  )}
                </Card>
              )} />
            </div>
          </FadeIn>

          {/* Events Carousel */}
          <FadeIn delay={0.1}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.green, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: `${C.brown}10`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.brown} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
              Events
            </h3>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24, marginLeft: 48 }}>Click on a past event to view photos, highlights, and full details.</p>
            <Carousel items={EVENTS} perPage={3} renderCard={(ev, i) => (
              <Card key={i} style={{ overflow: "hidden", position: "relative", height: "100%" }}
                onClick={ev.detail ? () => setActiveEvent(ev) : undefined}>
                <div style={{ height: 6, background: ev.color, margin: "-32px -32px 20px -32px", borderRadius: "16px 16px 0 0" }} />
                <span style={{ position: "absolute", top: 22, right: 20, fontSize: 11, fontWeight: 700, color: ev.detail ? C.brown : C.green, background: ev.detail ? `${C.brown}12` : `${C.green}10`, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {ev.detail ? "Past" : "Upcoming"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: ev.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{ev.date}</span>
                <h4 style={{ fontSize: 18, fontWeight: 700, color: C.green, margin: "8px 0", lineHeight: 1.35 }}>{ev.title}</h4>
                <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {ev.loc}
                </p>
                <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: ev.detail ? 16 : 0 }}>{ev.desc}</p>
                {ev.detail && <span style={{ fontSize: 13, fontWeight: 600, color: C.brown, display: "inline-flex", alignItems: "center", gap: 6 }}>View Event Details →</span>}
              </Card>
            )} />
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ GET INVOLVED ═══════════ */}
      <section id="involve" style={{ padding: "100px 0", background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", border: "1px solid rgba(250,243,233,0.08)" }} />
        <div style={{ position: "absolute", bottom: -50, left: -50, width: 250, height: 250, borderRadius: "50%", background: `${C.brown}10` }} />
        <div style={{ ...px, position: "relative", zIndex: 1 }}>
          <SecTitle light sub="Whether you give your time or your platform — every contribution counts.">Get Involved</SecTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, maxWidth: 860, margin: "0 auto" }} className="mission-grid">
            <FadeIn delay={0.1}>
              <div style={{ background: "rgba(250,243,233,0.08)", backdropFilter: "blur(12px)", borderRadius: 20, padding: 40, border: "1px solid rgba(250,243,233,0.12)", height: "100%" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${C.cream}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.cream, marginBottom: 14 }}>Become a Saath-Buddy</h3>
                <p style={{ fontSize: 15, color: "rgba(250,243,233,0.72)", lineHeight: 1.7, marginBottom: 24 }}>Spend time with Saath-Icons, help organise events, or contribute your skills remotely. Volunteering with Saathban means making a direct impact on elderly well-being in your community.</p>
                <Btn variant="brown" onClick={() => { setContact(c => ({ ...c, contactType: "Volunteer", message: "Hi, I'm interested in volunteering with Saathban." })); scrollTo("contact"); }}>Volunteer Now →</Btn>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div style={{ background: "rgba(250,243,233,0.08)", backdropFilter: "blur(12px)", borderRadius: 20, padding: 40, border: "1px solid rgba(250,243,233,0.12)", height: "100%" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${C.cream}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.cream, marginBottom: 14 }}>Partner With Us</h3>
                <p style={{ fontSize: 15, color: "rgba(250,243,233,0.72)", lineHeight: 1.7, marginBottom: 24 }}>Are you an organisation, old age home, or senior living community? Let's collaborate to create intergenerational programmes, co-host events, or support our research.</p>
                <Btn variant="brown" onClick={() => { setContact(c => ({ ...c, contactType: "Partner", message: "Hi, I'd like to explore partnering with Saathban." })); scrollTo("contact"); }}>Partner With Us →</Btn>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════ BLOG / STORIES ═══════════ */}
      <section id="blog" className="section-pad" style={{ padding: "100px 0", background: C.white }}>
        <div style={px}>
          <SecTitle sub="Stories, insights, and reflections on intergenerational connection and well-being.">Blog & Stories</SecTitle>
          <Carousel items={BLOGS} perPage={3} renderCard={(b, i) => (
            <Card key={i} style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0, overflow: "hidden" }}>
              <div style={{ height: 140, background: `linear-gradient(135deg, ${b.color}15, ${b.color}05)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, color: `${b.color}15`, fontWeight: 700 }}>{b.tag[0]}</span>
                <span style={{ position: "absolute", top: 16, left: 16, fontSize: 11, fontWeight: 700, color: b.color, background: `${b.color}12`, padding: "5px 14px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>{b.tag}</span>
              </div>
              <div style={{ padding: "24px 28px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, marginBottom: 8 }}>{b.date}</span>
                <h4 style={{ fontSize: 17, fontWeight: 700, color: C.green, lineHeight: 1.4, marginBottom: 10 }}>{b.title}</h4>
                <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, flex: 1 }}>{b.excerpt}</p>
                {b.link ? (
                  <a href={b.link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, fontWeight: 600, color: C.green, marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                    Read More →
                  </a>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.green, marginTop: 16, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Read More →
                  </span>
                )}
              </div>
            </Card>
          )} />

          {/* Newsletter */}
          <FadeIn delay={0.2}>
            <div style={{ marginTop: 64, background: `linear-gradient(135deg, ${C.green}08, ${C.brown}06)`, borderRadius: 20, padding: "48px 40px", textAlign: "center", border: `1px solid ${C.warmGray}50`, maxWidth: 680, marginInline: "auto" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.green, marginBottom: 10 }}>Stay Connected</h3>
              <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 28, lineHeight: 1.6 }}>Subscribe to our newsletter for updates on research, events, and stories from the Saathban community.</p>
              {subbed ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: C.green, fontWeight: 600, fontSize: 16 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  You're subscribed — welcome to the community!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, maxWidth: 440, width: "100%", flexWrap: "wrap", justifyContent: "center" }}>
                    <input type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)}
                      style={{ flex: "1 1 240px", padding: "14px 20px", borderRadius: 50, border: `1.5px solid ${C.warmGray}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: C.white, color: C.textMain, minWidth: 200 }} />
                    <Btn onClick={async () => {
                      setSubEmailError("");
                      if (!isValidEmail(email)) { setSubEmailError("Please enter a valid email address."); return; }
                      setSubLoading(true);
                      const fd = new FormData(); fd.append("type", "newsletter"); fd.append("email", email);
                      await fetch(SOCIAL_LINKS.script, { method: "POST", mode: "no-cors", body: fd });
                      setSubbed(true); setSubLoading(false);
                    }}>{subLoading ? "Subscribing..." : "Subscribe"}</Btn>
                  </div>
                  {subEmailError && <p style={{ fontSize: 12, color: C.brown, margin: 0 }}>{subEmailError}</p>}
                  {subError && <p style={{ fontSize: 13, color: C.brown, margin: 0 }}>Something went wrong — email us at <a href="mailto:hr@saathban.com" style={{ color: C.brown }}>hr@saathban.com</a></p>}
                </div>
              )}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ CONTACT ═══════════ */}
      <section id="contact" className="section-pad" style={{ padding: "100px 0", background: C.bg }}>
        <div style={px}>
          <SecTitle sub="Have questions, ideas, or want to collaborate? We'd love to hear from you.">Contact Us</SecTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, maxWidth: 920, margin: "0 auto", alignItems: "start" }} className="mission-grid">
            <FadeIn>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.green, marginBottom: 24 }}>Reach Out</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {[
                    { href: `mailto:${SOCIAL_LINKS.email}`, label: "Email", value: SOCIAL_LINKS.email, color: C.green, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg> },
                    { href: SOCIAL_LINKS.instagram, label: "Instagram", value: "@saathban", color: C.brown, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.brown} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill={C.brown}/></svg> },
                    { href: SOCIAL_LINKS.facebook, label: "Facebook", value: "Saathban", color: C.green, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
                    { href: SOCIAL_LINKS.linkedin, label: "LinkedIn", value: "Saathban", color: C.green, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> },
                  ].map(({ href, label, value, color, icon }) => (
                    <a key={label} href={href} target={href.startsWith("mailto") ? undefined : "_blank"} rel="noopener noreferrer" style={{ display: "flex", gap: 16, alignItems: "center", textDecoration: "none" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 15, color, fontWeight: 500 }}>{value}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <Card>
                {sent ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${C.green}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <h4 style={{ fontSize: 20, fontWeight: 700, color: C.green, marginBottom: 8 }}>Message Sent!</h4>
                    <p style={{ fontSize: 14, color: C.textMuted }}>We'll get back to you soon at {contact.email}.</p>
                    <span onClick={() => { setSent(false); setContact({ name: "", email: "", message: "", contactType: "General" }); }}
                      style={{ fontSize: 13, color: C.brown, cursor: "pointer", marginTop: 12, display: "inline-block", fontWeight: 600 }}>Send another message</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ fontSize: 18, fontWeight: 700, color: C.green }}>Send Us a Message</h4>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["General", "Volunteer", "Partner"].map(t => (
                          <span key={t} onClick={() => setContact(c => ({ ...c, contactType: t }))}
                            style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, cursor: "pointer", background: contact.contactType === t ? C.green : `${C.warmGray}60`, color: contact.contactType === t ? C.cream : C.textMuted, transition: "all 0.2s ease" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <input placeholder="Your Name" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })}
                      style={{ padding: "13px 18px", borderRadius: 12, border: `1.5px solid ${C.warmGray}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: C.bg }} />
                    <input type="email" placeholder="Your Email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })}
                      style={{ padding: "13px 18px", borderRadius: 12, border: `1.5px solid ${emailError ? C.brown : C.warmGray}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: C.bg }} />
                    {emailError && <p style={{ fontSize: 12, color: C.brown, marginTop: -10, marginBottom: -4 }}>{emailError}</p>}
                    <textarea placeholder="Your Message" rows={4} value={contact.message} onChange={e => setContact({ ...contact, message: e.target.value })}
                      style={{ padding: "13px 18px", borderRadius: 12, border: `1.5px solid ${C.warmGray}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: C.bg, resize: "vertical" }} />
                    <Btn onClick={async () => {
                      setEmailError("");
                      if (!contact.name || !contact.email || !contact.message) return;
                      if (!isValidEmail(contact.email)) { setEmailError("Please enter a valid email address."); return; }
                      const fd = new FormData();
                      fd.append("type", "contact"); fd.append("name", contact.name);
                      fd.append("email", contact.email); fd.append("message", contact.message);
                      fd.append("contactType", contact.contactType);
                      await fetch(SOCIAL_LINKS.script, { method: "POST", mode: "no-cors", body: fd });
                      setSent(true);
                    }}>Send Message</Btn>
                  </div>
                )}
              </Card>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer style={{ background: C.green, color: "rgba(250,243,233,0.7)", padding: "60px 0 32px" }}>
        <div style={px}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 40, marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid rgba(250,243,233,0.1)" }}>
            <div style={{ maxWidth: 280 }}>
              <div style={{ marginBottom: 14 }}>
                <img src="/logo-extended-light.png" alt="Saathban" style={{ height: 48, width: "auto", filter: "brightness(10)" }} />
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>A vibrant ecosystem where generations flourish together. Wisdom inherited, life shared, every age thriving as one.</p>
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.cream, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Quick Links</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {NAV_ITEMS.map(n => (
                  <span key={n.id} onClick={() => scrollTo(n.id)} style={{ cursor: "pointer", fontSize: 14, transition: "color 0.3s" }}
                    onMouseEnter={e => e.target.style.color = C.cream} onMouseLeave={e => e.target.style.color = "rgba(250,243,233,0.7)"}>{n.label}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.cream, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Connect</h4>
              <div style={{ display: "flex", gap: 12 }}>
                <SocialIcon href={`mailto:${SOCIAL_LINKS.email}`} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg>} />
                <SocialIcon href={SOCIAL_LINKS.instagram} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/></svg>} />
                <SocialIcon href={SOCIAL_LINKS.facebook} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>} />
                <SocialIcon href={SOCIAL_LINKS.linkedin} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: 13, color: "rgba(250,243,233,0.4)" }}>
            <span>© 2026 Saathban — Timeless Togetherness. All rights reserved.</span>
            <span style={{ fontSize: 12 }}>Where generations flourish together.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
