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
/* TWO LEVELS, NOT ONE.

   There was a single `volume` on the master gain and a `music`
   boolean beside it, so the only way to have the dice without the
   march was to have neither at a lower level. The owner's ruling is
   two independent sliders — music at 45, game sounds at 70 — and
   two numbers cannot both live on one gain.

   So the master carries the MUTE only, and the two levels sit on
   gains of their own: the bed feeds musicGain, every effect feeds
   fxGain, and both feed master. One switch still silences
   everything, which is the promise the mute makes.

   `volume` is still read back from anybody's stored prefs and used
   as the effects level if they have no `effects` — a person who set
   it once should not be reset to loud by an upgrade.

   `music: true/false` is likewise honoured on the way in: false
   becomes a level of zero rather than being dropped, so a person
   who turned the bed off does not find it playing tomorrow. */
const DEFAULTS = { muted: false, haptics: true, music: 0.45, effects: 0.7 };

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
      const lvl = (v, fallback) =>
        typeof v === "number" ? Math.min(1, Math.max(0, v)) : fallback;
      prefs = {
        muted: !!saved.muted,
        haptics: saved.haptics !== false,
        /* An older prefs blob has one `volume` and a music BOOLEAN.
           Both are honoured rather than discarded: volume becomes
           the effects level, and music:false becomes a music level
           of zero. Somebody who turned the bed off once must not
           find it playing because the shape of the setting
           changed. */
        effects: lvl(saved.effects, lvl(saved.volume, DEFAULTS.effects)),
        music:
          typeof saved.music === "number"
            ? lvl(saved.music, DEFAULTS.music)
            : saved.music === false
            ? 0
            : DEFAULTS.music,
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
  applyLevels();
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
/* THE TWO LEVELS, as gains. master carries the mute alone: one
   switch that silences everything is a promise, and a promise kept
   by one node cannot be half-kept. */
let musicGain = null;
let fxGain = null;
let unlocked = false;

/* Push the stored levels onto the graph. Called on every change and
   once when the graph is built, so there is one place that knows
   how a preference becomes a gain. */
function applyLevels() {
  if (!ctx || !master) return;
  master.gain.value = prefs.muted ? 0 : 1;
  if (musicGain) musicGain.gain.value = prefs.music;
  if (fxGain) fxGain.gain.value = prefs.effects;
}

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  loadPrefs();
  musicGain = ctx.createGain();
  fxGain = ctx.createGain();
  musicGain.connect(master);
  fxGain.connect(master);
  applyLevels();

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
    applyLevels();
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
  g.connect(fxGain || master);
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
  g.connect(fxGain || master);
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
  /* FOUR NOTES CLIMBING, not three — the owner's word for the old
     one was that getting a goti home barely registers, and a
     three-note figure at a sixth of the volume of the win was
     exactly that. It rises further, lands on an octave and holds
     it, and has a bell on top. Still smaller than winning: that is
     the end of the game and this is a good moment inside one. */
  tone(c, t0, { freq: 523.25, dur: 0.16, type: "triangle", peak: 0.2, cutoff: 4200 });
  tone(c, t0 + 0.085, { freq: 659.25, dur: 0.18, type: "triangle", peak: 0.2, cutoff: 4200 });
  tone(c, t0 + 0.17, { freq: 783.99, dur: 0.2, type: "triangle", peak: 0.19, cutoff: 4600 });
  tone(c, t0 + 0.26, { freq: 1046.5, dur: 0.6, type: "triangle", peak: 0.22, cutoff: 6000 });
  tone(c, t0 + 0.28, { freq: 2093.0, dur: 0.42, type: "sine", peak: 0.07, cutoff: 8000 });
  /* the puff of air the confetti goes out on */
  hit(c, t0 + 0.02, { dur: 0.26, peak: 0.13, band: 3400, sweepTo: 900, q: 0.8 });
}

/* A MESSAGE LEAVING. Two hundred milliseconds of air, sweeping
   DOWNWARD.

   It swept UP before, which is the shape of something arriving,
   and the owner's verdict was that it did not sound right. He is
   describing a real thing: a rising sweep is a whistle and reads
   as attention being called; a falling one is a breath and reads
   as something going away from you. Same two hundred milliseconds,
   the other direction, and it stopped being a noise and started
   being a send.

   Quiet enough to sit under conversation, and no pitch in it at
   all — a note would make it an event. */
