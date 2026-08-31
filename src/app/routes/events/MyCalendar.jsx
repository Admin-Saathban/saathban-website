/* ════════════════════════════════════════════════
   My calendar (SPEC.md §Events + Calendar): gatherings I said yes to,
   plus personal entries, birthdays (yearly), and custom reminders —
   one chronological list, deliberately not a month grid: a list reads
   at any text size and never hides a date behind a cell.

   calendar_entries are owner-only at the database (not even admins);
   RSVP'd gatherings arrive through my own event_rsvps rows.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  fetchMyRsvps,
  fetchCalendarEntries,
  addCalendarEntry,
  deleteCalendarEntry,
  nextOccurrence,
  localIsoDate,
} from "./eventsStore.js";
import { Card, Pill, PrimaryBtn, GhostBtn, BodyText, inputStyle } from "./ui.jsx";
import { pushToast } from "../../lib/feedback.jsx";

const KIND_ICONS = { personal: "📌", birthday: "🎂", custom_reminder: "⏰", event: "🎪" };
const ENTRY_KINDS = ["personal", "birthday", "custom_reminder"];
const BLANK = { kind: "personal", title: "", entry_date: "", entry_time: "" };

function dayLabel(d, lang) {
  return d.toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function MyCalendar() {
  const { t, ts, meta, lang } = useI18n();

  const [items, setItems] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false); // a locale key; t() at render

  const load = async () => {
    const [rsvps, entries] = await Promise.all([
      fetchMyRsvps().catch(() => []),
      fetchCalendarEntries(),
    ]);
    const today = localIsoDate();
    const eventItems = rsvps
      .filter((r) => r.event_date >= today)
      .map((r) => ({
        id: `ev-${r.id}`,
        kind: "event",
        title: r.title,
        when: r.when,
        timeLabel: r.timeLabel,
        venue: r.venue,
      }));
    const entryItems = entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      when: nextOccurrence(e),
      timeLabel: e.entry_time ? e.entry_time.slice(0, 5) : null,
      deletable: true,
    }));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    setItems(
      [...eventItems, ...entryItems]
        .filter((i) => i.when >= cutoff)
        .sort((a, b) => a.when - b.when)
    );
  };

  useEffect(() => {
    load().catch(() => setError("events.calendar.saveError"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.entry_date || saving) return;
    setError("");
    setSaving(true);
    try {
      await addCalendarEntry({
        kind: form.kind,
        title: form.title.trim(),
        entry_date: form.entry_date,
        entry_time: form.entry_time || null,
        repeats_yearly: form.kind === "birthday",
      });
      setForm(BLANK);
      setAdding(false);
      await load();
      pushToast(t("feedback.calendarAdded"));
    } catch {
      setError("events.calendar.saveError");
      pushToast(t("events.calendar.saveError"), { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  /* One tap — mirrors the app-wide removal rule. */
  const remove = async (id) => {
    setError("");
    try {
      await deleteCalendarEntry(id);
      await load();
      pushToast(t("feedback.calendarRemoved"), { tone: "info" });
    } catch {
      setError("events.calendar.saveError");
      pushToast(t("events.calendar.saveError"), { tone: "error" });
    }
  };

  const field = (label, control) => (
    <label
      style={{
        display: "block",
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        marginBottom: 16,
      }}
    >
      {label}
      {control}
    </label>
  );

  return (
    <>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(32),
          fontWeight: 700,
          color: C.green,
          margin: "12px 0 8px",
        }}
      >
        {t("events.calendar.title")}
      </h1>
      <BodyText muted>{t("events.calendar.intro")}</BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {items === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : items.length === 0 && !adding ? (
        <BodyText muted>{t("events.calendar.empty")}</BodyText>
      ) : (
        items.map((item) => (
          <Card key={item.id} style={{ padding: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true" style={{ fontSize: ts(24) }}>
                {KIND_ICONS[item.kind]}
              </span>
              <div style={{ flex: "1 1 220px" }}>
                <BodyText style={{ fontWeight: 700, margin: 0 }}>{item.title}</BodyText>
                <BodyText muted style={{ margin: 0, fontSize: ts(18) }}>
                  {dayLabel(item.when, lang)}
                  {item.timeLabel ? ` · ${item.timeLabel}` : ""}
                  {item.venue ? ` · ${item.venue}` : ""}
                </BodyText>
              </div>
              {item.kind === "event" && <Pill tone="green">{t("events.calendar.eventTag")}</Pill>}
              {item.deletable && (
                <GhostBtn
                  onClick={() => remove(item.id)}
                  style={{ color: C.brown, borderColor: C.brown }}
                >
                  {t("events.calendar.deleteCta")}
                </GhostBtn>
              )}
            </div>
          </Card>
        ))
      )}

      {adding ? (
        <Card>
          <form onSubmit={save}>
            <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, margin: "0 0 8px" }}>
              {t("events.calendar.kindLabel")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {ENTRY_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={form.kind === kind}
                  onClick={() => setForm({ ...form, kind })}
                  style={{
                    minHeight: A11Y.minTapTargetPx,
                    padding: "8px 18px",
                    borderRadius: 14,
                    border: `2px solid ${form.kind === kind ? C.green : C.warmGray}`,
                    background: form.kind === kind ? C.green : C.white,
                    color: form.kind === kind ? C.cream : C.textMain,
                    fontSize: ts(18),
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {form.kind === kind ? "✓ " : ""}
                  {KIND_ICONS[kind]} {t(`events.calendar.kinds.${kind}`)}
                </button>
              ))}
            </div>

            {field(
              t("events.calendar.titleField"),
              <input
                autoFocus
                value={form.title}
                placeholder={t("events.calendar.titlePlaceholder")}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={inputStyle(ts)}
              />
            )}
            {field(
              t("events.calendar.dateField"),
              <input
                type="date"
                value={form.entry_date}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                style={inputStyle(ts)}
              />
            )}
            {field(
              t("events.calendar.timeField"),
              <input
                type="time"
                value={form.entry_time}
                onChange={(e) => setForm({ ...form, entry_time: e.target.value })}
                style={inputStyle(ts)}
              />
            )}
            {form.kind === "birthday" && (
              <BodyText muted style={{ fontSize: ts(18) }}>
                🎂 {t("events.calendar.yearlyNote")}
              </BodyText>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryBtn type="submit">{t("events.calendar.saveCta")}</PrimaryBtn>
              <GhostBtn onClick={() => setAdding(false)}>{t("events.calendar.cancelCta")}</GhostBtn>
            </div>
          </form>
        </Card>
      ) : (
        <PrimaryBtn onClick={() => setAdding(true)} style={{ marginTop: 8 }}>
          {t("events.calendar.addCta")}
        </PrimaryBtn>
      )}
    </>
  );
}
