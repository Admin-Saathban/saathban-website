/* ════════════════════════════════════════════════
   Moments — "I'm at X" (OUT_AND_ABOUT_SPEC §8), with §6's
   per-action visibility.

   §8: "A person can say where they are without creating a permanent
   place. It sits in the tab while it is live. When it is over it
   moves to past, visible to the people who were there. It clears
   after 48 hours, leaving a window to report anything."

   ── Why this exists at all ──

   §4.1's ruling makes places admin-seeded. Without moments, somebody
   whose answer is "the chai stall on the corner" has two options:
   petition for a permanent civic record of a chai stall, or say
   nothing. Moments are the escape hatch, and they leave no artefact.

   ── §6, at the moment of acting ──

   "At the moment of acting, the person chooses, and the app says in
   PLAIN WORDS what each choice does. Not mode names."

   So the two options are not "Public / Private". They are the
   consequence of each, in a sentence — the same rule that governs
   §1's group privacy screen, and for the same reason: a person who
   picks the wrong one here has told the neighbourhood where they are.

   The three windows (live → past → gone at 48h) are enforced in the
   row's read policy in 0066, not in this file. If this screen were
   wrong, the database would still refuse.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { OutdoorScreen, Card, BodyText, SectionLabel, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { fetchLiveMoments, fetchPastMoments, startMoment, endMoment, joinMoment, fetchMomentPresence } from "./momentsData.js";
import { fetchAuthors } from "./outdoorData.js";

const timeOf = (iso, lang) =>
  new Date(iso).toLocaleTimeString(lang === "ur" ? "ur-PK" : "en-GB", {
    hour: "numeric",
    minute: "2-digit",
    // en-GB is 24-hour, so 1:12am and 1:12pm both render "1:12".
    hour12: true,
  });

export default function Moments() {
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [live, setLive] = useState([]);
  const [past, setPast] = useState([]);
  const [names, setNames] = useState({});
  const [presence, setPresence] = useState({});
  const [label, setLabel] = useState("");
  const [visibility, setVisibility] = useState("connections");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([
        fetchLiveMoments().catch(() => []),
        fetchPastMoments().catch(() => []),
      ]);
      setLive(l);
      setPast(p);
      const ids = [...new Set([...l, ...p].map((m) => m.profile_id))];
      setNames(await fetchAuthors(ids).catch(() => ({})));
      setPresence(await fetchMomentPresence([...l, ...p].map((m) => m.id)).catch(() => ({})));
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await fn(); await load(); }
    catch { setError(t("outdoor.moments.failed")); }
    setBusy(false);
  };

  const mine = live.find((m) => m.profile_id === myId);

  return (
    <OutdoorScreen backTo="/app/outdoor" backLabel={t("whatson.back")}>
      <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(28), fontWeight: 800, color: C.brown, margin: "0 0 14px" }}>
        {t("outdoor.moments.title")}
      </h1>

      {error && <BodyText role="alert" style={{ color: C.error, fontWeight: 700 }}>{error}</BodyText>}

      {/* ── Saying where you are ── */}
      {mine ? (
        <Card style={{ borderColor: C.green, borderWidth: 2, borderStyle: "solid" }}>
          <BodyText style={{ margin: 0, fontWeight: 700 }}>{mine.label}</BodyText>
          <BodyText muted style={{ margin: "4px 0 12px" }}>
            {t("outdoor.moments.untilAbout", { time: timeOf(mine.expires_at, lang) })}
          </BodyText>
          {/* Ending early is offered, never required — §5's rule that
              nobody has to remember to check out applies here too. */}
          <GhostBtn disabled={busy} onClick={() => act(() => endMoment(mine.id))}>
            {t("outdoor.moments.end")}
          </GhostBtn>
        </Card>
      ) : (
        <Card>
          <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, marginBottom: 8 }}>
            {t("outdoor.moments.cta")}
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("outdoor.moments.placeholder")}
            maxLength={120}
            dir={meta.dir}
            style={{
              width: "100%", minHeight: A11Y.minTapTargetPx, fontSize: ts(A11Y.minBodyPx),
              padding: "10px 14px", borderRadius: 14, border: `2px solid ${C.warmGray}`, marginBottom: 14,
            }}
          />

          {/* §6 — plain words, not mode names. */}
          <div style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, marginBottom: 8 }}>
            {t("outdoor.moments.whoSees")}
          </div>
          {[
            ["connections", "outdoor.vis.circleName", "outdoor.vis.circleWhat"],
            ["board", "outdoor.vis.boardName", "outdoor.vis.boardWhat"],
          ].map(([key, nameKey, whatKey]) => (
            <button
              key={key}
              type="button"
              onClick={() => setVisibility(key)}
              aria-pressed={visibility === key}
              style={{
                display: "block", width: "100%", textAlign: "start", marginBottom: 10,
                padding: "12px 14px", borderRadius: 14, minHeight: A11Y.minTapTargetPx,
                border: visibility === key ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
                background: visibility === key ? "#EEF3E8" : C.white,
                fontFamily: "inherit", cursor: "pointer",
              }}
            >
              <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
                {t(nameKey)}
              </span>
              <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>{t(whatKey)}</span>
            </button>
          ))}

          <PrimaryBtn
            disabled={busy || !label.trim()}
            onClick={() => act(async () => { await startMoment({ label, visibility }); setLabel(""); })}
          >
            {busy ? t("outdoor.moments.starting") : t("outdoor.moments.start")}
          </PrimaryBtn>
        </Card>
      )}

      {/* ── Live ── */}
      <SectionLabel>{t("outdoor.moments.live")}</SectionLabel>
      {live.filter((m) => m.profile_id !== myId).length === 0 ? (
        <BodyText muted>{t("outdoor.moments.empty")}</BodyText>
      ) : (
        live.filter((m) => m.profile_id !== myId).map((m) => {
          const here = (presence[m.id] || []).includes(myId);
          return (
            <Card key={m.id}>
              <BodyText style={{ margin: 0, fontWeight: 700 }}>
                {t("whatson.isAt", { name: names[m.profile_id] || t("whatson.someone"), place: m.label })}
              </BodyText>
              <BodyText muted style={{ margin: "4px 0 10px" }}>
                {t("outdoor.moments.untilAbout", { time: timeOf(m.expires_at, lang) })}
              </BodyText>
              {here ? (
                <BodyText style={{ margin: 0, fontWeight: 700, color: C.green }}>
                  ✓ {t("outdoor.moments.youAreHere")}
                </BodyText>
              ) : (
                /* Saying you were there is what makes the moment
                   readable to you once it is over — presence IS the
                   record of who was there (0066). */
                <PrimaryBtn disabled={busy} onClick={() => act(() => joinMoment(m.id))}>
                  {t("outdoor.moments.imHereToo")}
                </PrimaryBtn>
              )}
            </Card>
          );
        })
      )}

      {/* ── Past: only to the people who were there, and only for 48h ── */}
      {past.length > 0 && (
        <>
          <SectionLabel>{t("outdoor.moments.past")}</SectionLabel>
          <BodyText muted style={{ marginTop: 0 }}>{t("outdoor.moments.pastNote")}</BodyText>
          {past.map((m) => (
            <Card key={m.id} style={{ opacity: 0.85 }}>
              <BodyText style={{ margin: 0 }}>
                {t("whatson.isAt", { name: names[m.profile_id] || t("whatson.someone"), place: m.label })}
              </BodyText>
              <BodyText muted style={{ margin: "4px 0 0" }}>
                {t("outdoor.moments.ended")} · {timeOf(m.ended_at || m.expires_at, lang)}
              </BodyText>
            </Card>
          ))}
        </>
      )}
    </OutdoorScreen>
  );
}
