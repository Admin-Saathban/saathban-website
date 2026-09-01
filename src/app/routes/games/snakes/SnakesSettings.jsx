/* ════════════════════════════════════════════════
   The settings sheet for a snakes table.

   THE SAME SHAPE AS LUDO'S, AND NOT THE SAME COMPONENT. I tried to
   reuse ludo's — that is what "everything else follows ludo" should
   mean — and it was the wrong call twice over:

     * GameSettings takes `rules` as a ludo HOUSE-RULES OBJECT and
       renders ludo's list from it (extra roll on six, jota, exact
       home, three sixes). On a snakes table that is four rules from a
       different game, presented as this table's.
     * Its signature has moved since — it no longer takes onLeave —
       so the Leave door the owner asked for was being passed to a
       prop that no longer exists. Silently: React does not mind an
       extra prop, so the sheet simply had no way out of the table in
       it.

   Sharing a component with another game is right when the CONTENT is
   the same (the chat panel, the profile cards). It is wrong when only
   the LAYOUT is the same, because then the component has to grow a
   branch per game and both games get worse. Same four sections, same
   order, same behaviour; this game's words.

   LEAVING ASKS FIRST. A bot takes the seat and the table stays yours,
   which is exactly why the question is worth asking — a person who
   taps Leave meaning "hide this for now" should not discover later
   that a computer played their game for them without being told.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useI18n } from "../../../lib/i18n.jsx";
import { getSoundPrefs, setSoundPrefs, onSoundPrefs } from "../../../lib/sound.js";
import Icon from "../../../components/Icon.jsx";

const PANEL = "#14110C";
const LINE = "rgba(255,255,255,.10)";

function Section({ id, open, onToggle, title, children }) {
  const { ts } = useI18n();
  const isOpen = open === id;
  return (
    <div style={{ borderBottom: `1px solid ${LINE}` }}>
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        aria-expanded={isOpen}
        style={{
          width: "100%", minHeight: 56, padding: "0 4px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "none", border: "none", color: "#F2ECDF",
          fontSize: ts(18), fontWeight: 700, cursor: "pointer", textAlign: "start",
        }}
      >
        {title}
        <span aria-hidden="true" style={{
          transform: isOpen ? "rotate(90deg)" : "none",
          transition: "transform 160ms ease", display: "inline-flex",
        }}>
          <Icon name="forward" size={20} />
        </span>
      </button>
      {isOpen && <div style={{ padding: "0 4px 16px" }}>{children}</div>}
    </div>
  );
}

function Slider({ label, value, onChange }) {
  const { ts } = useI18n();
  return (
    <label style={{ display: "block", margin: "12px 0" }}>
      <span style={{ display: "block", fontSize: ts(16), color: "#D8CDBC", marginBottom: 4 }}>{label}</span>
      <input
        type="range" min="0" max="100" step="5"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ width: "100%", height: 34, accentColor: "#9A4A8E", background: "transparent" }}
      />
    </label>
  );
}

export default function SnakesSettings({ board, onClose, onLeave }) {
  const { t, ts } = useI18n();
  const [open, setOpen] = useState(null);
  const [prefs, setPrefs] = useState(() => getSoundPrefs());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => onSoundPrefs(setPrefs), []);
  const put = (patch) => setPrefs(setSoundPrefs(patch));

  /* Escape closes, like every other sheet in the app. */
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: 76, background: "rgba(0,0,0,.55)" }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("ludo.settings.title")}
        style={{
          position: "fixed", insetInline: 0, bottom: 0, zIndex: 77,
          maxHeight: "82dvh", overflowY: "auto",
          background: PANEL,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: "10px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
          color: "#F2ECDF",
          boxShadow: "0 -12px 40px rgba(0,0,0,.5)",
        }}
      >
        <div style={{
          width: 42, height: 4, borderRadius: 2, background: "rgba(255,255,255,.22)",
          margin: "4px auto 10px",
        }} aria-hidden="true" />

        <Section id="sound" open={open} onToggle={setOpen} title={t("snakes.settings.sound")}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, fontSize: ts(17) }}>
            <input
              type="checkbox"
              checked={!prefs.muted}
              onChange={(e) => put({ muted: !e.target.checked })}
              style={{ width: 22, height: 22, accentColor: "#9A4A8E" }}
            />
            {t("snakes.settings.soundOn")}
          </label>
          <Slider label={t("snakes.settings.effects")} value={prefs.effects} onChange={(v) => put({ effects: v })} />
          <Slider label={t("snakes.settings.music")} value={prefs.music} onChange={(v) => put({ music: v })} />
        </Section>

        <Section id="table" open={open} onToggle={setOpen} title={t("snakes.settings.table")}>
          <p style={{ fontSize: ts(17), margin: "10px 0 0", color: "#D8CDBC" }}>
            {t("snakes.rules.count", { snakes: board.snakes.length, ladders: board.ladders.length })}
          </p>
          <p style={{ fontSize: ts(15), margin: "6px 0 0", color: "#A99C8C" }}>
            {t("snakes.settings.tableFixed")}
          </p>
        </Section>

        <Section id="book" open={open} onToggle={setOpen} title={t("snakes.settings.rulebook")}>
          <ul style={{ margin: "10px 0 0", paddingInlineStart: 20, lineHeight: 1.65, fontSize: ts(16), color: "#D8CDBC" }}>
            <li>{t("snakes.rules.dragon")}</li>
            <li>{t("snakes.rules.exact")}</li>
            <li>{t("snakes.rules.walk")}</li>
            <li>{t("snakes.rules.noChain")}</li>
          </ul>
        </Section>

        {/* THE WAY OUT, and it asks first. */}
        <div style={{ paddingTop: 14 }}>
          {confirming ? (
            <>
              <p style={{ fontSize: ts(16), color: "#D8CDBC", margin: "0 0 10px" }}>
                {t("snakes.settings.leaveAsk")}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={onLeave}
                  style={{
                    flex: 1, minHeight: 50, borderRadius: 14, border: "none",
                    background: "#8E2A2A", color: "#fff", fontSize: ts(17), fontWeight: 800, cursor: "pointer",
                  }}
                >
                  {t("snakes.settings.leaveYes")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  style={{
                    flex: 1, minHeight: 50, borderRadius: 14,
                    background: "transparent", border: "1px solid rgba(255,255,255,.28)",
                    color: "#F2ECDF", fontSize: ts(17), fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {t("snakes.settings.leaveNo")}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              style={{
                width: "100%", minHeight: 52, borderRadius: 14,
                background: "transparent", border: "1px solid rgba(255,255,255,.24)",
                color: "#F0A5A5", fontSize: ts(17), fontWeight: 700, cursor: "pointer",
              }}
            >
              {t("snakes.settings.leave")}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
