/* ════════════════════════════════════════════════
   The boast card — GAMES_BACKLOG A1.

   A PNG of a finished game, drawn on a canvas so it can leave the app:
   a phone's share sheet takes a file, WhatsApp shows it inline, and
   somebody's daughter in Toronto sees the game without installing
   anything.

   WHAT IS ON IT, AND WHAT IS NOT. The winner, crowned, with their photo
   if they have one. Everyone else below, by name, the same size as each
   other — there is no second place on this card, because the app has no
   ranking anywhere else and a picture that leaves the app is the last
   place to invent one. The date, a warm line, the board as it finished,
   and the Saathban mark. No scores, no streaks, no comparison of skill.

   THE BOARD IS DRAWN FROM THE REAL GEOMETRY — board.js's TRACK, yards
   and home columns — rather than a hand-drawn picture of a board. The
   ring has been re-phased twice already; a decorative copy would have
   started lying the first time and nobody would have noticed, because a
   picture cannot fail a test.

   TWO THINGS THAT BREAK CANVASES, both handled rather than hoped:

   · A REMOTE IMAGE TAINTS THE CANVAS. Drawing a profile photo from
     storage without CORS makes toBlob() throw SecurityError, and the
     whole card is lost to save a face. The photo is loaded with
     crossOrigin and a timeout, and ANY failure falls back to the
     initial — the card always renders.

   · FONTS ARE NOT READY WHEN THE CANVAS IS. Nastaliq is a heavy face
     loaded from Google; drawing before it arrives silently gives you
     Times. We wait for the faces we are about to use, with a timeout so
     a slow network delays the card rather than losing it.
   ════════════════════════════════════════════════ */

import {
  TRACK,
  HOME_COLUMNS,
  YARD_ORIGIN,
  YARD_SPOTS,
  START_ABS,
  cellFor,
} from "./ludo/board.js";
import { SEAT_COLORS, SEAT_DEEP, SEAT_TINTS, SEAT_INK } from "./seatColors.js";

export const CARD_SIZE = 1080; // square: the shape every app accepts

const CREAM = "#FAF3E9";
const INK = "#2d2418";
const MUTED = "#6b5e52";
const GREEN = "#063214";
const WHITE = "#FFFFFF";

/* ── fonts ─────────────────────────────────────────────────────────
   Ask for exactly the faces we will draw with. document.fonts.load
   resolves when they are usable; the race gives up rather than hanging
   a share behind a slow CDN. */
async function waitForFonts(families, ms = 2500) {
  if (typeof document === "undefined" || !document.fonts) return;
  const wants = families.flatMap((f) => [`700 64px ${f}`, `500 34px ${f}`]);
  try {
    await Promise.race([
      Promise.all(wants.map((w) => document.fonts.load(w))),
      new Promise((r) => setTimeout(r, ms)),
    ]);
  } catch {
    /* draw with whatever is available rather than not at all */
  }
}

/* ── a profile photo, or nothing ────────────────────────────────────
   Returns an <img> only if it loaded AND is safe to draw. Anything
   else — no url, CORS refused, 404, a slow host — returns null and the
   caller draws an initial. Losing the whole card to save a face would
   be the wrong trade. */
