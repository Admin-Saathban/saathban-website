/* ════════════════════════════════════════════════
   Ludo's front door: start a game (seats + the four house rules,
   chosen here and frozen at start) or join one with the 6-digit code
   a host reads aloud — the same one-code pattern the circle uses.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../../shared/tokens.js";
import { useI18n } from "../../../lib/i18n.jsx";
import { Card, SectionLabel, BodyText, PrimaryBtn, GhostBtn, Toggle, Segmented } from "../../circle/ui.jsx";
import { createSession, joinByCode, DEFAULT_RULES } from "./ludoRails.js";

export default function LudoHome() {
  const navigate = useNavigate();
  const { t, ts, meta } = useI18n();

  const [seats, setSeats] = useState(4);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const id = await createSession(seats, rules);
      navigate(`/app/games/ludo/${id}`);
    } catch (err) {
      setError(err.message || "ludo.errors.generic");
      setBusy(false);
    }
  };

  const join = async (e) => {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const id = await joinByCode(code);
      navigate(`/app/games/ludo/${id}`);
    } catch (err) {
      setError(err.message || "ludo.errors.generic");
      setBusy(false);
    }
  };

  return (
    <>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(32),
          fontWeight: 700,
          color: C.green,
          margin: "8px 0 8px",
        }}
      >
        🎲 {t("ludo.title")}
      </h1>
      <BodyText muted>{t("ludo.home.intro")}</BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      <SectionLabel>{t("ludo.home.newLabel")}</SectionLabel>
      <Card>
        <BodyText style={{ fontWeight: 700, marginBottom: 8 }}>{t("ludo.home.seatsLabel")}</BodyText>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={seats === n}
              onClick={() => setSeats(n)}
              style={{
                flex: 1,
                minHeight: A11Y.minTapTargetPx,
                borderRadius: 14,
                border: `${seats === n ? 3 : 1.5}px solid ${seats === n ? C.green : C.warmGray}`,
                background: seats === n ? C.white : "transparent",
                fontSize: ts(20),
                fontWeight: 700,
                fontFamily: "inherit",
                color: C.textMain,
                cursor: "pointer",
              }}
            >
              {seats === n ? "✓ " : ""}
              {n}
            </button>
          ))}
        </div>
        <BodyText muted style={{ fontSize: ts(18), marginBottom: 4 }}>
          {t("ludo.home.botNote")}
        </BodyText>

        <BodyText style={{ fontWeight: 700, margin: "14px 0 0" }}>🧾 {t("ludo.rules.title")}</BodyText>
        <Toggle
          checked={rules.extra_roll_on_six}
          onChange={() => setRules({ ...rules, extra_roll_on_six: !rules.extra_roll_on_six })}
          label={t("ludo.rules.extraRoll")}
          hint={t("ludo.rules.extraRollHint")}
        />
        <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
        <Toggle
          checked={rules.capture_before_home}
          onChange={() => setRules({ ...rules, capture_before_home: !rules.capture_before_home })}
          label={t("ludo.rules.captureFirst")}
          hint={t("ludo.rules.captureFirstHint")}
        />
        <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
        <Toggle
          checked={rules.exact_home}
          onChange={() => setRules({ ...rules, exact_home: !rules.exact_home })}
          label={t("ludo.rules.exactHome")}
          hint={t("ludo.rules.exactHomeHint")}
        />
        <div style={{ borderTop: `1px solid ${C.warmGray}` }} />
        <Segmented
          label={t("ludo.rules.safeSquares")}
          hint={t("ludo.rules.safeSquaresHint")}
          value={rules.safe_squares}
          onChange={(v) => setRules({ ...rules, safe_squares: v })}
          options={[
            { value: "standard", label: t("ludo.rules.safeStandard") },
            { value: "none", label: t("ludo.rules.safeNone") },
          ]}
        />

        <PrimaryBtn onClick={create} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
          {t("ludo.home.createCta")}
        </PrimaryBtn>
      </Card>

      <SectionLabel>{t("ludo.home.joinLabel")}</SectionLabel>
      <Card>
        <BodyText muted>{t("ludo.home.joinHint")}</BodyText>
        <form onSubmit={join} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            dir="ltr"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000 000"
            aria-label={t("ludo.home.joinLabel")}
            style={{
              flex: "1 1 160px",
              minHeight: 56,
              padding: "0 16px",
              borderRadius: 14,
              border: `1.5px solid ${C.warmGray}`,
              background: C.white,
              fontSize: ts(22),
              letterSpacing: "0.12em",
              fontFamily: "inherit",
              color: C.textMain,
            }}
          />
          <GhostBtn type="submit" disabled={busy} style={{ borderColor: C.green, color: C.green }}>
            {t("ludo.home.joinCta")}
          </GhostBtn>
        </form>
      </Card>
    </>
  );
}
