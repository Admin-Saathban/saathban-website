/* ════════════════════════════════════════════════
   "Ask who's up for something" — PRODUCT_DECISIONS §12, Starting
   something.

   Six questions, in this order, and every one of them answerable
   without typing if the person would rather not:

     What          free text, plus quick chips (Chai · Walk · Ludo · …)
     Where         free text with suggestions from seeded places AND
                   common answers (the park, my home, on the phone).
                   Any text allowed; NEVER a fixed dropdown
     When          Now / Later today / Another day
     How many      Anyone / a limit
     Who can see   My people / My area
     Ask to confirm  a toggle — on, joining reads "I'm coming"

   The "any text allowed" rule is the one to hold on to. A dropdown of
   places says: the only things that exist are the ones we listed. A
   person whose answer is "at my sister's" must be able to say so.

   §11 — this ends where its result lives: the caller reloads the list
   and the new happening is in it. Nothing here shows a bare "Posted ✓".
   ════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { startActivityHere } from "./outdoorData.js";

const WHAT_CHIPS = ["chai", "walk", "ludo", "carrom", "talk", "sit"];
/* Common answers that are not places in any database — §12 names
   these three explicitly, and they cover most of what a person
   actually says. */
const WHERE_COMMON = ["thePark", "myHome", "onThePhone"];

const field = (ts) => ({
  width: "100%",
  minHeight: A11Y.minTapTargetPx,
  padding: "10px 14px",
  fontFamily: "inherit",
  fontSize: ts(A11Y.minBodyPx),
  color: C.textMain,
  background: C.white,
  border: `2px solid ${C.warmGray}`,
  borderRadius: 14,
  textAlign: "start",
});