function loadPhoto(url, ms = 3000) {
  return new Promise((resolve) => {
    if (!url || typeof Image === "undefined") return resolve(null);
    const img = new Image();
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    img.crossOrigin = "anonymous";
    img.onload = () => done(img);
    img.onerror = () => done(null);
    setTimeout(() => done(null), ms);
    img.src = url;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function initialOf(name) {
  const s = (name || "").trim();
  if (!s) return "•";
  return [...s][0].toUpperCase();
}

/* Text that fits, or text that is cut with an ellipsis — never text
   that runs off the side of an image somebody is about to send. */
function fitText(ctx, text, maxWidth) {
  let s = String(text ?? "");
  if (ctx.measureText(s).width <= maxWidth) return s;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

/* ── the board, small ───────────────────────────────────────────────
   Same cells the real board uses, at whatever size we are given. */
function drawBoard(ctx, x, y, size, { pieces, seatsInPlay }) {
  const cell = size / 15;
  const at = (c, r) => [x + c * cell, y + r * cell];

  ctx.save();
  roundRect(ctx, x, y, size, size, size * 0.045);
  ctx.fillStyle = "#FFFDF7";
  ctx.fill();
  ctx.clip();

  // yards
  YARD_ORIGIN.forEach(([c, r], seat) => {
    const [px, py] = at(c, r);
    ctx.fillStyle = SEAT_COLORS[seat];
    roundRect(ctx, px + cell * 0.1, py + cell * 0.1, cell * 5.8, cell * 5.8, cell * 0.5);
    ctx.fill();
    ctx.fillStyle = WHITE;
    roundRect(ctx, px + cell, py + cell, cell * 4, cell * 4, cell * 0.4);
    ctx.fill();
    YARD_SPOTS.forEach(([sc, sr]) => {
      const [sx, sy] = at(c + sc, r + sr);
      ctx.beginPath();
      ctx.arc(sx, sy, cell * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = SEAT_TINTS[seat];
      ctx.fill();
    });
  });

  // track
  TRACK.forEach(([c, r], abs) => {
    const [px, py] = at(c, r);
    const startSeat = START_ABS.indexOf(abs);
    ctx.fillStyle = startSeat >= 0 ? SEAT_TINTS[startSeat] : WHITE;
    roundRect(ctx, px + 1, py + 1, cell - 2, cell - 2, cell * 0.16);
    ctx.fill();
    ctx.strokeStyle = startSeat >= 0 ? SEAT_COLORS[startSeat] : "#E4DACB";
    ctx.lineWidth = startSeat >= 0 ? 2.5 : 1;
    ctx.stroke();
  });

  // home columns
  HOME_COLUMNS.forEach((cells, seat) =>
    cells.forEach(([c, r]) => {
      const [px, py] = at(c, r);
      ctx.fillStyle = SEAT_COLORS[seat];
      roundRect(ctx, px + 1, py + 1, cell - 2, cell - 2, cell * 0.16);
      ctx.fill();
    })
  );

  // centre
  const mid = [
    [[6, 6], [9, 6], [7.5, 7.5]],
    [[6, 6], [6, 9], [7.5, 7.5]],
    [[6, 9], [9, 9], [7.5, 7.5]],
    [[9, 6], [9, 9], [7.5, 7.5]],
  ];
  mid.forEach((pts, seat) => {
    ctx.beginPath();
    pts.forEach(([c, r], i) => {
      const [px, py] = at(c, r);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = SEAT_COLORS[seat];
    ctx.fill();
  });

  // gotis, where they finished
  (pieces || []).forEach((row, seat) => {
    if (seat >= seatsInPlay) return;
    row.forEach((p, i) => {
      const [cc, rr] = cellFor(seat, p, i);
      const px = x + cc * cell;
      const py = y + rr * cell;
      ctx.beginPath();
      ctx.arc(px, py + cell * 0.06, cell * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(45,36,24,0.22)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = SEAT_COLORS[seat];
      ctx.fill();
      ctx.lineWidth = cell * 0.08;
      ctx.strokeStyle = SEAT_DEEP[seat];
      ctx.stroke();
      // one small highlight is what the eye reads as a raised object
      ctx.beginPath();
      ctx.arc(px - cell * 0.11, py - cell * 0.12, cell * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fill();
    });
  });

  ctx.restore();
}

/* One face: photo if we have it, initial if we do not. */
function drawFace(ctx, cx, cy, r, { seat, name, photo, crowned, font = "serif" }) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.12, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(45,36,24,0.18)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = SEAT_COLORS[seat];
  ctx.fill();

  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - r * 0.08, 0, Math.PI * 2);
    ctx.clip();
    // cover-fit, so a portrait is not squashed into a circle
    const s = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
    const w = photo.width * s;
    const h = photo.height * s;
    ctx.drawImage(photo, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = SEAT_INK[seat];
    ctx.font = `700 ${Math.round(r * 0.9)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialOf(name), cx, cy + r * 0.04);
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = crowned ? r * 0.11 : r * 0.08;
  ctx.strokeStyle = WHITE;
  ctx.stroke();
  ctx.restore();
}

/* ── the card ───────────────────────────────────────────────────────
   `text` is passed in already translated, so this module never touches
   i18n and can be drawn from a test or a public page with no session.

   text: { title, winnerLine, playedWith, date, tagline, mark }
   players: [{ seat, name, photoUrl, isWinner }]
*/
export async function renderBoastCard({
  players = [],
  pieces = [],
  seatsInPlay = 4,
  text = {},
  fonts = { heading: "serif", body: "sans-serif" },
  size = CARD_SIZE,
} = {}) {
  await waitForFonts([fonts.heading, fonts.body]);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const u = size / 1080; // one design unit, so the card scales whole

  const heading = (px, weight = 700) => `${weight} ${Math.round(px * u)}px ${fonts.heading}`;
  const body = (px, weight = 500) => `${weight} ${Math.round(px * u)}px ${fonts.body}`;

  // ground
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, size, size);

  const winner = players.find((p) => p.isWinner) || players[0] || null;
  const others = players.filter((p) => p !== winner);

  /* Photos are fetched in parallel and every failure is already a null
     by the time we draw — no branch below has to know about the
     network. */
  const photos = new Map();
  await Promise.all(
    players.map(async (p) => {
      photos.set(p, await loadPhoto(p.photoUrl));
    })
  );

  // title
  ctx.fillStyle = GREEN;
  ctx.font = heading(76);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(fitText(ctx, text.title || "", size * 0.9), size / 2, 128 * u);

  // board
  const boardSize = 430 * u;
  drawBoard(ctx, (size - boardSize) / 2, 145 * u, boardSize, { pieces, seatsInPlay });

  // winner
  if (winner) {
    const cy = 685 * u;
    const r = 78 * u;
    drawFace(ctx, size / 2, cy, r, {
      seat: winner.seat,
      name: winner.name,
      photo: photos.get(winner),
      crowned: true,
      font: fonts.heading,
    });
    ctx.font = `${Math.round(78 * u)}px ${fonts.body}`;
    ctx.textAlign = "center";
    ctx.fillText("👑", size / 2, cy - r - 14 * u);

    ctx.fillStyle = INK;
    ctx.font = heading(46);
    ctx.fillText(fitText(ctx, winner.name || "", size * 0.8), size / 2, 828 * u);

    if (text.winnerLine) {
      ctx.fillStyle = GREEN;
      ctx.font = body(34, 600);
      ctx.fillText(fitText(ctx, text.winnerLine, size * 0.86), size / 2, 876 * u);
    }
  }

  // everyone else — same size as each other, in seat order, no places
  if (others.length) {
    const r = 34 * u;
    const gap = 128 * u;
    const y = 946 * u;
    const startX = size / 2 - ((others.length - 1) * gap) / 2;
    others.forEach((p, i) => {
      const cx = startX + i * gap;
      drawFace(ctx, cx, y, r, { seat: p.seat, name: p.name, photo: photos.get(p), font: fonts.heading });
      ctx.fillStyle = MUTED;
      ctx.font = body(22, 600);
      ctx.textAlign = "center";
      ctx.fillText(fitText(ctx, p.name || "", gap - 10 * u), cx, y + r + 30 * u);
    });
  }

  // date, left; mark, right
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = body(26);
  if (text.date) ctx.fillText(text.date, 48 * u, size - 36 * u);
  ctx.textAlign = "right";
  ctx.fillStyle = GREEN;
  ctx.font = heading(30);
  ctx.fillText(text.mark || "Saathban", size - 48 * u, size - 36 * u);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned nothing"))), "image/png");
    } catch (err) {
      // A tainted canvas lands here. It should not — every photo is
      // loaded crossOrigin and dropped on failure — but if it ever
      // does, the caller gets an error it can explain rather than a
      // silent nothing.
      reject(err);
    }
  });
}

/* A blob is what a share sheet and a download both want; an object URL
   is what an <img> preview wants. Callers revoke it when done. */
export function blobToUrl(blob) {
  return URL.createObjectURL(blob);
}