function sChatSend(c, t0) {
  hit(c, t0, { dur: 0.2, peak: 0.11, band: 4200, sweepTo: 700, q: 0.7, type: "bandpass" });
  hit(c, t0 + 0.02, { dur: 0.16, peak: 0.045, band: 2600, sweepTo: 500, q: 0.5 });
}

/* A GOTI SENT HOME LANDING. Short, low, and physical — the sound
   of a piece being put down hard rather than a sound effect about
   losing. It plays under the capture's own falling fourth, at the
   far end of the flight rather than at the start, because that is
   when the thing actually touches down. */
function sThud(c, t0) {
  tone(c, t0, { freq: 132, to: 62, dur: 0.16, type: "sine", peak: 0.2, cutoff: 500 });
  hit(c, t0, { dur: 0.09, peak: 0.14, band: 260, q: 0.9 });
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
  thud: sThud,
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
    if (prefs.muted || prefs.effects <= 0) {
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
    if (prefs.muted || prefs.effects <= 0) {
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

/* ── ONE TRACK PER GAME ────────────────────────────────────────

   It was a DRONE — three triangles a fifth apart through a slow
   filter sweep, the same for every game with only the root note
   changed. A room tone. It did the job it was written for and the
   owner has asked for something else: music with a step in it.

   LUDO IS A LIGHT MARCH. A 230ms pulse, which is about 260 to the
   minute and reads as walking rather than hurrying; a soft drum on
   the beat; a plucked line over the top in a major key. Forward,
   never frantic, and it must survive twenty minutes without
   becoming something you want to turn off — so the top line moves
   through a small set of notes rather than repeating one phrase at
   you.

   SNAKES IS A WARM LOOP with no drum at all: plucked santoor-ish
   phrases every 430ms, family evening, nothing driving it.

   BOTH ARE SCHEDULED AHEAD ON THE AUDIO CLOCK, not with setTimeout
   — a timer that fires late makes a march limp, and a phone with a
   game on it has plenty of reasons to fire a timer late. One
   interval tops the schedule up every couple of seconds; WebAudio
   plays what has been booked, exactly when it was booked.

   The whole thing hangs off one gain that ramps in and out, so
   nothing here has to know about the mute or the slider. ── */

let bed = null;
let bedWanted = null; // a game key we should be playing once unlocked

/* One plucked note: a short pitched envelope through a lowpass,
   which is a santoor if you keep the attack fast and the tail
   short. */
function pluck(c, at, freq, into, { peak = 0.05, dur = 0.42, cutoff = 2600 } = {}) {
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(cutoff, at);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.28), at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(lp); lp.connect(g); g.connect(into);
  o.start(at);
  o.stop(at + dur + 0.03);
}

/* The soft drum under the march: a low body with a breath of air
   on it, and nothing bright — a click here would turn a march into
   a metronome. */
function beat(c, at, into, level) {
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, at);
  o.frequency.exponentialRampToValueAtTime(74, at + 0.1);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
  o.connect(g); g.connect(into);
  o.start(at);
  o.stop(at + 0.16);
}

/* D major, low and quiet, under everything. */
const MARCH_BASS = [146.83, 146.83, 110.0, 110.0, 123.47, 123.47, 98.0, 98.0];
/* The line over the top: D E F# A B A F# E, which climbs and comes
   home. Two bars of it, then two bars of rest, so it breathes. */
const MARCH_TOP = [
  587.33, 659.25, 739.99, 880.0, 987.77, 880.0, 739.99, 659.25,
  null, null, 587.33, null, 493.88, null, 587.33, null,
];
/* Snakes: a pentatonic phrase that wanders and returns. */
const SANTOOR = [
  392.0, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0, 349.23,
  392.0, 523.25, 587.33, 659.25, 587.33, 523.25, 440.0, 392.0,
];

function buildBed(c, key) {
  const out = c.createGain();
  out.gain.value = 0;
  const warm = c.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 3200;
  warm.Q.value = 0.4;
  out.connect(warm);
  warm.connect(musicGain || master);

  const march = key !== "snakes";
  const step = march ? 0.23 : 0.43;
  const notes = march ? MARCH_TOP : SANTOOR;
  const bass = march ? MARCH_BASS : null;

  /* Booked to here, on the audio clock. */
  let at = c.currentTime + 0.08;
  let n = 0;

  const book = () => {
    /* Two seconds of music ahead at all times. */
    const until = c.currentTime + 2;
    while (at < until) {
      const i = n % notes.length;
      const f = notes[i];
      if (f) pluck(c, at, f, out, march
        ? { peak: 0.035, dur: 0.34, cutoff: 3000 }
        : { peak: 0.045, dur: 0.7, cutoff: 2400 });
      if (march) {
        if (n % 2 === 0) beat(c, at, out, 0.05);
        const b = bass[(n / 2 | 0) % bass.length];
        if (n % 2 === 0) pluck(c, at, b, out, { peak: 0.03, dur: 0.5, cutoff: 700 });
      }
      at += step;
      n += 1;
    }
  };
  book();
  const timer = setInterval(book, 900);

  /* stop() is what stopAmbience calls; there are no oscillators to
     hold on to because every note owns its own and disposes of it. */
  return {
    out,
    key,
    stop() {
      clearInterval(timer);
    },
  };
}

/* Start, or change which game is playing. Safe to call repeatedly:
   the same key twice is a no-op, a different key crossfades by
   stopping and starting, and calling it before a gesture only
   REMEMBERS the wish — browsers refuse audio until somebody has
   touched the page, so unlockSound() below starts what was asked
   for the moment that happens. */
/* A STOP THAT SURVIVES A DOORWAY.

   The setup room and the table are two React screens, so leaving
   one for the other always runs the outgoing screen's cleanup
   BEFORE the incoming screen's effect. Both ask for the same bed;
   the room's stopAmbience fired, the table's startAmbience found no
   bed playing and built a new one, and the music broke across the
   one transition it was specified to carry.

   Measured: four oscillators started in the room, EIGHT after Start
   — same key, same tone, torn in half at the door.

   So a stop is deferred by a beat. If anything asks for the same
   bed inside that beat, the stop is simply cancelled and the
   oscillators that were already running go on running. Leaving the
   game world entirely still stops it, because nothing asks again.

   350ms is chosen against the thing it has to survive — a React
   unmount and mount, which is one frame — with room to spare, and
   it is far below the 700ms the fade itself takes, so a real stop
   is not perceptibly later than it was. */
let bedStopTimer = null;

export function startAmbience(gameKey) {
  bedWanted = gameKey || null;
  if (!gameKey) return stopAmbience();
  if (!unlocked || !ctx) return;
  if (!prefs.music) return;
  if (bed && bed.key === gameKey) {
    /* Somebody has walked through a door and wants the same tone on
       the other side of it. Call off the stop. */
    if (bedStopTimer) {
      clearTimeout(bedStopTimer);
      bedStopTimer = null;
    }
    return;
  }
  stopAmbience({ now: true });
  const c = ensureCtx();
  if (!c) return;
  bed = buildBed(c, gameKey);
  /* In over a second and a half. A bed that arrives at full level is
     a bed you noticed starting. */
  bed.out.gain.cancelScheduledValues(c.currentTime);
  bed.out.gain.setValueAtTime(0, c.currentTime);
  bed.out.gain.linearRampToValueAtTime(1, c.currentTime + 1.6);
}

/* `now` is for the one caller that genuinely means immediately:
   startAmbience, swapping one game's tone for another's. Everything
   else — a screen unmounting, the switch going off — goes through
   the beat, so a handover cannot tear the bed in half. */
export function stopAmbience(opts = {}) {
  if (!opts.now) {
    if (bedStopTimer) clearTimeout(bedStopTimer);
    bedStopTimer = setTimeout(() => {
      bedStopTimer = null;
      stopAmbience({ now: true });
    }, 350);
    return;
  }
  if (bedStopTimer) {
    clearTimeout(bedStopTimer);
    bedStopTimer = null;
  }
  if (!bed || !ctx) { bed = null; return; }
  const b = bed;
  bed = null;
  try {
    const t = ctx.currentTime;
    b.out.gain.cancelScheduledValues(t);
    b.out.gain.setValueAtTime(b.out.gain.value, t);
    b.out.gain.linearRampToValueAtTime(0, t + 0.7);
    /* Every note owns and disposes of its own oscillator, so there
       is no list to stop — only the scheduler to call off. Anything
       already booked plays out under the fade. */
    b.stop();
  } catch {
    /* a context that has gone away has stopped it for us */
  }
}

/* Called when the music preference changes, so the bed follows it
   without anyone leaving the table. */
function syncBedToPrefs() {
  if (!prefs.music) stopAmbience({ now: true });
  else if (bedWanted) startAmbience(bedWanted);
}

/* stopAllSound() below is what silences everything in flight,
   including this. */

