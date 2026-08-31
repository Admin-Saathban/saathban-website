/* ════════════════════════════════════════════════
   Putting something in the calendar — PRODUCT_DECISIONS §13.

   The kind is chosen FIRST and in plain words, because the kind is
   what decides the action the entry will offer later. "A visit" and
   "an appointment" are different questions to a person and different
   answers from the app, so asking which one up front is not a form
   field — it is the whole point.

   Choosing "a visit" then asks who, because §13's action for it is
   "message her" and that needs a name. Nothing else asks for a person.

   §11 — saving lands back on the calendar with the new entry in it,
   not on a toast.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import supabase from "../../lib/supabase.js";

const KINDS = ["appointment", "visiting", "birthday", "custom_reminder", "personal"];

export default function AddEntry({ onClose, onAdded }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();

  const [kind, setKind] = useState("appointment");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  /* TONIGHT §3.5 — "a single entry must be able to hold several times".
     A list, not a field: drops at 8, 2 and 8 is ONE thing that happens
     three times, and making somebody write it three times is how a
     calendar stops being worth keeping. */
  const [times, setTimes] = useState([""]);
  const [repeat, setRepeat] = useState("");     // "" = just once
  const [repeatDays, setRepeatDays] = useState([]);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [personId, setPersonId] = useState("");
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* Only fetched when the kind actually needs a person — a list of
     names loaded for an appointment is a query nobody asked for. */
  useEffect(() => {
    if (kind !== "visiting" && kind !== "birthday") return undefined;
    let alive = true;
    supabase
      .from("safe_profiles")
      .select("id, full_name")
      .limit(50)
      .then(({ data }) => alive && setPeople(data || []));
    return () => { alive = false; };
  }, [kind]);

  const field = {
    width: "100%",
    minHeight: A11Y.minTapTargetPx,
    padding: "10px 14px",
    fontFamily: "inherit",
    fontSize: ts(A11Y.minBodyPx),
    color: C.textMain,
    background: C.white,
    border: `2px solid ${C.warmGray}`,
    borderRadius: 14,
    marginBottom: 12,
    textAlign: "start",
  };

  const save = async () => {
    if (!title.trim() || !date) {
      setError(t("calendar.needTitleAndDay"));
      return;
    }
    /* A custom pattern with no days chosen would repeat on nothing —
       ask rather than save something that will never appear. */
    if (repeat === "custom" && repeatDays.length === 0) {
      setError(t("calendar.needDays"));
      return;
    }
    setBusy(true);
    setError("");
    const chosen = times.map((x) => x.trim()).filter(Boolean).sort();
    const { error: e } = await supabase.from("calendar_entries").insert({
      owner_id: profile.id,
      kind,
      title: title.trim(),
      entry_date: date,
      /* entry_time stays the FIRST of the times: everything written
         before tonight reads that column, and 0075 keeps the two in
         step rather than taking the old one away. */
      entry_time: chosen[0] || null,
      entry_times: chosen.length ? chosen : null,
      repeat_rule: kind === "birthday" ? "yearly" : repeat || null,
      repeat_days: repeat === "custom" ? repeatDays.slice().sort((a, b) => a - b) : null,
      repeat_until: repeat && repeatUntil ? repeatUntil : null,
      repeats_yearly: kind === "birthday",
      person_id: personId || null,
    });
    if (e) {
      setError(t("calendar.saveFailed"));
      setBusy(false);
      return;
    }
    onAdded?.();
  };

  return (
    <div
      style={{
        background: C.white,
        border: `2px solid ${C.green}`,
        borderRadius: 18,
        padding: "16px 18px",
        marginBottom: 18,
      }}
    >
      <h2
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(20),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 12px",
        }}
      >
        {t("calendar.addTitle")}
      </h2>

      {/* The kind, in plain words, first. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            style={{
              minHeight: A11Y.minTapTargetPx,
              padding: "0 16px",
              borderRadius: 50,
              border: kind === k ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
              background: kind === k ? "#EEF3E8" : C.white,
              color: kind === k ? C.green : C.textMain,
              fontFamily: "inherit",
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: kind === k ? 700 : 600,
              cursor: "pointer",
            }}
          >
            {t(`calendar.kind.${k}`)}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("calendar.whatPlaceholder")}
        dir={meta.dir}
        style={field}
      />

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={field} />

      {/* Times: one row each, add another when there is another. */}
      {times.map((tm, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <input
            type="time"
            value={tm}
            onChange={(e) => setTimes((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
            aria-label={t("calendar.timeNth", { n: i + 1 })}
            style={{ ...field, marginBottom: 0, flex: 1 }}
          />
          {times.length > 1 && (
            <button
              type="button"
              onClick={() => setTimes((cur) => cur.filter((_, j) => j !== i))}
              aria-label={t("calendar.removeTime")}
              style={{
                minWidth: A11Y.minTapTargetPx, minHeight: A11Y.minTapTargetPx,
                borderRadius: 50, border: `2px solid ${C.warmGray}`, background: C.white,
                color: C.textMain, fontSize: ts(20), cursor: "pointer",
              }}
            >
              <span aria-hidden="true">−</span>
            </button>
          )}
        </div>
      ))}
      {times.length < 8 && (
        <button
          type="button"
          onClick={() => setTimes((cur) => [...cur, ""])}
          style={{
            minHeight: A11Y.minTapTargetPx, padding: "0 18px", borderRadius: 50,
            border: `2px dashed ${C.warmGray}`, background: "transparent", color: C.textMain,
            fontFamily: "inherit", fontSize: ts(A11Y.minBodyPx), fontWeight: 600,
            cursor: "pointer", marginBottom: 14,
          }}
        >
          + {t("calendar.addTime")}
        </button>
      )}

      {/* How often. "Just once" is first and is what you get by doing
          nothing — the common case must not need a decision. */}
      <p style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 600, margin: "4px 0 8px" }}>
        {t("calendar.repeatLabel")}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {["", "daily", "weekdays", "weekly", "monthly", "custom"].map((r) => (
          <button
            key={r || "once"}
            type="button"
            onClick={() => setRepeat(r)}
            aria-pressed={repeat === r}
            style={{
              minHeight: A11Y.minTapTargetPx,
              padding: "0 16px",
              borderRadius: 50,
              border: repeat === r ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
              background: repeat === r ? "#EEF3E8" : C.white,
              color: repeat === r ? C.green : C.textMain,
              fontFamily: "inherit",
              fontSize: ts(A11Y.minBodyPx),
              fontWeight: repeat === r ? 700 : 600,
              cursor: "pointer",
            }}
          >
            {t(r ? `calendar.repeat.${r}` : "calendar.repeat.once")}
          </button>
        ))}
      </div>

      {repeat === "custom" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const on = repeatDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setRepeatDays((cur) => (on ? cur.filter((x) => x !== d) : [...cur, d]))
                }
                aria-pressed={on}
                style={{
                  minWidth: A11Y.minTapTargetPx,
                  minHeight: A11Y.minTapTargetPx,
                  borderRadius: 50,
                  border: on ? `2.5px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
                  background: on ? "#EEF3E8" : C.white,
                  color: on ? C.green : C.textMain,
                  fontFamily: "inherit",
                  fontSize: ts(16),
                  fontWeight: on ? 800 : 600,
                  cursor: "pointer",
                }}
              >
                {t(`calendar.day.${d}`)}
              </button>
            );
          })}
        </div>
      )}

      {repeat && (
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", fontSize: ts(16), color: C.textMuted, marginBottom: 4 }}>
            {t("calendar.untilLabel")}
          </span>
          <input
            type="date"
            value={repeatUntil}
            onChange={(e) => setRepeatUntil(e.target.value)}
            style={{ ...field, marginBottom: 0 }}
          />
        </label>
      )}

      {(kind === "visiting" || kind === "birthday") && (
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={field}>
          <option value="">{t("calendar.whoPlaceholder")}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      )}

      {error && (
        <p role="alert" style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.brown, margin: "0 0 10px" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          style={{
            flex: "1 1 160px",
            minHeight: A11Y.minTapTargetPx,
            borderRadius: 50,
            border: "none",
            background: C.green,
            color: C.white,
            fontFamily: "inherit",
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {busy ? "…" : t("calendar.save")}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          style={{
            minHeight: A11Y.minTapTargetPx,
            padding: "0 18px",
            borderRadius: 50,
            border: `2px solid ${C.warmGray}`,
            background: C.white,
            color: C.textMain,
            fontFamily: "inherit",
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("calendar.cancel")}
        </button>
      </div>
    </div>
  );
}
