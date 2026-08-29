/* ════════════════════════════════════════════════
   "Suggest a gathering" — the Icon's form (migration 0019).

   Title, a place (picked from outdoor_places or typed freely), a day,
   an optional time, and an optional note. Submitting lands a pending
   proposal; an admin reviews it in events → Manage. On success the
   screen becomes a warm confirmation — the proposer hears back either
   way (approval or a kind decline) as an in-app notification.

   Reached only by Icons (the route guards the role; RLS enforces it).
   Floors and RTL come from the shared events primitives + useI18n.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Screen, Card, BodyText, PrimaryBtn, GhostBtn, inputStyle } from "./ui.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { fetchPlaces, submitProposal } from "./proposalsStore.js";
import { STRINGS } from "./proposalsCopy.js";

const BLANK = { title: "", place_id: "", place_text: "", event_date: "", start_time: "", note: "" };

export default function SuggestGathering() {
  const { lang, ts, meta, t } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;

  const [places, setPlaces] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [status, setStatus] = useState("editing"); // editing | sending | sent
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPlaces().then(setPlaces).catch(() => setPlaces([]));
  }, []);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError(s.errTitle);
    if (!form.event_date) return setError(s.errDate);
    if (!form.place_id && !form.place_text.trim()) return setError(s.errPlace);
    if (status === "sending") return; // one suggestion per tap
    setStatus("sending");
    setError("");
    try {
      await submitProposal(form);
      setStatus("sent");
      pushToast(t("feedback.eventSuggested"));
    } catch {
      setStatus("editing");
      setError(s.errGeneric);
      pushToast(s.errGeneric, { tone: "error" });
    }
  };

  const labelStyle = { display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 18 };

  if (status === "sent") {
    return (
      <Screen backTo="." backLabel={s.backToEvents}>
        <Card style={{ marginTop: 12 }}>
          <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(28), fontWeight: 700, color: C.green, margin: "0 0 10px" }}>
            ✓ {s.sentTitle}
          </h1>
          <BodyText>{s.sentBody}</BodyText>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <PrimaryBtn onClick={() => { setForm(BLANK); setStatus("editing"); }}>
              {s.another}
            </PrimaryBtn>
          </div>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen backTo="." backLabel={s.backToEvents}>
      <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(32), fontWeight: 700, color: C.green, margin: "12px 0 8px" }}>
        {s.title}
      </h1>
      <BodyText muted>{s.intro}</BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>⚠ {error}</BodyText>
      )}

      <Card>
        <form onSubmit={submit}>
          <label style={labelStyle}>
            {s.titleLabel}
            <input value={form.title} onChange={set("title")} placeholder={s.titlePh} style={inputStyle(ts)} />
          </label>

          <label style={labelStyle}>
            {s.placeLabel}
            <select value={form.place_id} onChange={set("place_id")} style={inputStyle(ts)}>
              <option value="">{s.placeChoose}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.name, p.area, p.city].filter(Boolean).join(", ")}
                </option>
              ))}
            </select>
          </label>

          {/* Free-text place — used when nothing is picked above */}
          <label style={labelStyle}>
            {s.placeOwnLabel}
            <input
              value={form.place_text}
              onChange={set("place_text")}
              placeholder={s.placeOwnPh}
              disabled={!!form.place_id}
              style={{ ...inputStyle(ts), opacity: form.place_id ? 0.5 : 1 }}
            />
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <label style={labelStyle}>
                {s.dateLabel}
                <input type="date" value={form.event_date} onChange={set("event_date")} style={inputStyle(ts)} />
              </label>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <label style={labelStyle}>
                {s.timeLabel}
                <input type="time" value={form.start_time} onChange={set("start_time")} style={inputStyle(ts)} />
              </label>
            </div>
          </div>

          <label style={labelStyle}>
            {s.noteLabel}
            <textarea rows={4} value={form.note} onChange={set("note")} placeholder={s.notePh} style={{ ...inputStyle(ts), resize: "vertical" }} />
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <PrimaryBtn type="submit" disabled={status === "sending"}>
              {status === "sending" ? s.sending : s.submitCta}
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </Screen>
  );
}
