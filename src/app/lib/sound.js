/* ════════════════════════════════════════════════
   Game sound — warm, soft, synthesised.

   THE RULE THIS FILE EXISTS TO KEEP: joy, not a slot machine. Every
   sound here is a wooden or a human sound — dice on a table, a goti
   set down, a hand drum — and never a machine congratulating you.
   That means, concretely and throughout:

   - sines and triangles, never sawtooth or square. A saw wave is the
     sound of an arcade cabinet;
   - every voice goes through a lowpass. Nothing above ~6kHz survives,
     because the sparkle in the top octave is exactly what makes a
     sound feel like a payout;
   - attacks are 4-12ms, not instant. An instant attack is a click,
     and a click is a machine;
   - nothing rises in pitch on success except the win, and that one
     rises a fourth and stops. A long ascending run is a jackpot.

   NO FILES, NO NETWORK. Everything is generated with WebAudio at the
   moment it plays: nothing to bundle, nothing to fetch, no CDN, and
   nothing to go missing on a slow Karachi connection. The whole
   sound design is about 200 lines of arithmetic.

   HEARING IS NOT WHAT IT WAS AT THIRTY. High frequencies go first,
   so the *information* in these sounds lives between 200Hz and 2kHz
   where it stays audible longest — and no sound is ever the only
   signal for anything. Every event that makes a noise also shows
   itself on screen. Sound is a garnish here, never a channel.
   ════════════════════════════════════════════════ */

const STORE_KEY = "saathban.app.sound";

/* Effects are ON by default: a silent board feels broken, and the
   mute control is one tap away. (There is no longer a background bed
   for anything to be off-by-default about — see §7 below.)
   Volume defaults to 0.7 rather than 1.0 so the first sound a person
   ever hears is gentle — it is easier to turn something up than to
   forgive it for being loud once. */
/* `music` is ON by default, which is the owner's reversal of his own
   earlier ruling and the reason the bed is back. It is a separate
   key from `muted` on purpose: somebody who wants the dice and the
   capture but not the drone should not have to give up both, and
   the mute on the table still silences everything above it. */
const DEFAULTS = { volume: 0.7, muted: false, haptics: true, music: true };

let prefs = { ...DEFAULTS };
let loaded = false;
const listeners = new Set();

function loadPrefs() {
  if (loaded) return prefs;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      prefs = {
        volume: typeof saved.volume === "number" ? Math.min(1, Math.max(0, saved.volume)) : DEFAULTS.volume,
        muted: !!saved.muted,
        /* The old ambient flag is deliberately NOT read back. A person
           who once switched the bed on has it sitting in their
           localStorage, and reading it would be the only way the
           deleted feature could return. */
        haptics: saved.haptics !== false,
        /* remembered per person, and undefined means the new default */
        music: saved.music !== false,
      };
    }
  } catch {
    /* storage off, or a half-written value — the defaults are fine */
  }
  return prefs;
}

export function getSoundPrefs() {
  return { ...loadPrefs() };
}

export function setSoundPrefs(patch) {
  loadPrefs();
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
  } catch {
    /* preference won't survive the session; the sound still obeys it now */
  }
  if (ctx && master) master.gain.value = prefs.muted ? 0 : prefs.volume;
  syncBedToPrefs();
  for (const fn of listeners) fn({ ...prefs });
  return { ...prefs };
}

export function onSoundPrefs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ── the audio graph ───────────────────────────── */

let ctx = null;
let master = null;
let unlocked = false;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = loadPrefs().muted ? 0 : prefs.volume;

  /* A gentle limiter, not a loudness maximiser. Its whole job is to
     catch the one case where three sounds land on the same frame —
     a capture during a hop during a roll — and keep that from
     becoming a bang. Slow attack and a soft knee so it never pumps. */
  const soft = ctx.createDynamicsCompressor();
  soft.threshold.value = -18;
  soft.knee.value = 24;
  soft.ratio.value = 3;
  soft.attack.value = 0.02;
  soft.release.value = 0.25;

  master.connect(soft);
  soft.connect(ctx.destination);
  return ctx;
}

