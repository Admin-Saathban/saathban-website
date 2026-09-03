/* ════════════════════════════════════════════════
   The settings menu, opened from the hamburger at the top of the
   board.

   Four sections, in the order somebody reaches for them:

     1. Sound      — the mute, and two levels that do not fight
     2. Playing    — move hints, off unless somebody asks for them
     3. This table — the house rules, read-only once play has begun
     4. Rulebook   — the book, searchable

   NO LEAVE ROW. The door is in the top bar and it was ALSO the
   bottom of this sheet, so a person had two ways to leave a table
   and one way to close a menu. The door is the door.

   AND THIS SHEET IS LUDO'S, not a shared one. `rules` is a ludo
   house-rules object and the middle section renders ludo's own
   list from it, so another game reusing this file gets a menu
   about somebody else's rules.

   Worth saying because it already cost somebody time: when the
   Leave row went, `onLeave` went with it, and React does not
   complain about a prop nobody reads — the snakes lane passed a
   door here and got silence. There is no way to make an unknown
   prop throw, so the defence is this paragraph and the signature
   below being the only list of what this component accepts.

   IT OPENS SHORT, AND EVERY SECTION IS SHUT. It used to open with
   Sound already expanded against an 88dvh ceiling, which on a
   phone is the whole screen: no board to tap beside it, no cross,
   and a back gesture that left the table. Four collapsed rows and
   a 62dvh ceiling leave a clear band of board above the sheet,
   which is the thing a person actually aims at when they want a
   sheet gone.

   ONE MUTE, TWO LEVELS. Music and game sounds used to share a single
   volume with a boolean beside it, so the only way to have the dice
   without the march was to have neither, quieter. Two sliders now,
   and the mute above them still silences both — a switch that means
   "off" has to mean off.

   THE HOUSE RULES ARE SHOWN, NOT HIDDEN, once they are frozen. A
   settings screen that omits the rules of the game being played
   would send a person to the rulebook to find out what their own
   table decided. They are read-only after the first roll because the
   server refuses to change them then (0092), and a control that is
   going to be refused should not be drawn.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { GAME, NO_SELECT } from "../gameSurface.js";
import { GamePill, GameMotion, SheetHandle, SheetClose, useBackToClose } from "../GameUI.jsx";
import { getSoundPrefs, setSoundPrefs, onSoundPrefs } from "../../../lib/sound.js";
import Rulebook from "./Rulebook.jsx";
import { fullscreenReport } from "../fullscreen.js";

/* The five the host chooses, in the order the setup room offers
   them. `invert` marks the one whose default is OFF. */
/* Injected at build time by vite.config.js. */
const BUILD =
  typeof __SB_BUILD_HASH__ === "string" ? `build ${__SB_BUILD_HASH__}` : "build unknown";

const HOUSE = [
  { key: "extra_roll_on_six", label: "ludo.rules.extraRoll" },
  { key: "jota", label: "ludo.rules.jota" },
  { key: "exact_home", label: "ludo.rules.exactHome" },
  { key: "three_sixes", label: "ludo.rules.threeSixes" },
  { key: "capture_before_home", label: "ludo.rules.captureFirst", invert: true },
];

function Section({ id, open, onToggle, title, children, ts }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => onToggle(open === id ? null : id)}
        aria-expanded={open === id}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          minHeight: A11Y.minTapTargetPx + 4,
          padding: "10px 14px",
          borderRadius: 14,
          border: `1px solid ${GAME.glassEdge}`,
          background: GAME.glass,
          color: GAME.ink,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
          textAlign: "start",
          boxSizing: "border-box",
        }}
      >
        {title}
        <span aria-hidden="true" style={{ color: GAME.inkMuted }}>
          {open === id ? "−" : "+"}
        </span>
      </button>
      {open === id && <div style={{ padding: "14px 4px 4px" }}>{children}</div>}
    </div>
  );
}

/* A level, 0 to 100, drawn as a slider that shows its own fill —
   a native range on a dark ground is a grey line on a grey line. */
function Level({ label, value, onChange, ts }) {
  const pct = Math.round(value * 100);
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 600,
          color: GAME.ink,
          marginBottom: 6,
        }}
      >
        {label}
        <span style={{ color: GAME.inkMuted, fontVariantNumeric: "tabular-nums" }}>{pct}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{
          width: "100%",
          height: 34,
          accentColor: GAME.you,
          background: "transparent",
        }}
      />
    </label>
  );
}

