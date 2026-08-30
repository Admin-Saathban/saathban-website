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
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
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
  const [time, setTime] = useState("");
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
    setBusy(true);
    setError("");
    const { error: e } = await supabase.from("calendar_entries").insert({
      owner_id: profile.id,
      kind,
      title: title.trim(),
      entry_date: date,
      entry_time: time || null,
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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, flex: "1 1 150px", width: "auto" }} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...field, flex: "1 1 120px", width: "auto" }} />
      </div>

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