/* Browsers refuse to make noise until a person has touched the page.
   Call this from any real gesture; calling it twice is free. */
export function unlockSound() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  unlocked = true;
  /* Whatever asked for music before anybody had touched the page
     gets it now. This is the whole autoplay dance: we never prompt
     for a gesture, we take the first one the person was making
     anyway. */
  if (bedWanted) startAmbience(bedWanted);
}

export function isSoundReady() {
  return !!ctx && unlocked && ctx.state === "running";
}

/* EVERYTHING STOPS, NOW.

   §7: "Audio must stop when the game screen unmounts. Sound currently
   continues after leaving a game. This is a lifecycle bug: the audio
   graph is not tied to the component's teardown."

   It was. Effects were fired as one-shot nodes that outlive whatever
   scheduled them, so a capture flourish begun the instant you tapped
   Leave went on playing over the games list. Suspending the context
   is the only thing that catches sounds already in flight — stopping
   sources one by one races them.

   Called on unmount, on route change and on tab-hide. Idempotent, and
   safe before any sound has ever played. */
export function stopAllSound() {
  if (!ctx) return;
  try {
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
    }
    ctx.suspend().catch(() => {});
  } catch {
    /* an already-closed context is the state we wanted anyway */
  }
}

/* And the way back, for the next game screen that mounts. */
export function resumeSound() {
  if (!ctx || !unlocked) return;
  try {
    if (master) master.gain.value = prefs.muted ? 0 : prefs.volume;
    ctx.resume().catch(() => {});
    if (bedWanted && !bed) startAmbience(bedWanted);
  } catch {
    /* nothing to resume */
  }
}

/* Leaving the tab silences everything. This is also the honest half
   of "respect the silent switch": iOS WebAudio plays straight through
   the hardware mute switch and gives us no way to read it, so the
   controls we DO have — an explicit mute, a conservative default
   volume, and silence the moment the page is out of sight — have to
   carry that weight instead. */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) stopAllSound();
    else resumeSound();
  });
}

/* ── synthesis helpers ─────────────────────────── */

