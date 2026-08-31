/* ════════════════════════════════════════════════
   Sound & feel — the board's own settings.

   These live at the table rather than in app settings, because the
   moment a person wants to turn sound down is the moment it is too
   loud, and that moment happens mid-game. Two taps from the board,
   never a trip through a settings tree.

   EVERY STATE IS IN WORDS. A switch that is only "green means on"
   fails the person it most matters to. Each row says On or Off, in
   the current language, next to a mark — colour is the third signal,
   never the first.

   The honest note at the bottom about silent mode is deliberate. iOS
   gives a web page no way to read the hardware switch, so rather
   than claim we respect it, we say plainly that we may not, and put
   the control that definitely works directly above the sentence.
   ════════════════════════════════════════════════ */

import { GAME } from "./gameSurface.js";
import { useEffect, useRef, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  getSoundPrefs,
  setSoundPrefs,
  onSoundPrefs,
  playSound,
  playHopRun,
  unlockSound,
} from "../../lib/sound.js";
import { hapticsAvailable, hapticTap } from "../../lib/haptics.js";
import { Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";

/* One switchable line: label, hint, and the state as a word. */
function ToggleRow({ label, hint, on, onChange, disabled, disabledNote, ts }) {
  const { t } = useI18n();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 0",
        borderTop: `1px solid ${C.warmGray}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, margin: "0 0 2px", color: C.textMain }}>
          {label}
        </p>
        <p style={{ fontSize: ts(16), color: C.textMuted, margin: 0, lineHeight: 1.5 }}>
          {disabled && disabledNote ? disabledNote : hint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="sb-pressable"
        style={{
          flexShrink: 0,
          minHeight: A11Y.minTapTargetPx,
          minWidth: 96,
          padding: "0 16px",
          borderRadius: 50,
          border: `2px solid ${on && !disabled ? C.green : C.warmGray}`,
          background: on && !disabled ? C.green : C.white,
          color: on && !disabled ? C.cream : C.textMain,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>
          {on && !disabled ? "✓" : "○"}
        </span>
        {on && !disabled ? t("games.sound.onWord") : t("games.sound.offWord")}
      </button>
    </div>
  );
}

export function SoundPanel({ onClose }) {
  const { t, ts } = useI18n();
  const [prefs, setPrefs] = useState(() => getSoundPrefs());
  const canBuzz = hapticsAvailable();
  /* Silence has two causes and the panel must tell the truth about
     both: the switch, and a slider at zero. */
  const silent = prefs.muted || prefs.volume <= 0;
  const lastPreview = useRef(0);

  useEffect(() => onSoundPrefs(setPrefs), []);

  const update = (patch) => {
    unlockSound();
    setPrefs(setSoundPrefs(patch));
  };

  /* Dragging the slider plays a soft tick at the new level, so the
     number means something without anyone having to press Hear it.
     Throttled — a drag fires dozens of change events. */
  const onVolume = (e) => {
    const v = Number(e.target.value) / 100;
    update({ volume: v, muted: v === 0 ? prefs.muted : false });
    const now = Date.now();
    if (now - lastPreview.current > 110) {
      lastPreview.current = now;
      playSound("tap");
    }
  };

  return (
    <Card style={{ borderColor: C.olive, borderWidth: 2, borderStyle: "solid" }}>
      {/* The one control here that isn't a button. Left to the browser
          it renders as a bright blue system slider with a ~14px thumb —
          off-palette, and too small a target for the hands this app is
          for. The thumb is 30px, which clears the 48px rule once the
          track's padding is counted, and the track is olive on warm
          gray so it belongs to the same room as everything else. */}
      <style>{`
        #sb-volume {
          -webkit-appearance: none; appearance: none;
          height: 30px; background: transparent; cursor: pointer;
        }
        #sb-volume::-webkit-slider-runnable-track {
          height: 10px; border-radius: 5px;
          background: ${C.warmGray};
        }
        #sb-volume::-moz-range-track {
          height: 10px; border-radius: 5px; background: ${C.warmGray};
        }
        #sb-volume::-moz-range-progress {
          /* Brass: the filled part of a slider should read as
             filled, and inside a game the accent is not green. */
          height: 10px; border-radius: 5px; background: ${GAME.accentFlat};
        }
        #sb-volume::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 30px; height: 30px; margin-top: -10px;
          border-radius: 50%; background: ${GAME.accentFlat};
          border: 3px solid ${C.white};
          box-shadow: 0 1px 4px rgba(45,36,24,0.4);
        }
        #sb-volume::-moz-range-thumb {
          width: 24px; height: 24px; border-radius: 50%;
          background: ${GAME.accentFlat}; border: 3px solid ${C.white};
        }
        #sb-volume:focus-visible { outline: 3px solid ${GAME.accentFlat}; outline-offset: 4px; }
      `}</style>
      <h2 style={{ fontSize: ts(22), fontWeight: 800, color: C.brown, margin: "0 0 6px" }}>
        {t("games.sound.title")}
      </h2>
      <BodyText muted style={{ marginBottom: 4 }}>
        {t("games.sound.hint")}
      </BodyText>

      {/* A slider dragged to zero is silence just as surely as the
          switch is, so the switch must not sit there saying "On" over
          a game that cannot make a sound. `silent` — not `muted` — is
          what the words report, and turning the row back on restores
          an audible volume rather than leaving a switch that says On
          above a slider still at zero. */}
      <ToggleRow
        ts={ts}
        label={t("games.sound.effects")}
        hint={t("games.sound.effectsHint")}
        on={!silent}
        onChange={(on) =>
          update(
            on
              ? { muted: false, volume: prefs.volume > 0 ? prefs.volume : 0.7 }
              : { muted: true }
          )
        }
      />

      {/* Volume — hidden when muted rather than shown dead, so the
          panel never offers a control that cannot do anything. */}
      {!prefs.muted && (
        <div style={{ padding: "14px 0", borderTop: `1px solid ${C.warmGray}` }}>
          <label
            htmlFor="sb-volume"
            style={{
              display: "block",
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 700,
              color: C.textMain,
              marginBottom: 8,
            }}
          >
            {t("games.sound.volume")}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span aria-hidden="true" style={{ fontSize: ts(16), color: C.textMuted }}>
              {t("games.sound.quieter")}
            </span>
            <input
              id="sb-volume"
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(prefs.volume * 100)}
              onChange={onVolume}
              aria-valuetext={`${Math.round(prefs.volume * 100)}%`}
              style={{ flex: 1, minWidth: 0, padding: 0, border: "none", background: "transparent" }}
            />
            <span aria-hidden="true" style={{ fontSize: ts(16), color: C.textMuted }}>
              {t("games.sound.louder")}
            </span>
          </div>
          <GhostBtn
            onClick={() => {
              unlockSound();
              playSound("dice");
              window.setTimeout(() => playHopRun(3, 190), 520);
            }}
            style={{ marginTop: 12 }}
          >
            ♪ {t("games.sound.test")}
          </GhostBtn>
        </div>
      )}

      {/* The background-music toggle is gone with the feature it
          controlled (GAMES_IMMERSION_SPEC §7 cancels GAMES_BACKLOG
          A5). A switch for something that no longer exists is worse
          than either having the feature or not: it promises a thing
          and then does nothing. */}

      <ToggleRow
        ts={ts}
        label={t("games.sound.haptics")}
        hint={t("games.sound.hapticsHint")}
        on={prefs.haptics && canBuzz}
        disabled={!canBuzz}
        disabledNote={t("games.sound.hapticsNone")}
        onChange={(on) => {
          update({ haptics: on });
          if (on) hapticTap();
        }}
      />

      <p
        style={{
          fontSize: ts(16),
          color: C.textMuted,
          lineHeight: 1.5,
          margin: "14px 0 0",
          paddingTop: 14,
          borderTop: `1px solid ${C.warmGray}`,
        }}
      >
        {silent ? t("games.sound.mutedNote") : t("games.sound.silentNote")}
      </p>

      {onClose && (
        <PrimaryBtn onClick={onClose} style={{ marginTop: 16, width: "100%" }}>
          {t("games.sound.done")}
        </PrimaryBtn>
      )}
    </Card>
  );
}

/* The opener — a quiet control that shows, in its icon and its label,
   whether sound is currently on. Drop it in any game header. */
export function SoundButton({ onClick, compact = false }) {
  const { t, ts } = useI18n();
  const [prefs, setPrefs] = useState(() => getSoundPrefs());
  useEffect(() => onSoundPrefs(setPrefs), []);
  return (
    <button
      type="button"
      onClick={() => {
        unlockSound();
        onClick?.();
      }}
      className="sb-pressable"
      aria-label={t("games.sound.openCta")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: A11Y.minTapTargetPx,
        padding: compact ? 0 : "0 14px",
        minWidth: compact ? A11Y.minTapTargetPx : undefined,
        justifyContent: "center",
        borderRadius: 50,
        /* Inside a game this is a plum pill like every other piece
           of chrome; outside one it stays the app's white button.
           `compact` is only ever true on the play screen, which is
           exactly the distinction being drawn, so it carries the
           switch rather than a second prop every caller would have
           to remember to pass. */
        border: `1px solid ${compact ? GAME.pillEdge : C.warmGray}`,
        background: compact ? GAME.pill : C.white,
        color: compact ? GAME.ink : C.textMain,
        fontSize: ts(16),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <span aria-hidden="true">{prefs.muted ? "🔇" : "🔊"}</span>
      {/* Compact: the icon alone, still a full tap target and still
          named for a screen reader by aria-label above (§10). */}
      {!compact && t("games.sound.openCta")}
    </button>
  );
}

export default SoundPanel;
