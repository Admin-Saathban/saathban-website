/* ════════════════════════════════════════════════
   Manage gatherings — the admin's simple create/edit page plus the
   door list with at-event check-in (SPEC.md §Events + Calendar).

   Reachable only through the Manage tab, which renders for admins;
   RLS is the boundary regardless — non-admin writes to events and
   event_rsvps hit no policy and change nothing.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  fetchAppEvents,
  fetchGoingCount,
  adminSaveEvent,
  adminFetchAttendees,
  adminSetCheckedIn,
} from "./eventsStore.js";
import { Card, Pill, PrimaryBtn, GhostBtn, BodyText, inputStyle } from "./ui.jsx";

const BLANK = {
  title: "",
  description: "",
  venue: "",
  city: "",
  event_date: "",
  start_time: "",
  end_time: "",
  capacity: "",
  is_published: false,
};

function toForm(ev) {
  const r = ev.raw;
  return {
    title: r.title,
    description: r.description || "",
    venue: r.venue || "",
    city: r.city || "",
    event_date: r.event_date,
    start_time: r.start_time ? r.start_time.slice(0, 5) : "",
    end_time: r.end_time ? r.end_time.slice(0, 5) : "",
    capacity: r.capacity == null ? "" : String(r.capacity),
    is_published: r.is_published,
  };
}

function toFields(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    venue: form.venue.trim() || null,
    city: form.city.trim() || null,
    event_date: form.event_date,
    start_time: form.start_time || null,
    end_time: form.end_time || null,
    capacity: form.capacity === "" ? null : Number(form.capacity),
    is_published: form.is_published,
  };
}

function DoorList({ eventId }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);

  const load = async () => setRows(await adminFetchAttendees(eventId));
  useEffect(() => {
    load().catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (rows === null) return <BodyText muted role="status">…</BodyText>;
  if (rows.length === 0) return <BodyText muted>{t("events.admin.noAttendees")}</BodyText>;

  return rows.map((r) => (
    <div
      key={r.id}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderTop: `1px solid ${C.warmGray}`,
      }}
    >
      <BodyText style={{ flex: "1 1 180px", margin: 0, fontWeight: 600 }}>
        {r.profile?.full_name || "—"}
        {r.profile?.city ? (
          <span style={{ color: C.textMuted, fontWeight: 400 }}> · {r.profile.city}</span>
        ) : null}
      </BodyText>
      {r.checked_in_at ? (
        <>
          <Pill tone="green">✓ {t("events.admin.checkedinBadge")}</Pill>
          <GhostBtn
            onClick={async () => {
              await adminSetCheckedIn(r.id, false);
              await load();
            }}
            style={{ minHeight: A11Y.minTapTargetPx }}
          >
            {t("events.admin.undoCta")}
          </GhostBtn>
        </>
      ) : (
        <GhostBtn
          onClick={async () => {
            await adminSetCheckedIn(r.id, true);
            await load();
          }}
        >
          ✓ {t("events.admin.checkinCta")}
        </GhostBtn>
      )}
    </div>
  ));
}

export default function AdminEvents() {
  const { t, ts, meta } = useI18n();

  const [events, setEvents] = useState(null);
  const [counts, setCounts] = useState({});
  const [editing, setEditing] = useState(null); // null | "new" | event id
  const [form, setForm] = useState(BLANK);
  const [doorFor, setDoorFor] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const all = await fetchAppEvents(); // admins see drafts too (RLS)
    const entries = await Promise.all(
      all.map(async (e) => [e.id, await fetchGoingCount(e.id).catch(() => 0)])
    );
    setEvents(all);
    setCounts(Object.fromEntries(entries));
  };

  useEffect(() => {
    load().catch(() => {
      setError("events.admin.saveError");
      setEvents([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.event_date) return;
    setBusy(true);
    setError("");
    try {
      await adminSaveEvent(toFields(form), editing === "new" ? undefined : editing);
      setEditing(null);
      setForm(BLANK);
      await load();
    } catch (err) {
      setError(err.message || "events.admin.saveError");
    } finally {
      setBusy(false);
    }
  };

  const field = (label, control) => (
    <label
      style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 16 }}
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
        {t("events.admin.title")}
      </h1>
      <BodyText muted>{t("events.admin.intro")}</BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {events === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : (
        events.map((ev) =>
          editing === ev.id ? null : (
            <Card key={ev.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <BodyText style={{ fontWeight: 700, margin: 0, flex: "1 1 200px" }}>
                  {ev.title}
                </BodyText>
                {ev.is_published ? (
                  <Pill tone="green">✓ {t("events.admin.publishedPill")}</Pill>
                ) : (
                  <Pill tone="brown">✎ {t("events.admin.draftPill")}</Pill>
                )}
                <Pill>
                  {(counts[ev.id] ?? 0) === 1
                    ? t("events.admin.goingOne")
                    : t("events.admin.goingMany", { n: counts[ev.id] ?? 0 })}
                </Pill>
              </div>
              <BodyText muted style={{ margin: "6px 0 12px", fontSize: ts(18) }}>
                📅 {ev.dateLabel}
                {ev.timeLabel ? ` · ${ev.timeLabel}` : ""}
                {ev.venue ? ` · ${ev.venue}` : ""}
                {ev.capacity != null ? ` · ${ev.capacity} places` : ""}
              </BodyText>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <GhostBtn
                  onClick={() => {
                    setForm(toForm(ev));
                    setEditing(ev.id);
                    setDoorFor(null);
                  }}
                >
                  {t("events.admin.editCta")}
                </GhostBtn>
                <GhostBtn onClick={() => setDoorFor(doorFor === ev.id ? null : ev.id)}>
                  {t("events.admin.attendeesCta")}
                </GhostBtn>
              </div>
              {doorFor === ev.id && (
                <div style={{ marginTop: 12 }}>
                  <DoorList eventId={ev.id} />
                </div>
              )}
            </Card>
          )
        )
      )}

      {editing ? (
        <Card>
          <form onSubmit={save}>
            {field(
              t("events.admin.fields.title"),
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={inputStyle(ts)}
              />
            )}
            {field(
              t("events.admin.fields.description"),
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ ...inputStyle(ts), resize: "vertical" }}
              />
            )}
            {field(
              t("events.admin.fields.venue"),
              <input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                style={inputStyle(ts)}
              />
            )}
            {field(
              t("events.admin.fields.city"),
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                style={inputStyle(ts)}
              />
            )}
            {field(
              t("events.admin.fields.date"),
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                style={inputStyle(ts)}
              />
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px" }}>
                {field(
                  t("events.admin.fields.start"),
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    style={inputStyle(ts)}
                  />
                )}
              </div>
              <div style={{ flex: "1 1 160px" }}>
                {field(
                  t("events.admin.fields.end"),
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    style={inputStyle(ts)}
                  />
                )}
              </div>
            </div>
            {field(
              t("events.admin.fields.capacity"),
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                style={inputStyle(ts)}
              />
            )}
            <button
              type="button"
              role="checkbox"
              aria-checked={form.is_published}
              onClick={() => setForm({ ...form, is_published: !form.is_published })}
              style={{
                minHeight: A11Y.minTapTargetPx,
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 14,
                border: `2px solid ${form.is_published ? C.green : C.warmGray}`,
                background: form.is_published ? "#eef3ea" : C.white,
                fontSize: ts(18),
                fontWeight: 600,
                fontFamily: "inherit",
                color: C.textMain,
                cursor: "pointer",
                textAlign: "start",
                marginBottom: 18,
              }}
            >
              <span aria-hidden="true" style={{ color: form.is_published ? C.green : C.textMuted, fontWeight: 700 }}>
                {form.is_published ? "✓" : "○"}
              </span>
              {t("events.admin.fields.published")}
            </button>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryBtn type="submit" disabled={busy}>
                {t("events.admin.saveCta")}
              </PrimaryBtn>
              <GhostBtn onClick={() => setEditing(null)}>{t("events.admin.cancelCta")}</GhostBtn>
            </div>
          </form>
        </Card>
      ) : (
        <PrimaryBtn
          onClick={() => {
            setForm(BLANK);
            setEditing("new");
          }}
          style={{ marginTop: 8 }}
        >
          {t("events.admin.newCta")}
        </PrimaryBtn>
      )}
    </>
  );
}
