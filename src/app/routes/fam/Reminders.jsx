/* ════════════════════════════════════════════════
   Reminders & routines for one connected Icon — reachable only
   through a card that rendered the button, which itself only renders
   with the manageReminders permission. As a second gate, this screen
   re-checks the permission and bounces to the dashboard without it,
   the same shape the RLS-backed version will have.

   Add / change / remove work against local state (mock). Positioning
   per SPEC.md: reminders are gentle nudges positioned as part of the
   log, never alarms to rely on (iOS PWA push is best-effort) — the
   intro says so in words, and the times are labeled with the Icon's
   timezone because most Fam members are overseas.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { FamScreen, Card, PrimaryBtn, GhostBtn, BodyText } from "./ui.jsx";
import { MOCK_CONNECTED_ICONS, COPY } from "./famMock.js";

const DAY_CHOICES = ["Every day", "Weekdays", "Weekends", "Sundays", "Mon · Wed · Fri"];
const BLANK = { label: "", time: "18:00", days: DAY_CHOICES[0] };

export default function Reminders() {
  const { iconId } = useParams();
  const { ts, meta } = useI18n();
  const icon = MOCK_CONNECTED_ICONS.find((i) => i.id === iconId);

  // Unknown Icon or no granted permission → back to the dashboard.
  if (!icon || !icon.permissions.manageReminders) {
    return <Navigate to="/app/fam" replace />;
  }

  const c = COPY.reminders;
  const first = icon.name.split(" ")[0];
  const [reminders, setReminders] = useState(icon.reminders);
  const [editing, setEditing] = useState(null); // null | "new" | reminder id
  const [form, setForm] = useState(BLANK);
  const [savedNote, setSavedNote] = useState(false);

  const startNew = () => {
    setForm(BLANK);
    setEditing("new");
    setSavedNote(false);
  };
  const startEdit = (r) => {
    setForm({ label: r.label, time: r.time, days: r.days });
    setEditing(r.id);
    setSavedNote(false);
  };
  const save = (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    if (editing === "new") {
      setReminders([...reminders, { id: `r-${reminders.length + 1}-${form.label.length}`, icon: "⏰", ...form }]);
    } else {
      setReminders(reminders.map((r) => (r.id === editing ? { ...r, ...form } : r)));
    }
    setEditing(null);
    setSavedNote(true);
  };
  const remove = (id) => setReminders(reminders.filter((r) => r.id !== id));

  const field = (label, control) => (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 6 }}>
        {label}
        {control}
      </label>
    </div>
  );

  return (
    <FamScreen backTo="/app/fam" backLabel={COPY.invite.backToDashboard}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 8px",
        }}
      >
        {c.title(first)}
      </h1>
      <BodyText muted style={{ marginBottom: 24 }}>
        {c.intro(first, icon.timezoneLabel)}
      </BodyText>

      {savedNote && (
        <BodyText
          role="status"
          style={{ fontWeight: 600, color: C.green, marginBottom: 16 }}
        >
          ✓ {c.savedNote}
        </BodyText>
      )}

      {reminders.length === 0 && !editing && <BodyText muted>{c.empty}</BodyText>}

      {reminders.map((r) =>
        editing === r.id ? null : (
          <Card key={r.id} style={{ padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true" style={{ fontSize: ts(24) }}>
                {r.icon}
              </span>
              <div style={{ flex: "1 1 200px" }}>
                <BodyText style={{ fontWeight: 600, margin: 0 }}>{r.label}</BodyText>
                <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                  {r.time} · {r.days}
                </BodyText>
              </div>
              <GhostBtn onClick={() => startEdit(r)}>{c.editCta}</GhostBtn>
              {/* One tap, no confirmation maze — mirrors the circle's
                  removal rule for things this member manages. */}
              <GhostBtn onClick={() => remove(r.id)} style={{ color: C.error, borderColor: C.error }}>
                {c.deleteCta}
              </GhostBtn>
            </div>
          </Card>
        )
      )}

      {editing ? (
        <Card>
          <form onSubmit={save}>
            {field(
              c.labelField,
              <input
                autoFocus
                value={form.label}
                placeholder={c.labelPlaceholder}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            )}
            {field(
              c.timeField,
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            )}
            {field(
              c.daysField,
              <select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })}>
                {DAY_CHOICES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryBtn type="submit" style={{ minWidth: 200 }}>
                {c.saveCta}
              </PrimaryBtn>
              <GhostBtn onClick={() => setEditing(null)}>{c.cancelCta}</GhostBtn>
            </div>
          </form>
        </Card>
      ) : (
        <PrimaryBtn onClick={startNew} style={{ marginTop: 8 }}>
          {c.addCta}
        </PrimaryBtn>
      )}
    </FamScreen>
  );
}
