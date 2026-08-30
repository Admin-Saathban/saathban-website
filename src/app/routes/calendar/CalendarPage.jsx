/* ════════════════════════════════════════════════
   The calendar — PRODUCT_DECISIONS §13. For every role.

   One chronological list, not a month grid: a list reads at any text
   size and never hides a date inside a cell. That decision predates
   this file and it was right; what §13 adds is that every entry now
   offers the ACTION THAT FITS IT, at its time.

   Sources, merged into one stream:
     · Saathban events you said yes to
     · outings and "who's up for…?" you are part of  (§12's happenings)
     · your own entries — appointments, visits, birthdays, notes
     · one-off reminders

   Medication times are excluded on purpose (§13): they recur daily
   and would bury everything that makes a day different.

   Fam and Buddies get their own calendar, holding what is relevant to
   them — the filtering is in entryActions.kindsForRole, and the
   database is the real boundary underneath it: calendar_entries are
   owner-only, so a Buddy could not read an Icon's notes even if this
   screen tried to show them.

   §0.6 — a day with nothing in it is absent, not an empty box. An
   empty calendar is a door: one line and one button to add something.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import supabase from "../../lib/supabase.js";
import { fetchMyRsvps, nextOccurrence, localIsoDate } from "../events/eventsStore.js";
import { actionsFor, kindsForRole, KIND_ICON } from "./entryActions.js";
import AddEntry from "./AddEntry.jsx";

const DAY_MS = 86400000;

function dayLabel(d, lang) {
  return d.toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function timeLabel(d, lang) {
  return d.toLocaleTimeString(lang === "ur" ? "ur-PK" : "en-GB", { hour: "numeric", minute: "2-digit" });
}

/* "Today", "Tomorrow", then the date — because those two are what a
   person is actually asking when they open a calendar. */
function whenHeading(date, t, lang) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / DAY_MS);
  if (diff === 0) return t("calendar.today");
  if (diff === 1) return t("calendar.tomorrow");
  return dayLabel(d, lang);
}

