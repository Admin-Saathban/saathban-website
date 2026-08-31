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
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  fetchMembershipsAsMember,
  fetchReminders,
  addReminder,
  updateReminder,
  deleteReminder,
} from "../../lib/circle.js";
import { FamScreen, Card, PrimaryBtn, GhostBtn, BodyText } from "./ui.jsx";
import { useAction, useFresh, useToast } from "../../lib/feedback.jsx";

/* days_label stores the ENGLISH value (it's data, shared with the
   Icon's app); the select and the list display it through fam.days.*
   so the screen still reads right in Urdu. */
const DAY_OPTIONS = [
  { value: "Every day", key: "fam.days.everyDay" },
  { value: "Weekdays", key: "fam.days.weekdays" },
  { value: "Weekends", key: "fam.days.weekends" },
  { value: "Sundays", key: "fam.days.sundays" },
  { value: "Mon · Wed · Fri", key: "fam.days.mwf" },
];
const dayKeyFor = (v) => DAY_OPTIONS.find((d) => d.value === v)?.key || null;
const BLANK = { label: "", times: ["18:00"], days: DAY_OPTIONS[0].value };

/* remind_times (0015) with the old single remind_time as fallback. */
const timesOf = (r) =>
  r.remind_times?.length ? r.remind_times : [r.remind_time];