let noiseBuf = null;
function noise(c) {
  if (!noiseBuf) {
    const n = Math.floor(c.sampleRate * 1.2);
    noiseBuf = c.createBuffer(1, n, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    /* Brown-ish noise rather than white: integrating the random walk
       tilts the spectrum down, which is the difference between a
       wooden rattle and radio static. */
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

/* One pitched voice with a soft attack and an exponential tail. */
function tone(c, at, { freq, to, dur = 0.2, type = "sine", peak = 0.2, cutoff = 3000, q = 0.7 }) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  lp.Q.value = q;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  osc.connect(lp);
  lp.connect(g);
  g.connect(master);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/* One unpitched voice — wood, air, a hand on a drum skin. */
function hit(c, at, { dur = 0.12, peak = 0.2, band = 1200, q = 1.2, sweepTo = null, type = "bandpass" }) {
  const src = noise(c);
  src.playbackRate.value = 0.8 + Math.random() * 0.4;

  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(band, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), at + dur);
  f.Q.value = q;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

/* ── the sounds ────────────────────────────────── */

/* Dice tumbling on a wooden table: five or six irregular knocks that
   slow and quieten, then nothing. The irregularity is the point — an
   evenly spaced rattle sounds mechanical. */
function sDice(c, t0) {
  let at = t0;
  const knocks = 5 + Math.floor(Math.random() * 2);
  for (let i = 0; i < knocks; i++) {
    const fall = i / knocks;
    hit(c, at, { dur: 0.05 + fall * 0.03, peak: 0.26 * (1 - fall * 0.55), band: 2200 - fall * 900, q: 1.6 });
    at += 0.055 + fall * 0.06 + Math.random() * 0.03;
  }
  /* the last one settles: a little wooden body under it */
  tone(c, at, { freq: 210, to: 150, dur: 0.14, type: "triangle", peak: 0.1, cutoff: 900 });
}

/* One square. Tiny, dry, and pitched a touch higher each step so a
   six-square run reads as a little rising phrase rather than six
   identical taps. `step` climbs, `of` is how many are coming. */
function sHop(c, t0, step = 0, of = 1) {
  const climb = of > 1 ? Math.min(1, step / Math.max(1, of - 1)) : 0;
  const freq = 620 * Math.pow(2, climb * 0.33); // up a major third across the run
  tone(c, t0, { freq, to: freq * 0.94, dur: 0.075, type: "sine", peak: 0.13, cutoff: 2400 });
  hit(c, t0, { dur: 0.035, peak: 0.07, band: 1800, q: 2 });
}

/* A capture. Warm and a little rueful — a falling fourth with a soft
   wooden knock under it. It must be unmistakable without being
   unkind: someone just lost a goti, and the board should acknowledge
   that, not celebrate it at them. */
function sCapture(c, t0) {
  hit(c, t0, { dur: 0.1, peak: 0.22, band: 700, q: 1.1 });
  tone(c, t0 + 0.01, { freq: 392, to: 294, dur: 0.3, type: "triangle", peak: 0.2, cutoff: 1800 });
  tone(c, t0 + 0.09, { freq: 196, to: 147, dur: 0.34, type: "sine", peak: 0.13, cutoff: 900 });
}

/* Jota — two goti standing together. A solid wooden thunk, the sound
   of setting a heavy piece down deliberately. Low and short. */
function sJota(c, t0) {
  hit(c, t0, { dur: 0.09, peak: 0.24, band: 480, q: 1.4 });
  tone(c, t0, { freq: 150, to: 96, dur: 0.2, type: "triangle", peak: 0.24, cutoff: 700 });
  tone(c, t0 + 0.015, { freq: 300, to: 240, dur: 0.1, type: "sine", peak: 0.08, cutoff: 1400 });
}

/* Up a ladder: air moving, rising, gone. Filtered noise sweeping up
   with a quiet pitched ghost riding along so it has a direction even
   for ears that have lost the top end. */
function sLadder(c, t0) {
  hit(c, t0, { dur: 0.42, peak: 0.15, band: 500, sweepTo: 2600, q: 0.9, type: "bandpass" });
  tone(c, t0 + 0.02, { freq: 330, to: 660, dur: 0.4, type: "sine", peak: 0.1, cutoff: 3000 });
}

/* Down a snake: the same air going the other way, slower and lower,
   with a slight wobble in the tail. Longer than the ladder because
   falling takes longer than climbing — and because the extra beat
   gives the screen time to show what happened. */
function sSnake(c, t0) {
  hit(c, t0, { dur: 0.55, peak: 0.16, band: 2200, sweepTo: 260, q: 0.8, type: "bandpass" });
  tone(c, t0 + 0.02, { freq: 520, to: 165, dur: 0.5, type: "sine", peak: 0.11, cutoff: 2200 });
  tone(c, t0 + 0.3, { freq: 180, to: 150, dur: 0.22, type: "triangle", peak: 0.07, cutoff: 800 });
}

/* Carrom: the striker. A hard flick on a polished board — bright and
   very short, with a woody body under it. This is the one sound
   allowed to be crisp, because that crispness IS the game. */
function sStrike(c, t0) {
  hit(c, t0, { dur: 0.045, peak: 0.3, band: 2600, q: 2.2 });
  tone(c, t0, { freq: 440, to: 330, dur: 0.09, type: "triangle", peak: 0.14, cutoff: 2600 });
}

/* Carrom: a coin dropping into the net. A short descending plop with
   the pocket's soft thud after it. */
function sPocket(c, t0) {
  tone(c, t0, { freq: 480, to: 190, dur: 0.16, type: "sine", peak: 0.22, cutoff: 2000 });
  hit(c, t0 + 0.1, { dur: 0.14, peak: 0.16, band: 320, q: 0.9 });
  tone(c, t0 + 0.12, { freq: 130, to: 100, dur: 0.18, type: "triangle", peak: 0.1, cutoff: 600 });
}

/* Winning. A dhol figure — dha, dhin, dhin, dha — under a short
   pentatonic run that rises a fourth and stops. Under a second and a
   half in total.

   What it deliberately is NOT: no ascending scale that keeps
   climbing, no bells, no coins, no fanfare that repeats. It is the
   sound of people at a table being pleased for you, and then getting
   on with the next game. */
function sWin(c, t0) {
  const dha = (at, peak) => {
    tone(c, at, { freq: 190, to: 78, dur: 0.26, type: "sine", peak, cutoff: 700 });
    hit(c, at, { dur: 0.08, peak: peak * 0.5, band: 420, q: 1.1 });
  };
  const dhin = (at, peak) => {
    tone(c, at, { freq: 330, to: 250, dur: 0.14, type: "triangle", peak, cutoff: 1600 });
    hit(c, at, { dur: 0.05, peak: peak * 0.45, band: 1500, q: 1.8 });
  };
  dha(t0, 0.3);
  dhin(t0 + 0.19, 0.2);
  dhin(t0 + 0.33, 0.18);
  dha(t0 + 0.5, 0.28);
  dhin(t0 + 0.72, 0.16);
  dha(t0 + 0.86, 0.24);

  /* D-E-G-A-D: a major-pentatonic phrase, warm and finished. */
  const run = [294, 330, 392, 440, 587];
  run.forEach((f, i) => {
    tone(c, t0 + 0.06 + i * 0.13, {
      freq: f,
      dur: i === run.length - 1 ? 0.7 : 0.3,
      type: "sine",
      peak: i === run.length - 1 ? 0.2 : 0.14,
      cutoff: 2600,
    });
  });
}

/* A turn arriving. The quietest thing in the file: two soft notes, a
   nudge rather than an alert. It exists because a person may be
   looking away from the phone while a bot thinks. */
/* IT IS YOUR GO. Two notes rising a fourth, with a third voice an
   octave up that decays fast — the little bell on top is what
   makes it carry over a room without being loud.

   DISTINCT FROM THE BED BY DESIGN, and it has to be: the drone
   sits on A at 110Hz through a 520Hz lowpass, so a chime in the
   same register would be felt as the music swelling rather than
   as anything addressed to you. This lives two octaves above it
   and has a fast attack, which is the opposite of everything the
   bed does.

   Slightly warmer and a little more present than the version
   nobody could hear: a triangle rather than a pure sine, and the
   cutoff opened so the top note keeps its edge. */
function sYourTurn(c, t0) {
  tone(c, t0, { freq: 392, dur: 0.2, type: "triangle", peak: 0.16, cutoff: 3200 });
  tone(c, t0 + 0.12, { freq: 523.25, dur: 0.34, type: "triangle", peak: 0.15, cutoff: 3200 });
  tone(c, t0 + 0.14, { freq: 1046.5, dur: 0.22, type: "sine", peak: 0.05, cutoff: 5200 });
}

/* A GOTI REACHING HOME. The one unambiguously good thing that can
   happen to a piece, and until now it happened in silence.

   Bright, short, and finished: a rising third with an octave on
   top, and a soft puff of air under it that is the confetti. Half
   a second in total — it will fire four times in a good game and
   twice in a row when somebody runs two pieces in, so anything
   longer would start to overlap itself.

   DELIBERATELY SMALLER THAN sWin. Getting one goti home is a good
   moment; winning is the end of the game. If they sounded alike
   the second would stop meaning anything. */
function sHome(c, t0) {
  tone(c, t0, { freq: 523.25, dur: 0.16, type: "triangle", peak: 0.16, cutoff: 4000 });
  tone(c, t0 + 0.09, { freq: 659.25, dur: 0.2, type: "triangle", peak: 0.15, cutoff: 4000 });
  tone(c, t0 + 0.17, { freq: 1046.5, dur: 0.34, type: "sine", peak: 0.11, cutoff: 6000 });
  /* the puff: a short breath of air, swept down, so the chime has
     something physical under it rather than floating */
  hit(c, t0 + 0.02, { dur: 0.22, peak: 0.1, band: 3200, sweepTo: 900, q: 0.8 });
}

/* A MESSAGE LEAVING. About two hundred milliseconds of air moving
   away from you — a band of noise sweeping UP and thinning out,
   which is the shape every "sent" sound has had since the first
   one, because it is what a thing departing actually sounds like.

   No pitch in it at all. A note would make it an event; this is
   meant to be felt and not noticed. */
function sChatSend(c, t0) {
  hit(c, t0, { dur: 0.2, peak: 0.13, band: 700, sweepTo: 4200, q: 0.6, type: "bandpass" });
  hit(c, t0 + 0.03, { dur: 0.14, peak: 0.05, band: 1800, sweepTo: 6000, q: 0.5 });
}

/* A press. Almost subliminal — it exists so a tap on a die or a goti
   feels like it landed on something solid. */
function sTap(c, t0) {
  tone(c, t0, { freq: 300, to: 260, dur: 0.05, type: "sine", peak: 0.08, cutoff: 1400 });
}

const VOICES = {
  dice: sDice,
  hop: sHop,
  capture: sCapture,
  jota: sJota,
  ladder: sLadder,
  snake: sSnake,
  strike: sStrike,
  pocket: sPocket,
  win: sWin,
  yourTurn: sYourTurn,
  home: sHome,
  chatSend: sChatSend,
  tap: sTap,
};

export const SOUND_NAMES = Object.keys(VOICES);

/* ── announcing what was played ────────────────── */

/* Every sound also announces itself, whether or not it was audible.

   This is not instrumentation bolted on for a test — it is the seam
   that keeps the promise made at the top of this file. Sound is never
   allowed to be the only channel, and the honest way to guarantee
   that is to let the screen subscribe to the same events the speaker
   gets: a caption strip, a "what just happened" line, or a person's
   own preference for seeing rather than hearing can all be built on
   this without touching a single game lane.

   `audible` is false when the sound was suppressed (muted, volume at
   zero, audio not yet unlocked), which is exactly when a visual
   channel matters most. */
const soundListeners = new Set();

export function onSoundPlayed(fn) {
  soundListeners.add(fn);
  return () => soundListeners.delete(fn);
}

function announce(name, audible) {
  const detail = { name, audible, at: Date.now() };
  for (const fn of soundListeners) {
    try {
      fn(detail);
    } catch {
      /* a bad listener must never break the game */
    }
  }
  try {
    window.dispatchEvent(new CustomEvent("saath:sound", { detail }));
  } catch {
    /* no window, or CustomEvent unavailable */
  }
}

/* Play one sound. Never throws, never blocks, and does nothing at all
   if audio is muted, unavailable, or not yet unlocked by a gesture —
   a game must play perfectly in silence. */
export function playSound(name, opts = {}) {
  try {
    if (!VOICES[name]) return false;
    loadPrefs();
    if (prefs.muted || prefs.volume <= 0) {
      announce(name, false);
      return false;
    }
    const c = ensureCtx();
    if (!c || c.state !== "running") {
      announce(name, false);
      return false;
    }
    const at = c.currentTime + (opts.delay || 0);
    VOICES[name](c, at, opts.step, opts.of);
    announce(name, true);
    return true;
  } catch {
    return false;
  }
}

/* A run of hops, scheduled as one phrase rather than fired from a
   timer — WebAudio's clock is sample-accurate and setTimeout is not,
   and an uneven hop rhythm is instantly noticeable. */
export function playHopRun(count, spacingMs = 190) {
  try {
    loadPrefs();
    const n = Math.max(1, Math.min(24, count));
    if (prefs.muted || prefs.volume <= 0) {
      announce("hopRun", false);
      return false;
    }
    const c = ensureCtx();
    if (!c || c.state !== "running") {
      announce("hopRun", false);
      return false;
    }
    for (let i = 0; i < n; i++) sHop(c, c.currentTime + (i * spacingMs) / 1000, i, n);
    announce("hopRun", true);
    return true;
  } catch {
    return false;
  }
}

/* ── background music ──────────────────────────────────────────

   RULING REVERSED. GAMES_BACKLOG A5 asked for an ambient bed; §7
   cancelled it outright and I deleted the feature, its toggle and
   its start-up paths. The owner has now reversed that, so it is
   built again rather than un-commented — the old one was removed
   properly and there was nothing left to switch back on.

   WHAT IT IS. Three quiet voices: a root drone, a fifth above it,
   and a very slow filter sweep that keeps the pair from sitting
   dead still. No melody, no rhythm, nothing that resolves — a room
   tone rather than a tune, because a tune has a length and this
   plays for as long as somebody takes over a move.

   PER GAME, by root note rather than by arrangement: ludo sits on
   A, snakes a tone below it, carrom a third above. The same room,
   three different afternoons in it.

   It runs through `master` like everything else, so the mute on the
   table silences it with one tap and the volume slider governs it.
   It is deliberately about a fifth of the level of the dice: it
   should be the thing you notice stopping, not the thing you notice
   starting. */

const ROOTS = { ludo: 110, snakes: 98, carrom: 123.47, daily_puzzle: 130.81 };
let bed = null;
let bedWanted = null; // a game key we should be playing once unlocked

function buildBed(c, key) {
  const root = ROOTS[key] || 110;
  const out = c.createGain();
  out.gain.value = 0;
  const warm = c.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 520;
  warm.Q.value = 0.4;
  out.connect(warm);
  warm.connect(master);

  /* Two voices a fifth apart, each very slightly detuned against
     itself, which is what stops a synth drone sounding like a test
     tone. */
  const oscs = [];
  for (const [mult, level, cents] of [[1, 0.055, -4], [1.5, 0.032, 5], [2, 0.016, -9]]) {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = root * mult;
    o.detune.value = cents;
    const g = c.createGain();
    g.gain.value = level;
    o.connect(g);
    g.connect(out);
    o.start();
    oscs.push(o);
  }

  /* The slow sweep. Twenty-three seconds is chosen to not line up
     with anything a person does — a cycle that matched the turn
     clock would start to feel like a countdown. */
  const lfo = c.createOscillator();
  lfo.frequency.value = 1 / 23;
  const lfoAmt = c.createGain();
  lfoAmt.gain.value = 130;
  lfo.connect(lfoAmt);
  lfoAmt.connect(warm.frequency);
  lfo.start();
  oscs.push(lfo);

  return { out, oscs, key };
}

/* Start, or change which game is playing. Safe to call repeatedly:
   the same key twice is a no-op, a different key crossfades by
   stopping and starting, and calling it before a gesture only
   REMEMBERS the wish — browsers refuse audio until somebody has
   touched the page, so unlockSound() below starts what was asked
   for the moment that happens. */
export function startAmbience(gameKey) {
  bedWanted = gameKey || null;
  if (!gameKey) return stopAmbience();
  if (!unlocked || !ctx) return;
  if (!prefs.music) return;
  if (bed && bed.key === gameKey) return;
  stopAmbience();
  const c = ensureCtx();
  if (!c) return;
  bed = buildBed(c, gameKey);
  /* In over a second and a half. A bed that arrives at full level is
     a bed you noticed starting. */
  bed.out.gain.cancelScheduledValues(c.currentTime);
  bed.out.gain.setValueAtTime(0, c.currentTime);
  bed.out.gain.linearRampToValueAtTime(1, c.currentTime + 1.6);
}

export function stopAmbience() {
  if (!bed || !ctx) { bed = null; return; }
  const b = bed;
  bed = null;
  try {
    const t = ctx.currentTime;
    b.out.gain.cancelScheduledValues(t);
    b.out.gain.setValueAtTime(b.out.gain.value, t);
    b.out.gain.linearRampToValueAtTime(0, t + 0.7);
    for (const o of b.oscs) o.stop(t + 0.8);
  } catch {
    /* a context that has gone away has stopped it for us */
  }
}

/* Called when the music preference changes, so the bed follows it
   without anyone leaving the table. */
function syncBedToPrefs() {
  if (!prefs.music) stopAmbience();
  else if (bedWanted) startAmbience(bedWanted);
}

/* stopAllSound() below is what silences everything in flight,
   including this. */