export default function CalendarPage() {
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const role = profile?.role;

  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const allowed = new Set(kindsForRole(role));
    const out = [];

    /* Events I said yes to. */
    if (allowed.has("event")) {
      const rsvps = await fetchMyRsvps().catch(() => []);
      for (const e of rsvps) {
        if (!e.when) continue;
        out.push({ id: `e:${e.id}`, kind: "event", title: e.title, when: e.when, refId: e.id, where: e.venue });
      }
    }

    /* Happenings I am part of — the outings §12 already models. */
    if (allowed.has("outing")) {
      const { data: outings } = await supabase
        .from("outdoor_outings")
        .select("id, starts_at, note, place_id")
        .is("canceled_at", null)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(50);
      for (const o of outings || []) {
        out.push({
          id: `o:${o.id}`,
          kind: "outing",
          title: o.note || t("calendar.kind.outing"),
          when: new Date(o.starts_at),
          refId: o.id,
        });
      }
    }

    /* My own entries. Owner-only at the database.

       Read directly rather than through the events lane's
       fetchCalendarEntries: that helper predates 0061 and does not
       select person_id, so "message her" had nobody to message and
       the birthday lost its first action. The symptom was an entry
       that rendered perfectly and simply offered less than it should
       — which is why this is checked in the browser and not only in
       the pure module, where personId was always supplied. */
    const { data: entryRows } = await supabase
      .from("calendar_entries")
      .select("id, kind, title, entry_date, entry_time, repeats_yearly, person_id")
      .order("entry_date", { ascending: true });
    const entries = entryRows || [];
    const people = [...new Set(entries.map((e) => e.person_id).filter(Boolean))];
    let names = {};
    if (people.length) {
      const { data } = await supabase.from("safe_profiles").select("id, full_name").in("id", people);
      names = Object.fromEntries((data || []).map((p) => [p.id, p.full_name]));
    }
    for (const e of entries) {
      if (!allowed.has(e.kind)) continue;
      const date = e.repeats_yearly ? nextOccurrence(e) : new Date(`${e.entry_date}T${e.entry_time || "00:00:00"}`);
      if (!date || Number.isNaN(date.getTime())) continue;
      out.push({
        id: `c:${e.id}`,
        kind: e.kind,
        title: e.title,
        when: date,
        allDay: !e.entry_time,
        personId: e.person_id || null,
        personName: names[e.person_id] || null,
      });
    }

    /* Today onwards, in time order. A calendar that opens on last
       month's doctor's appointment is answering a question nobody
       asked. */
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return out.filter((r) => r.when >= from).sort((a, b) => a.when - b.when);
  }, [role, t]);

  useEffect(() => {
    let alive = true;
    load()
      .then((r) => alive && setRows(r))
      .catch(() => alive && (setRows([]), setFailed(true)));
    return () => { alive = false; };
  }, [load]);

  /* Grouped by day so the heading is said once, not on every row. */
  const days = useMemo(() => {
    const m = new Map();
    for (const r of rows || []) {
      const key = localIsoDate(r.when);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    }
    return [...m.entries()];
  }, [rows]);

  const refresh = () => load().then(setRows).catch(() => {});

  return (
    <>
      <AppHeader />
      <main
        style={{
          minHeight: "100vh",
          background: C.bg,
          fontFamily: meta.fonts.body,
          padding: "18px 16px 60px",
        }}
      >
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(28),
              fontWeight: 800,
              color: C.brown,
              lineHeight: meta.dir === "rtl" ? meta.lineHeight : 1.25,
              margin: "0 0 14px",
            }}
          >
            {t("calendar.title")}
          </h1>

          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            aria-expanded={adding}
            style={{
              width: "100%",
              minHeight: A11Y.minTapTargetPx,
              marginBottom: 18,
              borderRadius: 50,
              border: `2px solid ${C.green}`,
              background: C.white,
              color: C.green,
              fontFamily: "inherit",
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ＋ {t("calendar.add")}
          </button>

          {adding && (
            <AddEntry
              onClose={() => setAdding(false)}
              onAdded={async () => { setAdding(false); await refresh(); }}
            />
          )}

          {rows === null && <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>…</p>}

          {rows !== null && rows.length === 0 && (
            <div
              style={{
                background: C.white,
                border: `1px solid ${C.warmGray}`,
                borderRadius: 18,
                padding: "18px 20px",
              }}
            >
              <p style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "0 0 8px" }}>
                {failed ? t("calendar.failed") : t("calendar.emptyTitle")}
              </p>
              {!failed && (
                <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0 }}>
                  {t("calendar.emptyBody")}
                </p>
              )}
            </div>
          )}

          {days.map(([key, list]) => (
            <section key={key} style={{ marginBottom: 22 }}>
              <h2
                style={{
                  fontFamily: meta.fonts.heading,
                  fontSize: ts(20),
                  fontWeight: 700,
                  color: C.green,
                  margin: "0 0 8px",
                }}
              >
                {whenHeading(list[0].when, t, lang)}
              </h2>

              {list.map((r) => {
                const actions = actionsFor(r).filter((a) => a.to);
                return (
                  <div
                    key={r.id}
                    data-testid="calendar-entry"
                    data-kind={r.kind}
                    style={{
                      background: C.white,
                      border: `1px solid ${C.warmGray}`,
                      borderRadius: 18,
                      padding: "14px 16px",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span aria-hidden="true" style={{ fontSize: 24 }}>{KIND_ICON[r.kind] || "📌"}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>
                          {r.title}
                        </span>
                        <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                          {[r.allDay ? null : timeLabel(r.when, lang), r.where, r.personName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </div>

                    {/* §13 — the action that fits, at its time. An entry
                        with nothing useful to offer shows nothing, never
                        a disabled button. */}
                    {actions.length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        {actions.map((a) => (
                          <Link
                            key={a.key}
                            to={a.to}
                            data-action={a.key}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              minHeight: A11Y.minTapTargetPx,
                              padding: "0 18px",
                              borderRadius: 50,
                              border: a.primary ? "none" : `2px solid ${C.warmGray}`,
                              background: a.primary ? C.green : C.white,
                              color: a.primary ? C.white : C.textMain,
                              fontSize: ts(A11Y.minBodyPx),
                              fontWeight: a.primary ? 700 : 600,
                              textDecoration: "none",
                            }}
                          >
                            {t(`calendar.action.${a.key}`, { name: r.personName || "" })}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
