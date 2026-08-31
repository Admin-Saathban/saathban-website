/* ════════════════════════════════════════════════
   Access notes — the admin screen (OUT_AND_ABOUT_SPEC §4, §4.1).

   §4.1 is now ruled: admin-seeded is what launches, and admins can
   edit the notes later. This is that screen.

   ── What this screen is really for ──

   Not data entry. The seeded notes are GUESSES — mine, written to
   test the chips — and §4 is blunt about what a guess costs here: "if
   it says 'flat walk' and there are steps, someone made a trip they
   could not complete." So every note carries whether a person has
   actually checked it, and an unverified note does not reach a place
   row at all (0065).

   That makes the primary action on this screen "confirm", not "add".
   A place shows its guesses, greyed and labelled as unchecked, and
   one tap per note turns a guess into a fact once somebody has looked.

   ── Why the counts are at the top ──

   The honest state at launch is that most places have nothing
   confirmed, and that is worth an admin seeing in one number rather
   than by scrolling. It is a work queue, not a dashboard.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Card, AdminBtn } from "./ui.jsx";
import { fetchPlaces, fetchAllAccessNotes, setAccessNote, confirmAccessNote } from "../outdoor/outdoorData.js";
import { ACCESS_PRESENT, ACCESS_KNOW, accessTone } from "../outdoor/AccessChips.jsx";

const ALL = [...ACCESS_PRESENT, ...ACCESS_KNOW];

export default function PlaceAccess() {
  const { t, ts } = useI18n();
  const [places, setPlaces] = useState([]);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [onlyUnchecked, setOnlyUnchecked] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pl, nt] = await Promise.all([fetchPlaces(), fetchAllAccessNotes()]);
      setPlaces(pl);
      setNotes(nt);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    let unchecked = 0, confirmed = 0, placesWithNone = 0;
    for (const p of places) {
      const rows = notes[p.id] || [];
      if (rows.filter((r) => r.verified).length === 0) placesWithNone++;
      for (const r of rows) (r.verified ? confirmed++ : unchecked++);
    }
    return { unchecked, confirmed, placesWithNone };
  }, [places, notes]);

  const shown = onlyUnchecked
    ? places.filter((p) => (notes[p.id] || []).some((r) => !r.verified))
    : places;

  const act = async (fn, key) => {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    }
    setBusy(null);
  };

  const state = (placeId, feature) => (notes[placeId] || []).find((r) => r.feature === feature) || null;

  return (
    <div className="sb-notes">
      {/* This is a work queue somebody will empty from a phone —
          seventeen notes, one tap each — not a desktop table that
          happens to also load on mobile.

          Below 640 the chips stop being chips: they become full-width
          rows, one per line, each a whole tap target. Two-per-line
          chips at 390px put a 48px target beside another 48px target
          with 8px between them, which is how you confirm the wrong
          note about a place you have never been to. */}
      <style>{`
        .sb-notes-chips { display: grid; gap: 8px; }
        .sb-notes-chip { justify-content: flex-start; }
        .sb-notes-confirm { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        @media (min-width: 641px) {
          .sb-notes-chips { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
        }
        @media (max-width: 640px) {
          .sb-notes-chips { grid-template-columns: 1fr; }
          .sb-notes-chip { width: 100%; }
          .sb-notes-confirm { display: block; }
          .sb-notes-confirm > button { width: 100%; }
          .sb-notes-hint { display: block; margin: 8px 0 0; margin-inline-start: 0 !important; }
        }
      `}</style>
      <h1 style={{ fontSize: ts(26), fontWeight: 800, color: C.brown, margin: "0 0 6px" }}>
        {t("admin.access.title")}
      </h1>
      <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
        {t("admin.access.blurb")}
      </p>

      {/* The state of the work, plainly. */}
      <Card title={t("admin.access.stateTitle")}>
        <p style={{ fontSize: ts(A11Y.minBodyPx), margin: "0 0 10px", lineHeight: 1.6 }}>
          {t("admin.access.stateBody", {
            unchecked: stats.unchecked,
            confirmed: stats.confirmed,
            places: stats.placesWithNone,
          })}
        </p>
        <AdminBtn kind={onlyUnchecked ? "solid" : "outline"} onClick={() => setOnlyUnchecked((v) => !v)}>
          {onlyUnchecked ? t("admin.access.showAll") : t("admin.access.showUnchecked")}
        </AdminBtn>
      </Card>

      {error && (
        <p role="alert" style={{ color: C.error, fontWeight: 700, fontSize: ts(A11Y.minBodyPx) }}>{error}</p>
      )}

      {shown.map((p) => {
        const rows = notes[p.id] || [];
        const unchecked = rows.filter((r) => !r.verified);
        return (
          <Card
            key={p.id}
            title={p.name}
            /* Area under the name rather than beside it: at 390px
               "Badshahi Mosque courtyard" and "Walled City · Lahore"
               were each wrapping to two lines to share one row. */
            aside={undefined}
          >
            <p style={{ margin: "0 0 8px", fontSize: ts(15), color: C.textMuted }}>
              {p.area} · {p.city}
            </p>
            {unchecked.length > 0 && (
              <p style={{ margin: "0 0 10px", fontSize: ts(16), color: C.brown, fontWeight: 700 }}>
                {t("admin.access.uncheckedHere", { n: unchecked.length })}
              </p>
            )}

            <div className="sb-notes-chips">
              {ALL.map((f) => {
                const row = state(p.id, f);
                const on = !!row;
                const confirmed = !!row?.verified;
                const present = accessTone(f) === "present";
                const key = `${p.id}:${f}`;
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={busy === key}
                    onClick={() =>
                      act(
                        () =>
                          !on
                            ? /* an admin adding a note IS the check —
                                 they are the person who looked */
                              setAccessNote(p.id, f, true, { verified: true })
                            : confirmed
                              ? setAccessNote(p.id, f, false)
                              : confirmAccessNote(p.id, f),
                        key
                      )
                    }
                    title={
                      !on
                        ? t("admin.access.hintAdd")
                        : confirmed
                          ? t("admin.access.hintRemove")
                          : t("admin.access.hintConfirm")
                    }
                    className="sb-notes-chip"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      /* Taller than the 48px floor: this is the one
                         control on the screen and it is pressed
                         seventeen times in a row. */
                      minHeight: A11Y.minTapTargetPx + 6,
                      padding: "0 16px",
                      borderRadius: 14,
                      fontFamily: "inherit",
                      fontSize: ts(16),
                      fontWeight: 600,
                      cursor: "pointer",
                      /* Three states, and never colour alone:
                         off (outline), a guess (dashed — visibly not
                         finished), confirmed (filled). */
                      border: !on
                        ? `1px solid ${C.warmGray}`
                        : confirmed
                          ? `2px solid ${present ? "#C6DCB4" : C.warmGray}`
                          : `2px dashed ${C.brown}`,
                      background: !on ? C.white : confirmed ? (present ? "#EAF2E3" : C.cream) : "#FFF6E8",
                      color: !on ? C.textMuted : confirmed ? (present ? C.green : C.textMuted) : C.brown,
                      opacity: busy === key ? 0.5 : 1,
                    }}
                  >
                    <span aria-hidden="true">{!on ? "＋" : confirmed ? (present ? "✓" : "·") : "?"}</span>
                    {t(`outdoor.access.f.${f}`)}
                    {on && !confirmed && (
                      <span style={{ fontSize: ts(13), fontWeight: 700 }}>
                        {t("admin.access.guess")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {unchecked.length > 0 && (
              <div className="sb-notes-confirm" style={{ marginTop: 12 }}>
                <AdminBtn
                  kind="solid"
                  disabled={busy === p.id}
                  onClick={() =>
                    act(async () => {
                      for (const r of unchecked) await confirmAccessNote(p.id, r.feature);
                    }, p.id)
                  }
                >
                  {t("admin.access.confirmAll", { n: unchecked.length })}
                </AdminBtn>
                <span className="sb-notes-hint" style={{ fontSize: ts(15), color: C.textMuted, marginInlineStart: 12 }}>
                  {t("admin.access.confirmAllHint")}
                </span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
