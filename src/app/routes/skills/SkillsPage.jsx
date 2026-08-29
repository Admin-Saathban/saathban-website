/* ════════════════════════════════════════════════
   Skills tab — three real cards, each with a "Tell me when this opens"
   button wired to skill_interest (migration 0012). The button is a
   toggle: tap once to join the list, again to leave. Interest is the
   demand signal that decides what launches (SPEC.md, Skills).

   Any signed-in role. Accessibility floors throughout; the interested
   state is shown with a ✓ and words, never colour alone.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { STRINGS, SKILLS } from "./strings.js";
import { fetchMyInterests, setInterest } from "./data.js";

function SkillCard({ skill, s, interested, busy, onToggle }) {
  const { ts, meta } = useI18n();
  const card = s.cards[skill];
  return (
    <section
      style={{
        background: C.white,
        border: `1px solid ${interested ? C.sage : C.warmGray}`,
        borderRadius: 20,
        padding: 24,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span aria-hidden="true" style={{ fontSize: ts(30) }}>{card.emoji}</span>
        <h2 style={{ fontFamily: meta.fonts.heading, fontSize: ts(24), fontWeight: 700, color: C.green, margin: 0 }}>
          {card.name}
        </h2>
      </div>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.6, margin: "0 0 18px" }}>
        {card.desc}
      </p>

      <button
        type="button"
        aria-pressed={interested}
        disabled={busy}
        onClick={onToggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          minHeight: 56,
          padding: "0 24px",
          borderRadius: 50,
          border: `2px solid ${C.green}`,
          background: interested ? C.green : C.white,
          color: interested ? C.cream : C.green,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {interested && <span aria-hidden="true">✓</span>}
        {interested ? s.interestedCta : s.interestCta}
      </button>

      {interested && (
        <p role="status" style={{ fontSize: ts(16), color: C.textMuted, margin: "10px 0 0" }}>
          {s.interestedNote}
        </p>
      )}
    </section>
  );
}

export default function SkillsPage() {
  const { lang, ts, meta } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const { profile } = useSession();

  const [interested, setInterestedSet] = useState(null); // null = loading; else Set
  const [busy, setBusy] = useState(null); // skill id currently saving
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mine = await fetchMyInterests();
        if (alive) setInterestedSet(new Set(mine));
      } catch {
        if (alive) setInterestedSet(new Set());
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (skill) => {
    if (!profile?.id) return;
    const on = !interested.has(skill);
    setError("");
    setBusy(skill);
    // optimistic
    setInterestedSet((prev) => {
      const next = new Set(prev);
      on ? next.add(skill) : next.delete(skill);
      return next;
    });
    try {
      await setInterest(profile.id, skill, on);
    } catch {
      // rollback
      setInterestedSet((prev) => {
        const next = new Set(prev);
        on ? next.delete(skill) : next.add(skill);
        return next;
      });
      setError(s.saveError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.textMain, padding: "20px 16px 64px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
          {s.title}
        </h1>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 22px", lineHeight: 1.6 }}>
          {s.subtitle}
        </p>

        {error && (
          <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), color: C.error, fontWeight: 600, margin: "0 0 16px" }}>
            {error}
          </p>
        )}

        {interested === null ? (
          <p aria-busy="true" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>···</p>
        ) : (
          SKILLS.map((skill) => (
            <SkillCard
              key={skill}
              skill={skill}
              s={s}
              interested={interested.has(skill)}
              busy={busy === skill}
              onToggle={() => toggle(skill)}
            />
          ))
        )}
      </div>
    </main>
  );
}