/* time column "18:30:00" → input value "18:30" / display "6:30 pm" */
const toInputTime = (t) => (t || "18:00").slice(0, 5);
function displayTime(t) {
  const [h, m] = toInputTime(t).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function Reminders() {
  const { iconId } = useParams();
  const { t, ts, meta } = useI18n();

  const [membership, setMembership] = useState(undefined); // undefined = loading
  const [reminders, setReminders] = useState([]);
  const [editing, setEditing] = useState(null); // null | "new" | reminder id
  const [form, setForm] = useState(BLANK);
  const [savedNote, setSavedNote] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const fresh = useFresh();

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
      <FamScreen backTo="/app/fam" backLabel={t("fam.invite.backToDashboard")}>
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
    setForm({ label: r.label, times: timesOf(r).map(toInputTime), days: r.days_label });
    setEditing(r.id);
    setSavedNote(false);
    setError("");
  };

  const setTime = (i, v) =>
    setForm((f) => ({ ...f, times: f.times.map((x, j) => (j === i ? v : x)) }));
  const addTime = () =>
    setForm((f) => ({ ...f, times: [...f.times, "08:00"] }));
  const removeTime = (i) =>
    setForm((f) => ({ ...f, times: f.times.filter((_, j) => j !== i) }));

  const [save, saving] = useAction(
    async (e) => {
      e?.preventDefault?.();
      if (!form.label.trim() || form.times.length === 0) return null;
      const times = [...new Set(form.times)].sort();
      const patch = {
        label: form.label.trim(),
        remind_time: times[0],
        remind_times: times,
        days_label: form.days,
      };
      const wasNew = editing === "new";
      const before = new Set(reminders.map((x) => x.id));
      if (wasNew) await addReminder(iconId, patch);
      else await updateReminder(editing, patch);
      const rows = await fetchReminders(iconId);
      setReminders(rows);
      setEditing(null);
      setSavedNote(true);
      // The saved reminder pulses in the list, new or edited.
      const target = wasNew ? rows.find((x) => !before.has(x.id)) : rows.find((x) => x.id === editing);
      if (target) fresh.mark(target.id);
      return wasNew;
    },
    {
      success: (wasNew) =>
        wasNew === null ? null : wasNew ? t("feedback.reminderSaved") : t("feedback.reminderUpdated"),
      error: () => t("fam.reminders.saveError"),
      retry: true,
    }
  );

  /* One tap, no confirmation maze — mirrors the circle's removal rule.
     Optimistic: the row leaves at once and comes back if the server
     refuses, so the list never lies about what is gone. */
  const remove = async (id) => {
    if (removing) return;
    setRemoving(id);
    setError("");
    const prior = reminders;
    setReminders((rs) => rs.filter((x) => x.id !== id));
    try {
      await deleteReminder(id);
      setReminders(await fetchReminders(iconId));
      toast(t("feedback.reminderRemoved"), { tone: "info" });
    } catch {
      setReminders(prior);
      toast(t("fam.reminders.saveError"), { tone: "error" });
    } finally {
      setRemoving(null);
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
    <FamScreen backTo="/app/fam" backLabel={t("fam.invite.backToDashboard")}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 8px",
        }}
      >
        {t("fam.reminders.title", { name: first })}
      </h1>
      <BodyText muted style={{ marginBottom: 24 }}>
        {t("fam.reminders.intro", { name: first })}
      </BodyText>

      {savedNote && (
        <BodyText role="status" style={{ fontWeight: 600, color: C.green, marginBottom: 16 }}>
          ✓ {t("fam.reminders.savedNote")}
        </BodyText>
      )}
      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown, marginBottom: 16 }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {reminders.length === 0 && !editing && <BodyText muted>{t("fam.reminders.empty")}</BodyText>}

      {reminders.map((r) =>
        editing === r.id ? null : (
          <Card key={r.id} {...fresh.props(r.id)} style={{ padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true" style={{ fontSize: ts(24) }}>
                {r.emoji}
              </span>
              <div style={{ flex: "1 1 200px" }}>
                <BodyText style={{ fontWeight: 600, margin: 0 }}>{r.label}</BodyText>
                <BodyText muted style={{ margin: 0, fontSize: ts(16) }}>
                  <span dir="ltr">{timesOf(r).map(displayTime).join(" · ")}</span> ·{" "}
                  {dayKeyFor(r.days_label) ? t(dayKeyFor(r.days_label)) : r.days_label}
                </BodyText>
              </div>
              <GhostBtn onClick={() => startEdit(r)}>{t("fam.reminders.editCta")}</GhostBtn>
              <GhostBtn onClick={() => remove(r.id)} disabled={removing === r.id} style={{ color: C.brown, borderColor: C.brown }}>
                {t("fam.reminders.deleteCta")}
              </GhostBtn>
            </div>
          </Card>
        )
      )}

      {editing ? (
        <Card>
          <form onSubmit={save}>
            {field(
              t("fam.reminders.labelField"),
              <input
                autoFocus
                value={form.label}
                placeholder={t("fam.reminders.labelPh")}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            )}
            {field(
              t("fam.reminders.timeField"),
              <div style={{ display: "grid", gap: 8 }}>
                {form.times.map((tm, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="time"
                      value={tm}
                      onChange={(e) => setTime(i, e.target.value)}
                      aria-label={t("fam.reminders.timeField")}
                    />
                    {form.times.length > 1 && (
                      <GhostBtn onClick={() => removeTime(i)} style={{ color: C.brown }}>
                        {t("common.remove")}
                      </GhostBtn>
                    )}
                  </div>
                ))}
                <GhostBtn onClick={addTime}>{t("fam.reminders.addTimeCta")}</GhostBtn>
              </div>
            )}
            {field(
              t("fam.reminders.daysField"),
              <select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })}>
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {t(d.key)}
                  </option>
                ))}
              </select>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryBtn type="submit" disabled={saving} style={{ minWidth: 200 }}>
                {saving ? t("feedback.saving") : t("fam.reminders.saveCta")}
              </PrimaryBtn>
              <GhostBtn onClick={() => setEditing(null)}>{t("fam.reminders.cancelCta")}</GhostBtn>
            </div>
          </form>
        </Card>
      ) : (
        <PrimaryBtn onClick={startNew} style={{ marginTop: 8 }}>
          {t("fam.reminders.addCta")}
        </PrimaryBtn>
      )}
    </FamScreen>
  );
}
