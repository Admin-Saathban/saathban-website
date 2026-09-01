/* ════════════════════════════════════════════════
   The settings menu, opened from the hamburger at the top of the
   board.

   Four sections, in the order somebody reaches for them:

     1. Sound      — the mute, and two levels that do not fight
     2. This table — the house rules, read-only once play has begun
     3. Rulebook   — the book, searchable
     4. Leave      — the same door and the same confirm

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
import { GameBtn, GamePill, GameMotion } from "../GameUI.jsx";
import { getSoundPrefs, setSoundPrefs, onSoundPrefs } from "../../../lib/sound.js";
import Rulebook from "./Rulebook.jsx";

/* The five the host chooses, in the order the setup room offers
   them. `invert` marks the one whose default is OFF. */
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

export default function GameSettings({ rules, editable, onClose, onLeave }) {
  const { t, ts, meta } = useI18n();
  const [open, setOpen] = useState("sound");
  const [prefs, setPrefs] = useState(() => getSoundPrefs());

  useEffect(() => onSoundPrefs(setPrefs), []);
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
          position: "fixed",
          insetInline: 0,
          bottom: 0,
          zIndex: 77,
          maxHeight: "88dvh",
          overflowY: "auto",
          background: GAME.panel,
          border: "none",
          borderRadius: "18px 18px 0 0",
          boxShadow: GAME.panelShadow,
          padding: "14px 16px calc(20px + env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("ludo.chat.close")}
          style={{
            display: "block",
            margin: "0 auto 12px",
            width: 64,
            height: 20,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              display: "block",
              width: 44,
              height: 4,
              margin: "0 auto",
              borderRadius: 2,
              background: "rgba(255,255,255,0.28)",
            }}
          />
        </button>

        <h2
          style={{
            fontFamily: meta.fonts.heading,
            fontSize: ts(22),
            fontWeight: 700,
            color: GAME.ink,
            margin: "0 0 14px",
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

        <div style={{ marginTop: 6 }}>
          <GameBtn onClick={onLeave} style={{ width: "100%", minHeight: 52 }}>
            {t("ludo.ceremony.leaveCta")}
          </GameBtn>
        </div>
      </section>
    </>
  );
}
