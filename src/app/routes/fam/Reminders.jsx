/* ════════════════════════════════════════════════
   Reminders & routines for one connected Icon — wired to the real
   reminders table (migration 0011). Reachable only through a card
   that rendered the button, which itself only renders with the
   manageReminders grant; this screen re-checks the membership row and
   bounces without it. Either way RLS is the boundary: without
   can_manage_reminders the reads return nothing and the writes fail.

   Positioning per SPEC.md: reminders are gentle nudges, part of the
   log, never alarms to rely on (iOS PWA push is best-effort) — the
   intro says so in words.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  fetchMembershipsAsMember,
  fetchReminders,
  addReminder,
  updateReminder,
  deleteReminder,
} from "../../lib/circle.js";
import { FamScreen, Card, PrimaryBtn, GhostBtn, BodyText } from "./ui.jsx";
import { COPY } from "./famCopy.js";

const DAY_CHOICES = ["Every day", "Weekdays", "Weekends", "Sundays", "Mon · Wed · Fri"];
const BLANK = { label: "", time: "18:00", days: DAY_CHOICES[0] };

/* time column "18:30:00" → input value "18:30" / display "6:30 pm" */
const toInputTime = (t) => (t || "18:00").slice(0, 5);
function displayTime(t) {
  const [h, m] = toInputTime(t).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function Reminders() {
  const { iconId } = useParams();
  const { ts, meta } = useI18n();
  const c = COPY.reminders;

  const [membership, setMembership] = useState(undefined); // undefined = loading
  const [reminders, setReminders] = useState([]);
  const [editing, setEditing] = useState(null); // null | "new" | reminder id
  const [form, setForm] = useState(BLANK);
  const [savedNote, setSavedNote] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const memberships = await fetchMembershipsAsMember();
        const m = memberships.find((x) => x.icon_id === iconId) || null;
        if (cancelled) return;
        setMembership(m);
        if (m?.can_manage_reminders) {
          setReminders(await fetchReminders(iconId));
        }
      } catch {
        if (!cancelled) setMembership(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [iconId]);

  if (membership === undefined) {
    return (
      <FamScreen backTo="/app/fam" backLabel={COPY.invite.backToDashboard}>
        <BodyText muted role="status">…</BodyText>
      </FamScreen>
    );
  }

  // Unknown Icon or no granted permission → back to the dashboard.
  if (!membership || !membership.can_manage_reminders) {
    return <Navigate to="/app/fam" replace />;
  }

  const first = (membership.icon_profile?.full_name || "").split(" ")[0];

  const startNew = () => {
    setForm(BLANK);
    setEditing("new");
    setSavedNote(false);
    setError("");
  };
  const startEdit = (r) => {
    setForm({ label: r.label, time: toInputTime(r.remind_time), days: r.days_label });
    setEditing(r.id);
    setSavedNote(false);
    setError("");
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    setError("");
    const patch = {
      label: form.label.trim(),
      remind_time: form.time,
      days_label: form.days,
    };
    try {
      if (editing === "new") {
        await addReminder(iconId, patch);
      } else {
        await updateReminder(editing, patch);
      }
      setReminders(await fetchReminders(iconId));
      setEditing(null);
      setSavedNote(true);
    } catch {
      setError(c.saveError);
    }
  };

  /* One tap, no confirmation maze — mirrors the circle's removal rule. */
  const remove = async (id) => {
    setError("");
    try {
      await deleteReminder(id);
      setReminders(await fetchReminders(iconId));
    } catch {
      setError(c.saveError);
    }
  };

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
        {c.intro(first)}
      </BodyText>

      {savedNote && (
        <BodyText role="status" style={{ fontWeight: 600, color: C.green, marginBottom: 16 }}>
          ✓ {c.savedNote}
        </BodyText>
      )}
      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown, marginBottom: 16 }}>
          ⚠ {error}
        </BodyText>
      )}

      {reminders.length === 0 && !editing && <BodyText muted>{c.empty}</BodyText>}

      {reminders.map((r) =>
        editing === r.id ? null : (
          <Card key={r.id} style={{ padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true" style={{ fontSize: ts(24) }}>
                {r.emoji}
              </span>
              <div style={{ flex: "1 1 200px" }}>
                <BodyText style={{ fontWeight: 600, margin: 0 }}>{r.label}</BodyText>
                <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                  {displayTime(r.remind_time)} · {r.days_label}
                </BodyText>
              </div>
              <GhostBtn onClick={() => startEdit(r)}>{c.editCta}</GhostBtn>
              <GhostBtn onClick={() => remove(r.id)} style={{ color: C.brown, borderColor: C.brown }}>
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