function Chip({ active, children, onClick }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: A11Y.minTapTargetPx,
        padding: "0 16px",
        borderRadius: 50,
        border: active ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: active ? C.white : "transparent",
        color: active ? C.green : C.textMain,
        fontFamily: "inherit",
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: active ? 700 : 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Row({ label, children }) {
  const { ts } = useI18n();
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          color: C.textMain,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export default function StartSomething({ places = [], me, onClose, onStarted }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();

  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [placeId, setPlaceId] = useState(null);
  const [when, setWhen] = useState("now"); // now | later | another
  const [laterTime, setLaterTime] = useState("16:00");
  const [anotherDay, setAnotherDay] = useState("");
  const [limit, setLimit] = useState(""); // "" = anyone
  const [audience, setAudience] = useState("people"); // people | area
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* Suggestions come from the person's OWN area first — the places
     they might actually walk to — then the rest of their city. */
  const suggestions = useMemo(() => {
    const mine = [];
    const rest = [];
    for (const p of places) {
      const sameArea = me?.area && p.area && String(p.area).toLowerCase() === String(me.area).toLowerCase();
      (sameArea ? mine : rest).push(p);
    }
    return [...mine, ...rest].slice(0, 8);
  }, [places, me]);

  const startsAtIso = () => {
    if (when === "now") return null; // an open invitation, current for 24h
    const d = new Date();
    if (when === "later") {
      const [h, m] = laterTime.split(":").map(Number);
      d.setHours(h || 16, m || 0, 0, 0);
      return d.toISOString();
    }
    if (when === "another" && anotherDay) {
      const [h, m] = laterTime.split(":").map(Number);
      const day = new Date(`${anotherDay}T00:00:00`);
      day.setHours(h || 16, m || 0, 0, 0);
      return day.toISOString();
    }
    return null;
  };

  const submit = async () => {
    const activity = what.trim();
    if (!activity) {
      setError(t("whatson.start.needWhat"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await startActivityHere(profile.id, {
        activity,
        placeText: where.trim() || null,
        placeId: placeId || null,
        startsAtIso: startsAtIso(),
        note: null,
        limit: limit ? Number(limit) : null,
        rsvp: confirm,
        audience,
      });
      onStarted?.({ what: activity });
    } catch (e) {
      setError(t("whatson.start.failed"));
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginBottom: 18, borderColor: C.green, borderWidth: 2, borderStyle: "solid" }}>
      <h2
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(22),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 16px",
        }}
      >
        {t("whatson.start.title")}
      </h2>

      {/* WHAT — chips, or type anything */}
      <Row label={t("whatson.start.what")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {WHAT_CHIPS.map((k) => (
            <Chip key={k} active={what === t(`whatson.chip.${k}`)} onClick={() => setWhat(t(`whatson.chip.${k}`))}>
              {t(`whatson.chip.${k}`)}
            </Chip>
          ))}
        </div>
        <input
          type="text"
          value={what}
          maxLength={80}
          onChange={(e) => setWhat(e.target.value)}
          placeholder={t("whatson.start.whatPlaceholder")}
          dir={meta.dir}
          style={field(ts)}
        />
      </Row>

      {/* WHERE — suggestions, common answers, or anything at all */}
      <Row label={t("whatson.start.where")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {suggestions.map((p) => (
            <Chip
              key={p.id}
              active={placeId === p.id}
              onClick={() => {
                setPlaceId(placeId === p.id ? null : p.id);
                setWhere(placeId === p.id ? "" : p.name);
              }}
            >
              {p.name}
            </Chip>
          ))}
          {WHERE_COMMON.map((k) => (
            <Chip
              key={k}
              active={!placeId && where === t(`whatson.where.${k}`)}
              onClick={() => {
                setPlaceId(null);
                setWhere(t(`whatson.where.${k}`));
              }}
            >
              {t(`whatson.where.${k}`)}
            </Chip>
          ))}
        </div>
        <input
          type="text"
          value={where}
          maxLength={80}
          onChange={(e) => {
            setWhere(e.target.value);
            setPlaceId(null); // typed text wins over a chosen place
          }}
          placeholder={t("whatson.start.wherePlaceholder")}
          dir={meta.dir}
          style={field(ts)}
        />
      </Row>

      {/* WHEN */}
      <Row label={t("whatson.start.when")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["now", "later", "another"].map((k) => (
            <Chip key={k} active={when === k} onClick={() => setWhen(k)}>
              {t(`whatson.when.${k}`)}
            </Chip>
          ))}
        </div>
        {when !== "now" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {when === "another" && (
              <input
                type="date"
                value={anotherDay}
                onChange={(e) => setAnotherDay(e.target.value)}
                style={{ ...field(ts), width: "auto", flex: "1 1 150px" }}
              />
            )}
            <input
              type="time"
              value={laterTime}
              onChange={(e) => setLaterTime(e.target.value)}
              style={{ ...field(ts), width: "auto", flex: "1 1 120px" }}
            />
          </div>
        )}
      </Row>

      {/* HOW MANY */}
      <Row label={t("whatson.start.howMany")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Chip active={!limit} onClick={() => setLimit("")}>
            {t("whatson.start.anyone")}
          </Chip>
          {[2, 3, 4, 6].map((n) => (
            <Chip key={n} active={String(limit) === String(n)} onClick={() => setLimit(String(n))}>
              {t("whatson.start.upTo", { n })}
            </Chip>
          ))}
        </div>
      </Row>

      {/* WHO CAN SEE IT */}
      <Row label={t("whatson.start.whoSees")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip active={audience === "people"} onClick={() => setAudience("people")}>
            {t("whatson.start.myPeople")}
          </Chip>
          <Chip active={audience === "area"} onClick={() => setAudience("area")}>
            {t("whatson.start.myArea")}
          </Chip>
        </div>
      </Row>

      {/* ASK THEM TO CONFIRM */}
      <Row label={t("whatson.start.askConfirm")}>
        <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: A11Y.minTapTargetPx }}>
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            style={{ width: 26, height: 26 }}
          />
          <BodyText style={{ margin: 0 }}>
            {confirm ? t("whatson.start.confirmOn") : t("whatson.start.confirmOff")}
          </BodyText>
        </label>
      </Row>

      {error && (
        <BodyText role="alert" style={{ color: C.brown, fontWeight: 700, margin: "0 0 12px" }}>
          {error}
        </BodyText>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <PrimaryBtn onClick={submit} disabled={busy} style={{ flex: "1 1 200px" }}>
          {busy ? "…" : t("whatson.start.send")}
        </PrimaryBtn>
        <GhostBtn onClick={onClose} disabled={busy}>
          {t("whatson.start.cancel")}
        </GhostBtn>
      </div>

      {/* Who will hear about it — said plainly, because §12's protocol
          is deliberately narrow and a person should know it is not a
          broadcast to the whole neighbourhood. */}
      <BodyText muted style={{ margin: "14px 0 0", fontSize: ts(A11Y.minBodyPx) }}>
        {placeId ? t("whatson.start.reachWithPlace") : t("whatson.start.reach")}
      </BodyText>
    </Card>
  );
}
