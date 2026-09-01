/* ════════════════════════════════════════════════
   Game feel — the layer that turns "the board changed" into
   something you can hear, see move, and feel in your hand.

   WHY THIS READS THE MOVE LOG INSTEAD OF THE BUTTONS. Sound wired to
   click handlers only ever announces what YOU did. A ludo table with
   three bots would sit in silence, and silence is exactly when a
   person most needs telling that something happened. `game_moves` is
   append-only and already polled by every session screen, so diffing
   it gives us every event — yours, theirs, and the bots' — from one
   place, with no game lane having to remember to make a noise.

   THREE THINGS THIS FILE REFUSES TO DO:

   1. Replay history. Arriving at a table mid-game, or coming back
      after the tab slept, must not fire forty sounds. The first read
      only sets a watermark.
   2. Make a noise for a pass. A pass means nobody acted — there is
      nothing to announce, and a table of absent players must be
      silent. (We watched a cron loop write 350 passes a minute for
      twelve minutes; sounding those would have been a siren.)
   3. Outrun the person. If several moves land at once, only the last
      one is sounded. A flurry of overlapping effects reads as a
      malfunction, not as excitement.

   Motion lives here too so that sound and movement share ONE
   reduced-motion policy rather than each lane inventing its own.
   ════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C } from "../../shared/tokens.js";
import { SEAT_COLORS } from "../routes/games/seatColors.js";
import { playSound, playHopRun, unlockSound } from "./sound.js";
import { hapticCapture, hapticWin, hapticTurn } from "./haptics.js";

/* ── reduced motion, in one place ──────────────── */

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try {
      return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return undefined;
    }
    const on = (e) => setReduced(!!e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/* One gesture anywhere on a game screen is enough to let audio start.
   Browsers require it; we never ask for it, we just take the first
   tap the person was making anyway. */
export function useSoundUnlock() {
  useEffect(() => {
    const go = () => unlockSound();
    window.addEventListener("pointerdown", go, { once: true, passive: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);
}

/* ── reading a move ────────────────────────────── */

const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);

/* How many squares this move travels, for the hop run. Ludo carries
   the die it spent; snakes carries where it landed before any snake
   or ladder took over. */
function stepsOf(gameKey, m) {
  if (gameKey === "snakes") return Math.max(0, num(m.landed) - num(m.from));
  const d = m.die ?? m.dice;
  if (Array.isArray(d)) return num(d[0]?.v ?? d[0]);
  return num(d);
}

/* The sound sequence for one move, as [name, delayMs] pairs. Delays
   are scheduled against WebAudio's own clock inside playSound, so
   they stay even under a busy main thread.

   Exported because it is the answer to "what does this move sound
   like", which is a question a caption strip needs to ask as much as
   the speaker does — and because a pure function mapping a move to
   sounds is the part of this file worth testing directly, without a
   browser, a table, or a bot willing to roll the right number. */
export function soundsForMove(gameKey, m) {
  if (!m || m.pass === true) return [];          // nobody acted — silence
  const out = [];

  if (gameKey === "carrom") {
    out.push(["strike", 0]);
    const scored = Array.isArray(m.scored) ? m.scored.length : 0;
    for (let i = 0; i < Math.min(3, scored); i++) out.push(["pocket", 260 + i * 150]);
    return out;
  }

  /* Both dice games open with the dice themselves. */
  out.push(["dice", 0]);
  const steps = stepsOf(gameKey, m);
  const HOP_AT = 520;                              // after the dice have settled
  const HOP_MS = 190;

  if (gameKey === "snakes") {
    if (m.stuck) return out;                       // rolled past 100: dice, then nothing
    const after = HOP_AT + Math.max(0, steps) * HOP_MS;
    if (m.via === "ladder") out.push(["ladder", after + 60]);
    else if (m.via === "snake") out.push(["snake", after + 60]);
    return out;
  }

  /* ludo */
  if (m.skipped) return out;
  const after = HOP_AT + Math.max(0, steps) * HOP_MS;
  if (m.capture) out.push(["capture", after + 40]);
  if (m.kind === "pair" || m.jota) out.push(["jota", after + 40]);
  return out;
}

/* Play one move's whole sequence — the dice, the hops, and whatever
   the move turned out to be. Shared by both event sources below. */
function soundMove(gameKey, body, silent) {
  /* THEIR SOUNDS, MUTED. The switch is on their profile card and
     it has to reach the speaker, not just the chat — a person you
     have muted whose captures still bang out of the phone has not
     been muted in any sense that matters. */
  if (silent) return;
  const m = body || {};
  const steps = stepsOf(gameKey, m);

  for (const [name, delay] of soundsForMove(gameKey, m)) {
    if (name === "capture") {
      window.setTimeout(() => {
        playSound("capture");
        hapticCapture();
      }, delay);
    } else {
      playSound(name, { delay: delay / 1000 });
    }
  }
  /* THE TICKS WERE PLAYING SOMEWHERE ELSE ON THE BOARD.

     This scheduled a run of hops at 520ms with 190ms between
     them. The ludo board walks its gotis at 140ms a cell and
     starts the instant the new state lands — so the sound of the
     move began half a second after the move did and drifted fifty
     milliseconds further behind on every square. By the sixth cell
     the tick was a full square out. Nobody had heard it against
     the board because nothing ever put the two side by side.

     A ludo hop is now played BY the hop: LudoBoard's walk fires a
     tick on each new cell, so the two cannot come apart no matter
     what either clock is set to. Snakes has no walking board of
     its own and keeps the scheduled run. */
  if (steps > 0 && gameKey === "snakes" && !m.pass && !m.skipped && !m.stuck) {
    window.setTimeout(() => playHopRun(steps, 190), 520);
  }
}

/* ── the hook every session screen calls ───────── */

/**
 * Sounds a table.
 *
 * TWO EVENT SOURCES, because the two lanes store the same fact
 * differently and neither should have to change for audio's sake:
 *   - `moves`: the append-only log (snakes, carrom). Watermarked by id.
 *   - `lastMove` + `eventKey`: ludo, which keeps the last move in
 *     `state.last` and never fetches the log. The key is whatever
 *     changes per move — pieces plus last is reliable, since pieces
 *     cannot come back identical two moves running.
 *
 * Safe to call with nulls while loading.
 */
export function useGameFeel({
  gameKey,
  moves,
  lastMove,
  eventKey,
  status,
  winnerSeat,
  mySeatNo,
  currentSeat,
  /* isSilent(seat) → true when that player's sounds are muted for
     this viewer, at this table. Optional; without it nothing is
     muted, which is the right default. */
  isSilent,
}) {
  useSoundUnlock();
  const seenId = useRef(null);
  const wonRef = useRef(false);
  const turnRef = useRef(null);
  /* which handover we have already chimed for */
  const chimedFor = useRef(null);

  /* Moves → sound. */
  useEffect(() => {
    if (!Array.isArray(moves) || !moves.length) return;
    const top = moves.reduce((a, m) => Math.max(a, num(m.id)), 0);

    // First sight of this table: set the watermark, play nothing.
    if (seenId.current === null) {
      seenId.current = top;
      return;
    }
    if (top <= seenId.current) return;

    const fresh = moves.filter((m) => num(m.id) > seenId.current);
    seenId.current = top;
    if (!fresh.length) return;

    // Several at once (a poll after sleeping, a bot burst): sound only
    // the newest, so the table never sounds like it is panicking.
    soundMove(gameKey, fresh[fresh.length - 1]?.move, isSilent?.(fresh[fresh.length - 1]?.seat));
  }, [moves, gameKey]);

  /* The ludo path: no log, so we watch a key that changes per move. */
  const seenKey = useRef(null);
  useEffect(() => {
    if (eventKey == null) return;
    const first = seenKey.current === null;
    if (seenKey.current === eventKey) return;
    seenKey.current = eventKey;
    if (first) return;             // arriving at a table is not an event
    soundMove(gameKey, lastMove, isSilent?.(lastMove?.seat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, gameKey]);

  /* Winning. Fires once, for everyone at the table — the person who
     lost hears the same warm figure, because a table where only the
     winner gets a sound is a table that rubs it in. */
  useEffect(() => {
    if (status !== "finished" || winnerSeat == null) return;
    if (wonRef.current) return;
    wonRef.current = true;
    // let the last move's sounds land first
    window.setTimeout(() => {
      playSound("win");
      hapticWin();
    }, 420);
  }, [status, winnerSeat]);

  /* Your turn, quietly — only on a real change, never on first paint,
     and never while the table is over. */
  /* A POLL CAN STEP OVER THE HANDOVER.

     This fired only on an observed change from not-mine to mine.
     The board polls every 2.5 seconds and bots answer in about
     one — so a round can go mine → bot → bot → mine entirely
     between two polls, and the client sees mine, then mine. No
     change observed, no chime, and the faster the bots the more
     reliably it is silent.

     So the handover is identified by the LAST MOVE instead. If it
     is my turn and the last thing that happened was somebody
     else's move, the table has just come round to me — whether or
     not any poll caught the moment. Chiming once per distinct
     last-move is what keeps that from repeating on every poll.

     Both paths are kept: the observed transition still fires
     immediately when a poll does catch it, which is a beat
     earlier than waiting for the move to be read. */
  useEffect(() => {
    if (status !== "active" || mySeatNo == null || currentSeat == null) return;
    const isMine = currentSeat === mySeatNo;
    const wasMine = turnRef.current;
    turnRef.current = isMine;

    /* First sight of the table is not a handover. */
    if (wasMine === null || wasMine === undefined) {
      chimedFor.current = eventKey ?? "start";
      return;
    }
    if (!isMine) return;

    const key = eventKey ?? "start";
    const somebodyElseMoved =
      lastMove && lastMove.seat != null && lastMove.seat !== mySeatNo;
    const observed = !wasMine;
    if (!observed && !somebodyElseMoved) return;
    if (chimedFor.current === key) return;
    chimedFor.current = key;
    playSound("yourTurn");
    hapticTurn();
  }, [currentSeat, mySeatNo, status, eventKey, lastMove]);
}

/* ── motion ────────────────────────────────────── */

/* THE ONE reduced-motion policy for games. Every animation in the
   games surface is defined here and switched off here, rather than
   each file redefining its own keyframes inside a media query —
   which works only because a later definition wins, and quietly
   stops working the day someone reorders a stylesheet.

   Under "reduce" nothing moves, but nothing disappears either: the
   token still arrives, the win still lands, the die still shows its
   face. Reduced motion means calmer, not less informed. */
export const GAME_MOTION_CSS = `
/* A DIE BEING THROWN. It used to rock — sixteen degrees each way
   and back, twice, over 420ms, which reads as a shake rather than
   a throw. A die that has been thrown TURNS: past a right angle,
   more than once, travelling while it does it and losing energy as
   it goes.

   Two full turns and a bit, an arc up and down, and it comes to
   rest square — 600ms, the length of the throw. */
/* A DIE BEING THROWN — spinning IN PLACE with a small hop, which
   is the owner's ruling and is also what a die on a table does. It
   travelled six pixels left and eighteen up before this, and a die
   that flies across the screen while its face changes is exactly
   the thing he described: "instead of dice rolling it circles
   moves". The pips looked like they were the ones travelling,
   because they were.

   Two full turns over 600ms, a hop of eight pixels at the top of
   it, no sideways travel at all, coming to rest square. */
/* WRONG, AND REPLACED. A plain CSS rotate() is a rotation in the PLANE of
   the screen: a flat square turning about its own middle, which
   is a card spun on a finger and never a die. The owner's words
   were exact — "it should revolve like a ball round, not like a
   book on your finger" — and this keyframe is the book.

   A thrown die turns about two axes at once, shows several of
   its six faces on the way, and comes down. That cannot be done
   to a flat square at all, however it is eased: it needs six
   faces in space. So the die below is a real cube (Dice.jsx) and
   these are its keyframes.

   TWO AXES, INCOMMENSURATE. 1080deg of Y against 720deg of X
   means the pair never repeats within the throw, so the same
   face is not presented twice at the same moment of the arc and
   the tumble does not read as a loop. The cube rises, hangs, and
   falls — the arc a thrown object makes — and the landing is a
   separate, shorter animation so the settle can overshoot. */
@keyframes saath-throw {
  0%   { transform: translateY(0)     rotateX(0deg)   rotateY(0deg)    rotateZ(0deg); }
  30%  { transform: translateY(-14px) rotateX(230deg) rotateY(320deg)  rotateZ(12deg); }
  60%  { transform: translateY(-11px) rotateX(470deg) rotateY(690deg)  rotateZ(-8deg); }
  85%  { transform: translateY(-3px)  rotateX(650deg) rotateY(950deg)  rotateZ(4deg); }
  100% { transform: translateY(0)     rotateX(720deg) rotateY(1080deg) rotateZ(0deg); }
}
/* THE SECOND HAND. Two dice leaving one hand do not turn in
   lockstep, and a delay would not fix that — a delayed copy of
   the same path is the same path, and both dice would still be
   showing the same face at the same moment, half a beat apart.
   So the pair genuinely turns differently: this one leads on X.

   BOTH END AT A WHOLE NUMBER OF TURNS, and that is the part
   that matters. The throw loops until the answer arrives, so it
   is stopped at whatever moment the server replies — and because
   every iteration ENDS square, stopping it leaves the cube face-
   on rather than at some arbitrary angle. The 300ms turn into
   the rolled face then starts from a known orientation, which is
   what lets it read as the die settling rather than as a cut. */
@keyframes saath-throw-b {
  0%   { transform: translateY(0)     rotateX(0deg)    rotateY(0deg)   rotateZ(0deg); }
  30%  { transform: translateY(-16px) rotateX(340deg)  rotateY(210deg) rotateZ(-14deg); }
  60%  { transform: translateY(-10px) rotateX(700deg)  rotateY(430deg) rotateZ(9deg); }
  85%  { transform: translateY(-4px)  rotateX(960deg)  rotateY(640deg) rotateZ(-5deg); }
  100% { transform: translateY(0)     rotateX(1080deg) rotateY(720deg) rotateZ(0deg); }
}
/* THE LANDING. The cube has stopped turning and is on the table;
   this is the weight arriving after it — one squash and a small
   rebound, 260ms, on the WRAPPER rather than the cube, so it
   cannot fight the 3D transform the cube is holding. */
@keyframes saath-die-land {
  0%   { transform: translateY(-6px) scale(1, 1); }
  35%  { transform: translateY(0)    scale(1.1, 0.88); }
  62%  { transform: translateY(-3px) scale(0.97, 1.04); }
  100% { transform: translateY(0)    scale(1, 1); }
}
/* THE NUMBER IS HELD, AND THE HOLD IS THE POINT.

   The throw ended, the cube turned to its face, and play carried
   straight on — so the owner saw a die stop and a goti move, and
   never read the number in between. A result nobody has time to
   read has not been shown.

   So the die stays up for 800ms after it lands: a little larger
   than life, on a warm halo, then both fade and it is an ordinary
   die again. Scale AND glow rather than either alone — a die at
   1.14 with no halo just looks nearer, and a halo with no size
   change is a decoration on something that has not changed. */
@keyframes saath-die-hold {
  0%   { transform: scale(1);    filter: drop-shadow(0 0 0 rgba(243,206,94,0)); }
  14%  { transform: scale(1.14); filter: drop-shadow(0 0 9px rgba(243,206,94,0.85)); }
  70%  { transform: scale(1.12); filter: drop-shadow(0 0 8px rgba(243,206,94,0.72)); }
  100% { transform: scale(1);    filter: drop-shadow(0 0 0 rgba(243,206,94,0)); }
}
/* The squash first, then the hold. Two animations on one element,
   sequenced by a delay rather than merged into one keyframe, so
   the landing keeps the timing it was tuned with. */
.sb-die-land {
  animation:
    saath-die-land 260ms cubic-bezier(.2,.8,.3,1) 1 both,
    saath-die-hold 800ms ease-out 200ms 1 both;
}
@keyframes saath-nudge {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  45% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
}
@keyframes saath-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-3px) rotate(-4deg); }
  45% { transform: translateX(3px)  rotate(4deg); }
  70% { transform: translateX(-2px) rotate(-2deg); }
}
@keyframes saath-press {
  from { transform: scale(1); }
  to   { transform: scale(0.94); }
}
@keyframes saath-confetti-fall {
  from { transform: translateY(-12vh) rotate(0deg); opacity: 1; }
  to   { transform: translateY(88vh) rotate(var(--spin, 360deg)); opacity: 0; }
}
/* One square's worth of hop. Small on purpose — this fires once per
   square of a six-square run, and anything springier becomes seasick
   by the fourth. The units are SVG user units, not pixels. */
@keyframes saath-hop-arc {
  0%   { transform: translateY(0); }
  45%  { transform: translateY(-2.1px); }
  100% { transform: translateY(0); }
}
@keyframes saath-win-pop {
  0%   { transform: scale(0.92); }
  55%  { transform: scale(1.04); }
  100% { transform: scale(1); }
}
.sb-shake { animation: saath-shake 0.42s ease-in-out 1; }
/* The SVG pair of the two above. A board piece is positioned by its
   cx/cy attributes, not by a transform, so any CSS rotate or scale
   pivots around the SVG's ORIGIN and flings the piece across the
   board. Translation is origin-independent, so it is the only safe
   shake here — and opacity is the only safe press. */
.sb-nudge { animation: saath-nudge 0.42s ease-in-out 1; }
.sb-press-svg { transition: opacity 0.09s ease-out; }
.sb-press-svg:active { opacity: 0.65; }
.sb-hop { animation: saath-hop-arc 150ms ease-out 1; }
.sb-win-pop { animation: saath-win-pop 0.5s ease-out 1; }
/* 100ms, matching lib/motion.jsx. Same feeling, one number —
   the mechanic differs (scale here, tint there) and that is
   deliberate; the duration has no reason to. */
.sb-pressable { transition: transform 0.1s ease-out; }
.sb-pressable:active { transform: scale(0.94); }

/* ── the living table ── */
@keyframes saath-bubble-in {
  0%   { opacity: 0; transform: translateY(6px) scale(0.94); }
  100% { opacity: 1; transform: none; }
}
@keyframes saath-bubble-out {
  0%   { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes saath-think {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 1; }
}
/* THE ARROW AT THE DICE BREATHES — it scales up and down and
   stays where it is. It used to hop, which on a table where the
   dice are now the roll control read as the dice being knocked
   rather than as something pointing at them. A breath is
   continuous and has no impact in it, so a person can look away
   from it and it is still saying the same thing when they look
   back.

   transform-origin at the bottom, so it grows out of the tip
   rather than around its own middle: the tip is the end that is
   doing the pointing and it must not move. */
@keyframes saath-die-bounce {
  0%, 100%  { transform: scale(0.86); }
  50%       { transform: scale(1.16); }
}
@keyframes saath-cell-flash {
  0%   { opacity: 0.85; }
  100% { opacity: 0; }
}
@keyframes saath-ceremony-in {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
/* A remark by its speaker's corner: in quickly, then it lingers and
   goes. Both halves are one animation so nothing has to time out in
   JavaScript to look right. */
.sb-bubble {
  animation: saath-bubble-in 0.22s ease-out 1, saath-bubble-out 0.5s ease-in 3.7s 1 forwards;
}
/* "thinking…" — a slow breath, not a spinner. */
.sb-think { animation: saath-think 1.6s ease-in-out infinite; }
/* The arrow over the active player's die: it BOUNCES, because it is
   an instruction rather than a decoration (LUDO_UI_SPEC §4). Under
   reduced motion it stops bouncing and stays put — the arrow is the
   instruction, the bounce is only emphasis, and suppressing the whole
   thing would take away the answer along with the animation. */
.sb-die-arrow {
  transform-origin: 50% 100%;
  animation: saath-die-bounce 1.5s ease-in-out infinite;
}
/* A capture: the square flashes and fades. */
/* Rendered by routes/games/ludo/LudoBoard.jsx, not by anything in
   this file — so a grep here finds the definition and no consumer,
   which reads exactly like dead code. It is not. The keyframe lives
   here because this is where the games animations live; the board's
   own BOARD_MOTION_CSS now carries a matching reduced-motion rule, so
   coverage survives either file being tidied. Both are deliberate. */
.sb-cell-flash { animation: saath-cell-flash 0.65s ease-out 1 forwards; }
.sb-ceremony { animation: saath-ceremony-in 0.25s ease-out 1; }

@media (prefers-reduced-motion: reduce) {
  /* Disable the animation itself rather than redefining keyframes:
     one rule, and it cannot be defeated by source order. */
  .sb-shake, .sb-nudge, .sb-hop, .sb-win-pop, .sb-confetti-piece,
  [style*="saath-throw"], .sb-tumbling, .sb-die-land,
  .sb-think, .sb-die-arrow, .sb-cell-flash, .sb-ceremony {
    animation: none !important;
  }
  /* A bubble must still disappear without motion, or a remark would
     hang on the board for ever — keep the fade, drop the travel. */
  .sb-bubble {
    animation: saath-bubble-out 0.3s linear 3.9s 1 forwards !important;
  }
  .sb-pressable, .sb-pressable:active {
    transition: none !important;
    transform: none !important;
  }
  .sb-press-svg, .sb-press-svg:active {
    transition: none !important;
  }
}
`;

export function GameMotionStyles() {
  return <style>{GAME_MOTION_CSS}</style>;
}

/* ── confetti ──────────────────────────────────── */

/* The seat palette, not the brand palette. It was chosen to stay
   distinct for the commonest colour-vision differences and to sit
   warmly on cream — which is exactly what confetti needs — and it
   means the paper matches the tokens people have been looking at all
   game. Two soft brand tones are folded in so it reads as Saathban
   rather than as a party pack. */
const CONFETTI_COLORS = [...SEAT_COLORS, C.olive, C.sage].filter(Boolean);

/* Brand colours, gentle fall, gone in three seconds. Renders nothing
   at all under reduced motion — the win already announces itself in
   words, a sound, and a badge, so losing the confetti costs no
   information. `aria-hidden` throughout: a screen reader must not
   read out sixty pieces of paper. */
export function Confetti({ active, pieces = 26 }) {
  const reduced = usePrefersReducedMotion();
  const [alive, setAlive] = useState(false);

  useEffect(() => {
    if (!active || reduced) return undefined;
    setAlive(true);
    const id = window.setTimeout(() => setAlive(false), 3200);
    return () => window.clearTimeout(id);
  }, [active, reduced]);

  const bits = useRef(null);
  if (!bits.current) {
    bits.current = Array.from({ length: pieces }, (_, i) => ({
      left: Math.round((i / pieces) * 100 + (Math.random() * 6 - 3)),
      delay: Math.round(Math.random() * 700),
      dur: 2200 + Math.round(Math.random() * 1100),
      size: 7 + Math.round(Math.random() * 7),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      spin: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.round(Math.random() * 360)),
      round: Math.random() > 0.6,
    }));
  }

  if (!alive || reduced) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 60,
      }}
    >
      {bits.current.map((b, i) => (
        <span
          key={i}
          className="sb-confetti-piece"
          style={{
            position: "absolute",
            top: 0,
            left: `${b.left}%`,
            width: b.size,
            height: b.round ? b.size : Math.round(b.size * 0.6),
            background: b.color,
            borderRadius: b.round ? "50%" : 2,
            opacity: 0.9,
            "--spin": `${b.spin}deg`,
            animation: `saath-confetti-fall ${b.dur}ms ease-in ${b.delay}ms 1 forwards`,
          }}
        />
      ))}
    </div>
  );
}
