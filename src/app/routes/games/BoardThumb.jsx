/* A small drawing of each board, for the ACTIVE GAME card on the games
   home. Deliberately NOT the real board component: at 64px a real one
   is illegible noise (a hundred numbered snakes cells, a canvas that
   wants a render loop). This is a recognisable emblem instead — the
   ludo cross, the snakes grid with one snake and one ladder, the
   carrom circle — drawn in the same seat palette so it reads as the
   same family. */

import { COLORS as C } from "../../../shared/tokens.js";
import { SEAT_COLORS } from "./seatColors.js";

export default function BoardThumb({ gameKey, size = 64 }) {
  const box = { width: size, height: size, flex: "0 0 auto", borderRadius: 10 };

  if (gameKey === "ludo") {
    return (
      <svg viewBox="0 0 15 15" style={{ ...box, background: C.cream }} aria-hidden="true">
        <rect x="0" y="0" width="6" height="6" fill={SEAT_COLORS[0]} rx="1" />
        <rect x="0" y="9" width="6" height="6" fill={SEAT_COLORS[1]} rx="1" />
        <rect x="9" y="9" width="6" height="6" fill={SEAT_COLORS[2]} rx="1" />
        <rect x="9" y="0" width="6" height="6" fill={SEAT_COLORS[3]} rx="1" />
        <rect x="6" y="0" width="3" height="15" fill={C.white} />
        <rect x="0" y="6" width="15" height="3" fill={C.white} />
        <polygon points="6,6 9,6 7.5,7.5" fill={SEAT_COLORS[0]} />
        <polygon points="6,6 6,9 7.5,7.5" fill={SEAT_COLORS[1]} />
        <polygon points="6,9 9,9 7.5,7.5" fill={SEAT_COLORS[2]} />
        <polygon points="9,6 9,9 7.5,7.5" fill={SEAT_COLORS[3]} />
      </svg>
    );
  }

  if (gameKey === "carrom") {
    return (
      <svg viewBox="0 0 20 20" style={{ ...box, background: "#e8c99b" }} aria-hidden="true">
        <rect x="0.6" y="0.6" width="18.8" height="18.8" rx="1.5" fill="none" stroke="#8a5a2b" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="4" fill="none" stroke="#b08246" strokeWidth="0.7" />
        <circle cx="10" cy="10" r="1.5" fill="#B23A2E" />
        {[[2.4, 2.4], [17.6, 2.4], [2.4, 17.6], [17.6, 17.6]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#3b2a17" />
        ))}
      </svg>
    );
  }

  // snakes (and anything new): a warm grid with one snake, one ladder
  return (
    <svg viewBox="0 0 20 20" style={{ ...box, background: C.cream }} aria-hidden="true">
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 4 }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * 5}
            y={r * 5}
            width="5"
            height="5"
            fill={(r + c) % 2 ? "#f3e9db" : C.white}
            stroke={C.warmGray}
            strokeWidth="0.2"
          />
        ))
      )}
      <path d="M 4 16 Q 8 12 5 8 T 8 3" fill="none" stroke="#5c7a4a" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="3" r="1.1" fill="#4d6b3e" />
      <g stroke="#a97f4e" strokeWidth="0.7" strokeLinecap="round">
        <line x1="13" y1="17" x2="16.5" y2="5" />
        <line x1="15" y1="17.4" x2="18.5" y2="5.4" />
        {[0.2, 0.45, 0.7].map((f) => (
          <line key={f} x1={13 + 3.5 * f + (2 - 2 * f) * 0} y1={17 - 12 * f} x2={15 + 3.5 * f} y2={17.4 - 12 * f} />
        ))}
      </g>
    </svg>
  );
}