export default function GameSettings({ rules, editable, onClose, hints, onHints, side = "end" }) {
  const { t, ts, meta } = useI18n();
  /* EVERYTHING SHUT. See the note at the top: an expanded section
     is what made this sheet as tall as the screen. */
  const [open, setOpen] = useState(null);
  const [prefs, setPrefs] = useState(() => getSoundPrefs());

  useEffect(() => onSoundPrefs(setPrefs), []);
  /* ── BACK STEPS EXACTLY ONE LEVEL ──────────────────────────────

     The owner's rule for the whole game world, and a menu with an
     expanded section is TWO levels deep: the panel, and the thing
     open inside it. Back closed the panel outright from there,
     which skips a level — he was two steps in and came out three.

     So the section registers its own entry while it is open, and
     the panel's is registered only when nothing is expanded.
     Registering both at once would make one press close both, and
     the hook runs the innermost first, so the two are deliberately
     exclusive rather than nested. */
  useBackToClose(open != null, () => setOpen(null));
  useBackToClose(open == null, onClose);
  const put = (patch) => setPrefs(setSoundPrefs(patch));

  return (
    <>
      <GameMotion />
      <div
        className="sb-veil-in"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 76, background: "rgba(0,0,0,0.5)" }}
        aria-hidden="true"
      />
      <section
        className="sb-panel-in"
        role="dialog"
        aria-modal="true"
        aria-label={t("ludo.settings.title")}
        style={{
          ...NO_SELECT,
          /* ── A MENU FALLING FROM THE HAMBURGER ─────────────────

               It came down from the top, which was right, and then
               spanned the screen edge to edge, which made it a
               curtain across the app rather than a menu belonging
               to the button that opened it.

               The app already has the answer and I should have
               copied it rather than invented one: components/
               Drawer.jsx, the More menu. Its manners are a fixed
               panel inset from the trailing edge, a bounded width
               rather than a percentage of the screen, a scrim
               behind it, and a shadow deep enough to lift it off
               what it covers. Same here — 12px from the right, 320
               wide but never more than 86vw on a narrow phone,
               square at the top because it is attached to that
               edge and rounded below where it hangs into the
               screen.

               The board stays visible to the left of it, which is
               also the thing that closes it: the scrim takes the
               tap. ── */
          position: "fixed",
          top: 0,
          /* THE SIDE THE HAMBURGER IS ON, measured from the button
             itself rather than assumed from the writing direction —
             see the note on openSettings. A menu that drops down the
             far side of the screen from its own button is not that
             button's menu. */
          ...(side === "left"
            ? { left: 12 }
            : side === "right"
            ? { right: 12 }
            : { insetInlineEnd: 12 }),
          width: 320,
          maxWidth: "86vw",
          zIndex: 77,
          /* A CLEAR BAND OF BOARD ABOVE IT. 62 rather than 88: the
             gap is not decoration, it is the target you tap to
             dismiss the thing, and at 88dvh there was not one. */
          /* ── A REACHABLE SCRIM IS PART OF THE PANEL ────────────
               With Sound expanded this grew until there was nothing
               left to tap beside it, which is the same trap the
               sheet fell into two rounds ago and the same fix:
               the panel is capped and scrolls inside itself, so the
               band of board below and beside it is always there to
               be pressed. ── */
          maxHeight: "68dvh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          background: GAME.panel,
          border: "none",
          borderRadius: "0 0 18px 18px",
          /* Deeper than a sheet's: this one floats over a board
             rather than sitting on the bottom edge of the screen,
             so it needs an edge of its own on three sides. */
          boxShadow: "0 18px 46px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.07) inset",
          /* The safe inset is at the TOP now: a phone with a notch
             would otherwise put the ✕ under it. */
          padding: "calc(14px + env(safe-area-inset-top)) 16px 20px",
        }}
      >
        <SheetClose onClose={onClose} label={t("ludo.chat.close")} />

        <h2
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(22),
            fontWeight: 700,
            color: GAME.ink,
            margin: "0 0 14px",
            paddingInlineEnd: 52,
          }}
        >
          {t("ludo.settings.title")}
        </h2>

        <Section id="sound" open={open} onToggle={setOpen} ts={ts} title={t("ludo.settings.sound")}>
          <GamePill
            onClick={() => put({ muted: !prefs.muted })}
            style={{ width: "100%", minHeight: 52, justifyContent: "center", marginBottom: 16 }}
          >
            {t(prefs.muted ? "ludo.settings.unmute" : "ludo.settings.mute")}
          </GamePill>
          <Level
            label={t("ludo.settings.music")}
            value={prefs.music}
            onChange={(v) => put({ music: v })}
            ts={ts}
          />
          <Level
            label={t("ludo.settings.effects")}
            value={prefs.effects}
            onChange={(v) => put({ effects: v })}
            ts={ts}
          />
        </Section>

        {/* MOVE HINTS, AND THEY ARE OFF.

            "Tap the goti you'd like to move", "The 2 had nowhere to
            go, so it goes unused", "Tap a die, then tap the goti it
            should move" — a game explaining itself, every turn, to
            somebody who has played ludo their whole life. The
            owner's ruling is that it stops; this is where the
            people who do want it turn it back on.

            Whose turn it is and what actually happened — a capture,
            a goti home, a win — are not hints and are not behind
            this switch. */}
        <Section id="play" open={open} onToggle={setOpen} ts={ts} title={t("ludo.settings.playing")}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              minHeight: A11Y.minTapTargetPx,
            }}
          >
            <span style={{ fontSize: ts(A11Y.minBodyPx), color: GAME.ink, flex: "1 1 auto" }}>
              {t("ludo.settings.hints")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!!hints}
              aria-label={t("ludo.settings.hints")}
              onClick={() => onHints?.(!hints)}
              style={{
                flex: "0 0 auto",
                width: 62,
                height: 34,
                borderRadius: 17,
                border: "none",
                padding: 3,
                cursor: "pointer",
                background: hints ? GAME.you : GAME.off,
                transition: "background 160ms ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "block",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  transform: hints ? "translateX(28px)" : "translateX(0)",
                  transition: "transform 160ms cubic-bezier(.2,.9,.3,1)",
                }}
              />
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: ts(15), lineHeight: 1.45, color: GAME.inkMuted }}>
            {t("ludo.settings.hintsNote")}
          </p>
        </Section>

        <Section id="table" open={open} onToggle={setOpen} ts={ts} title={t("ludo.settings.table")}>
          {/* Read-only once the first roll has happened, which is when
              the server freezes them. Before that the host changes
              them where they were chosen — the seat sheet — rather
              than in a second place that could disagree with it. */}
          {!editable && (
            <p style={{ margin: "0 0 12px", fontSize: ts(15), color: GAME.inkMuted }}>
              {t("ludo.settings.frozen")}
            </p>
          )}
          {HOUSE.map((r) => {
            const on = r.invert ? rules?.[r.key] === true : rules?.[r.key] !== false;
            return (
              <div
                key={r.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  minHeight: A11Y.minTapTargetPx,
                  padding: "8px 14px",
                  marginBottom: 8,
                  borderRadius: 12,
                  border: `1px solid ${GAME.glassEdge}`,
                  background: GAME.glass,
                  color: GAME.ink,
                  fontSize: ts(A11Y.minBodyPx),
                }}
              >
                <span>{t(r.label)}</span>
                <span style={{ fontWeight: 800, color: on ? GAME.you : GAME.inkMuted }}>
                  {t(on ? "ludo.settings.on" : "ludo.settings.off")}
                </span>
              </div>
            );
          })}
        </Section>

        <Section id="book" open={open} onToggle={setOpen} ts={ts} title={t("ludo.settings.rulebook")}>
          <Rulebook rules={rules} />
        </Section>

        {/* THE GRAB HANDLE MOVED TO THE BOTTOM with the sheet. It
            is the edge you pull, and on a shade that edge is the
            one hanging into the screen — so the swipe that closes
            it is UP, which is what SheetHandle's `up` does. */}
        <SheetHandle onClose={onClose} label={t("ludo.chat.close")} up />

        {/* ── WHICH BUILD THIS TABLE IS RUNNING ──────────────────

             The argument this ends: a lane reports something fixed,
             the owner's phone still shows it broken, and neither
             side can tell whether they are looking at the same
             code. Twice this week the answer was that the work had
             simply not shipped yet, and it took a bundle download
             and a keyframe comparison to establish it. Now every
             report carries a hash and the table shows one.

             The define is lane 2's (vite.config.js), which reads
             VERCEL_GIT_COMMIT_SHA on a deploy and asks git
             locally. Guarded with typeof anyway: a settings sheet
             that throws because a build constant is missing would
             be a worse bug than the one it exists to prevent.

             Small, grey, and last. It is for one person on one
             evening, not a label anybody else needs to read. ── */}
        <p
          style={{
            margin: "14px 0 0",
            textAlign: "center",
            fontSize: ts(13),
            letterSpacing: "0.06em",
            color: GAME.inkMuted,
            opacity: 0.72,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {BUILD}
          {" \u00b7 "}
          {/* Screen: what the window IS, and what the request for
              it got. Two words that turn "fullscreen does not
              work" into something anybody can act on. */}
          {`screen ${fullscreenReport.mode}/${fullscreenReport.result}`}
        </p>
      </section>
    </>
  );
}
