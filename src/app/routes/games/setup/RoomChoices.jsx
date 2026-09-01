/* ════════════════════════════════════════════════
   Two choices in the setup room that are not switches.

   A switch answers yes or no. These answer "which one", and drawing
   them as switches would have meant four toggles for the move timer
   with nothing stopping somebody turning on two.

   Same glass and the same green as everything else in the room: a
   chosen chip carries a 2px #1FA83C outline and nothing else changes,
   so a row of five reads as one question with one answer rather than
   five things in five states.
   ════════════════════════════════════════════════ */

import { A11Y } from "../../../../shared/tokens.js";
import { GAME } from "../gameSurface.js";

const GREEN = "#1FA83C";
const GLASS = "rgba(255,255,255,0.07)";
const CHIP = "rgba(255,255,255,0.10)";
const EDGE = "rgba(255,255,255,0.18)";

function Chip({ on, onClick, children, ts }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        minHeight: A11Y.minTapTargetPx,
        padding: "0 6px",
        borderRadius: 12,
        border: on ? `2px solid ${GREEN}` : `1px solid ${EDGE}`,
        background: CHIP,
        color: GAME.ink,
        fontFamily: "inherit",
        fontSize: ts(15),
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Row({ label, hint, children, ts }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        marginBottom: 10,
        borderRadius: 14,
        border: `1px solid ${EDGE}`,
        background: GLASS,
        boxSizing: "border-box",
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          color: GAME.ink,
        }}
      >
        {label}
      </p>
      <div role="radiogroup" style={{ display: "flex", gap: 6 }}>
        {children}
      </div>
      {hint && (
        <p style={{ margin: "8px 0 0", fontSize: ts(14), color: GAME.inkMuted, lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/* 20 / 30 / 45 / 60 / relaxed. Thirty is the default because it is
   long enough to think and short enough that three people are not
   waiting on a fourth who has put the phone down. */
export function TimerChoice({ value, onPick, t, ts }) {
  return (
    <Row label={t("games.setup.timer")} hint={t("games.setup.timerHint")} ts={ts}>
      {[20, 30, 45, 60].map((n) => (
        <Chip key={n} on={value === n} onClick={() => onPick(n)} ts={ts}>
          {t("games.setup.timerSecs", { n })}
        </Chip>
      ))}
      <Chip on={value === null} onClick={() => onPick(null)} ts={ts}>
        {t("games.setup.timerRelaxed")}
      </Chip>
    </Row>
  );
}

/* Just this table, or every table this person opens from now on.
   Offered HERE rather than after Start, and the deviation is
   deliberate: the whole of this round's first section is about
   getting into the game without waiting, and a sheet between Start
   and the board is the one interruption that would undo it. The
   choice is the same and it is made while the rules are still on
   screen beside it. */
export function RememberChoice({ value, onPick, t, ts }) {
  return (
    <Row label={t("games.setup.remember")} ts={ts}>
      <Chip on={!value} onClick={() => onPick(false)} ts={ts}>
        {t("games.setup.rememberOnce")}
      </Chip>
      <Chip on={value} onClick={() => onPick(true)} ts={ts}>
        {t("games.setup.rememberAlways")}
      </Chip>
    </Row>
  );
}
