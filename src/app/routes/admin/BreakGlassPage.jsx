/* ════════════════════════════════════════════════
   /app/admin/break-glass/:personId — reading an Icon's private daily
   logs. CLAUDE.md: "Reading an Icon's private logs is break-glass —
   typed reason, logged, for genuine welfare concerns and SOS only."

   NOT IN THE NAVIGATION. Reached only from a person's page (super-admin,
   a Saath-Icon) and from a welfare check-in (super-admin), which adds
   ?from=welfare so the reason starts as a welfare concern.

   THE DATABASE DECIDES (0187), the screen only words it:
     admin_break_glass_prepare  name, their today, their language, the
                                welfare flag, earlier reads. Audited as
                                break_glass_form_opened. Reads no log.
     break_glass_read_logs      super-admin only; reason type + typed
                                reason (20 characters, 60 for "other");
                                a window of at most 30 days that ends by
                                their today. Writes the audit row, then
                                tells the person in their language, then
                                reads — one transaction, so no read
                                happens without the notice.
   Voice notes never arrive: no path, no URL, no transcript. A row only
   says one was recorded.

   NOTHING IS KEPT. The logs live in this component's state and nowhere
   else: no localStorage, no cache (the service worker never touches
   Supabase), no export, no copy button. Leaving the screen unmounts it;
   pagehide clears it too, so a page restored from the back-forward
   cache comes back empty.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { APP_COLORS as C, APP_FONT, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import { Card, AdminBtn, fmtDateTime } from "./ui.jsx";
import { PageTitle, Notice, inputStyle, fmtDay } from "./adminBits.jsx";

const MAX_DAYS = 30;
const REASON_MAX = 1000;
const REASON_TYPES = ["welfare", "sos", "other"];
const minFor = (type) => (type === "other" ? 60 : 20);
const MODULE_ORDER = ["mood", "sleep", "medication", "exercise", "diet", "water", "blood_pressure", "blood_sugar", "weight", "pain", "rest_day", "tracker"];

/* "YYYY-MM-DD" arithmetic in UTC, so a timezone never moves a day. */
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

const HINTS = {
  break_glass_not_icon: "admin.breakGlass.err.notIcon",
  break_glass_reason_type: "admin.breakGlass.err.reasonType",
  break_glass_reason_short: "admin.breakGlass.err.reasonShort",
  break_glass_reason_long: "admin.breakGlass.err.reasonLong",
  break_glass_window_missing: "admin.breakGlass.err.windowMissing",
  break_glass_window_order: "admin.breakGlass.err.windowOrder",
  break_glass_window_long: "admin.breakGlass.err.windowLong",
  break_glass_window_future: "admin.breakGlass.err.windowFuture",
  break_glass_flag_type: "admin.breakGlass.err.flagType",
  break_glass_not_flagged: "admin.breakGlass.err.notFlagged",
  break_glass_not_told: "admin.breakGlass.err.notTold",
};
const errKey = (e, fallback) =>
  HINTS[e?.hint] || (e?.code === "42501" || /super-admins|not allowed|permission denied/i.test(e?.message || "") ? "admin.breakGlass.err.notAllowed" : fallback);

export default function BreakGlassPage() {
  const { personId } = useParams();
  const [params] = useSearchParams();
  const fromWelfare = params.get("from") === "welfare";
  const { t, meta } = useI18n();
  const lh = meta.dir === "rtl" ? 1.9 : 1.6;

  const [prep, setPrep] = useState(null);
  const [openMsg, setOpenMsg] = useState(null);
  const [result, setResult] = useState(null);
  const [cleared, setCleared] = useState(false);

  const openedOnce = useRef(false);
  const open = useCallback(async () => {
    setOpenMsg(null);
    const { data, error } = await supabase.rpc("admin_break_glass_prepare", { p_icon: personId });
    if (error) {
      setOpenMsg({ kind: "err", text: t(errKey(error, "admin.breakGlass.openFailed")) });
      return;
    }
    setPrep(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);
  useEffect(() => {
    /* Once per visit: the ref holds across StrictMode's rehearsal remount,
       so development does not write two "form opened" entries. */
    if (openedOnce.current) return;
    openedOnce.current = true;
    open();
  }, [open]);

  /* Cleared on leaving: unmount drops the state; pagehide drops it before
     the browser can keep the page in its back-forward cache. */
  useEffect(() => {
    const clear = () => setResult(null);
    window.addEventListener("pagehide", clear);
    return () => {
      window.removeEventListener("pagehide", clear);
      setResult(null);
    };
  }, []);

  const back = (
    <Link
      to={fromWelfare ? "/app/admin/welfare" : `/app/admin/people/${personId}`}
      style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, color: C.green, fontWeight: 700 }}
    >
      {t(fromWelfare ? "admin.breakGlass.backWelfare" : "admin.breakGlass.backPerson")}
    </Link>
  );

  if (!prep) {
    return (
      <div style={{ maxWidth: 820 }} data-admin-desk="break-glass">
        {back}
        <PageTitle title={t("admin.breakGlass.titleGeneric")} />
        {openMsg ? (
          <>
            <Notice msg={openMsg} />
            <AdminBtn onClick={open}>{t("admin.tryAgain")}</AdminBtn>
          </>
        ) : (
          <p role="status" style={{ color: C.textMuted }}>{t("admin.breakGlass.opening")}</p>
        )}
      </div>
    );
  }

  const name = prep.name || t("admin.people.unnamed");

  return (
    <div style={{ maxWidth: 820, lineHeight: lh }} data-admin-desk="break-glass">
      {back}
      <PageTitle title={t("admin.breakGlass.title", { name })} />

      {result ? (
        <Reading
          result={result}
          name={name}
          onClear={() => {
            setResult(null);
            setCleared(true);
          }}
        />
      ) : (
        <>
          {cleared && <Notice msg={{ kind: "ok", text: t("admin.breakGlass.cleared") }} />}
          <Warning prep={prep} name={name} />
          <ReadForm
            prep={prep}
            name={name}
            fromWelfare={fromWelfare}
            onRead={(data) => {
              setCleared(false);
              setResult(data);
            }}
          />
        </>
      )}
    </div>
  );
}

function Warning({ prep, name }) {
  const { t } = useI18n();
  const lang = prep.told_in === "ur" ? t("admin.breakGlass.langUr") : t("admin.breakGlass.langEn");
  return (
    <section
      data-break-glass-warning
      style={{ border: `3px solid ${C.brown}`, borderRadius: 14, background: C.white, padding: "16px 20px", marginBottom: 20 }}
    >
      <h2 style={{ fontFamily: APP_FONT, fontSize: 22, fontWeight: 700, color: C.brown, margin: "0 0 8px" }}>
        ⚠ {t("admin.breakGlass.warnTitle")}
      </h2>
      <p style={{ margin: "0 0 10px", fontSize: 18 }}>{t("admin.breakGlass.warnWhat")}</p>
      <ul style={{ margin: 0, paddingInlineStart: 22, display: "grid", gap: 6, fontSize: 18 }}>
        <li>
          <strong>{t("admin.breakGlass.warnTold", { name, language: lang })}</strong>
        </li>
        <li>{t("admin.breakGlass.warnRecord")}</li>
        <li>{t("admin.breakGlass.warnVoice")}</li>
        <li>{t("admin.breakGlass.warnNothingKept")}</li>
      </ul>
      <p style={{ margin: "12px 0 0", color: C.textMuted, fontSize: 16 }} data-break-glass-previous>
        {prep.previous_reads > 0
          ? t(prep.previous_reads === 1 ? "admin.breakGlass.previousOne" : "admin.breakGlass.previousMany", {
              n: prep.previous_reads,
              date: fmtDateTime(prep.last_read_at),
            })
          : t("admin.breakGlass.previousNone")}
      </p>
    </section>
  );
}

function ReadForm({ prep, name, fromWelfare, onRead }) {
  const { t, meta } = useI18n();
  const lh = meta.dir === "rtl" ? 1.9 : 1.55;
  const today = prep.today;
  const listed = Boolean(prep.welfare);

  const [type, setType] = useState(fromWelfare ? "welfare" : null);
  const [linkFlag, setLinkFlag] = useState(fromWelfare && listed);
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  /* A refusal from a previous tap goes as soon as anything changes. */
  useEffect(() => {
    setMsg(null);
  }, [type, reason, from, to, understood, linkFlag]);

  const trimmed = reason.trim();
  const need = minFor(type);
  const days = from && to ? daysBetween(from, to) : 0;

  const problem = useMemo(() => {
    if (!type) return "admin.breakGlass.err.reasonType";
    if (trimmed.length < need) return "admin.breakGlass.err.reasonShort";
    if (!from || !to) return "admin.breakGlass.err.windowMissing";
    if (to < from) return "admin.breakGlass.err.windowOrder";
    if (days > MAX_DAYS) return "admin.breakGlass.err.windowLong";
    if (to > today) return "admin.breakGlass.err.windowFuture";
    if (!understood) return "admin.breakGlass.err.understand";
    return null;
  }, [type, trimmed, need, from, to, days, today, understood]);

  const submit = async () => {
    if (problem) {
      setMsg({ kind: "err", text: t(problem, { n: need, max: MAX_DAYS, date: fmtDay(today), name }) });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("break_glass_read_logs", {
      p_icon: prep.icon_id,
      p_reason_type: type,
      p_reason: trimmed,
      p_from: from,
      p_to: to,
      p_welfare_flag: type === "welfare" && listed && linkFlag,
    });
    setBusy(false);
    if (error) {
      setMsg({ kind: "err", text: t(errKey(error, "admin.breakGlass.err.failed"), { n: need, max: MAX_DAYS, date: fmtDay(today), name }) });
      return;
    }
    setReason("");
    setUnderstood(false);
    onRead(data);
  };

  const label = { display: "block", fontWeight: 700, fontSize: 17, marginBottom: 6 };

  return (
    <Card>
      <div data-break-glass-form style={{ display: "grid", gap: 20 }}>
        <div role="radiogroup" aria-label={t("admin.breakGlass.typeLabel")} style={{ display: "grid", gap: 8 }}>
          <span style={label}>{t("admin.breakGlass.typeLabel")}</span>
          {REASON_TYPES.map((k) => {
            const on = type === k;
            return (
              <label
                key={k}
                data-break-glass-type={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minHeight: A11Y.minTapTargetPx,
                  padding: "6px 14px",
                  borderRadius: 10,
                  border: on ? `2.5px solid ${C.green}` : `1px solid ${C.warmGray}`,
                  background: on ? C.selected : C.white,
                  cursor: "pointer",
                  fontWeight: on ? 800 : 600,
                  lineHeight: lh,
                }}
              >
                <input
                  type="radio"
                  name="break-glass-type"
                  value={k}
                  checked={on}
                  onChange={() => setType(k)}
                  style={{ width: 24, height: 24, margin: 0, accentColor: C.green, flex: "0 0 auto" }}
                />
                <span>
                  {t(`admin.breakGlass.reasonType.${k}`)}
                  <span style={{ display: "block", fontWeight: 400, fontSize: 16, color: C.textMuted }}>
                    {t(`admin.breakGlass.typeHint.${k}`)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {listed && type === "welfare" && (
          <label
            data-break-glass-flag
            style={{ display: "flex", alignItems: "center", gap: 12, minHeight: A11Y.minTapTargetPx, cursor: "pointer", lineHeight: lh }}
          >
            <input
              type="checkbox"
              checked={linkFlag}
              onChange={(e) => setLinkFlag(e.target.checked)}
              style={{ width: 24, height: 24, margin: 0, accentColor: C.green, flex: "0 0 auto" }}
            />
            <span>
              {t(prep.welfare.low_days === 1 ? "admin.breakGlass.linkFlagOne" : "admin.breakGlass.linkFlagMany", {
                n: prep.welfare.low_days,
                date: fmtDay(prep.welfare.since),
              })}
            </span>
          </label>
        )}
        {!listed && type === "welfare" && (
          <p style={{ margin: "-8px 0 0", color: C.textMuted, fontSize: 16 }}>{t("admin.breakGlass.notListed")}</p>
        )}

        <label style={{ display: "block" }}>
          <span style={label}>{t("admin.breakGlass.reasonLabel")}</span>
          <span style={{ display: "block", color: C.textMuted, fontSize: 16, marginBottom: 6 }}>
            {t("admin.breakGlass.reasonHint", { name, n: need })}
          </span>
          <textarea
            value={reason}
            maxLength={REASON_MAX}
            rows={4}
            onChange={(e) => setReason(e.target.value)}
            data-break-glass-reason
            style={{ ...inputStyle, padding: "10px 14px", minHeight: 120, resize: "vertical", lineHeight: lh }}
          />
          <span style={{ display: "block", color: trimmed.length >= need ? C.green : C.textMuted, fontSize: 15, marginTop: 4, fontWeight: 700 }}>
            {trimmed.length >= need ? "✓ " : ""}
            {t("admin.breakGlass.reasonCount", { n: trimmed.length, min: need })}
          </span>
        </label>

        <fieldset style={{ border: `1px solid ${C.warmGray}`, borderRadius: 12, padding: "10px 16px 14px", margin: 0, minWidth: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 17, padding: "0 6px" }}>{t("admin.breakGlass.windowLabel")}</legend>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
            <label>
              <span style={{ display: "block", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t("admin.breakGlass.fromLabel")}</span>
              <input
                type="date"
                value={from}
                min={to ? addDays(to, -(MAX_DAYS - 1)) : undefined}
                max={to || today}
                onChange={(e) => setFrom(e.target.value)}
                data-break-glass-from
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ display: "block", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t("admin.breakGlass.toLabel")}</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                data-break-glass-to
                style={inputStyle}
              />
            </label>
          </div>
          <p role="status" style={{ margin: "10px 0 0", fontSize: 16, color: days > MAX_DAYS || days < 1 ? C.brown : C.textMuted, fontWeight: 700 }}>
            {days >= 1 ? t(days === 1 ? "admin.breakGlass.daysOne" : "admin.breakGlass.daysMany", { n: days }) : "—"}
            {" · "}
            {t("admin.breakGlass.windowRule", { max: MAX_DAYS, date: fmtDay(today) })}
          </p>
        </fieldset>

        <label
          data-break-glass-understand
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight: A11Y.minTapTargetPx,
            padding: "6px 14px",
            borderRadius: 10,
            border: `2px solid ${understood ? C.green : C.warmGray}`,
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: lh,
          }}
        >
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            style={{ width: 24, height: 24, margin: 0, accentColor: C.green, flex: "0 0 auto" }}
          />
          <span>{t("admin.breakGlass.understand", { name })}</span>
        </label>

        <div>
          <Notice msg={msg} />
          <AdminBtn kind="danger" onClick={submit} disabled={busy}>
            {busy ? t("admin.breakGlass.reading") : t("admin.breakGlass.read", { name })}
          </AdminBtn>
        </div>
      </div>
    </Card>
  );
}

/* ── The logs, read-only ── */

function Reading({ result, name, onClear }) {
  const { t, meta } = useI18n();
  const lh = meta.dir === "rtl" ? 1.9 : 1.55;
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const r of result.rows || []) {
      if (!map.has(r.log_date)) map.set(r.log_date, []);
      map.get(r.log_date).push(r);
    }
    for (const list of map.values()) list.sort((a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module));
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [result]);

  const w = result.window || {};
  const n = (result.rows || []).length;

  return (
    <div data-break-glass-reading>
      <section
        style={{ border: `2px solid ${C.green}`, background: C.selected, borderRadius: 12, padding: "14px 18px", marginBottom: 18 }}
      >
        <h2 ref={headingRef} tabIndex={-1} style={{ fontSize: 21, fontWeight: 800, color: C.green, margin: "0 0 6px", outline: "none", lineHeight: lh }}>
          {t(w.from === w.to ? "admin.breakGlass.readingOneDay" : "admin.breakGlass.readingRange", {
            name,
            from: fmtDay(w.from),
            to: fmtDay(w.to),
          })}
        </h2>
        <p style={{ margin: 0, fontSize: 18 }} data-break-glass-told>
          ✓ {t("admin.breakGlass.told", { name })}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 16, color: C.textMuted }}>
          {t(n === 1 ? "admin.breakGlass.entriesOne" : "admin.breakGlass.entriesMany", { n })}
          {result.voice_notes_withheld > 0 ? ` · ${t("admin.breakGlass.voiceWithheld", { n: result.voice_notes_withheld })}` : ""}
        </p>
        <div style={{ marginTop: 12 }}>
          <AdminBtn kind="primary" onClick={onClear}>
            {t("admin.breakGlass.clear")}
          </AdminBtn>
        </div>
      </section>

      {byDay.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t("admin.breakGlass.nothing")}</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {byDay.map(([day, rows]) => (
            <Card key={day} title={fmtDay(day)}>
              <dl style={{ margin: 0, display: "grid", gap: 14 }} data-break-glass-day={day}>
                {rows.map((r) => (
                  <div key={r.module} data-break-glass-module={r.module} style={{ borderInlineStart: `4px solid ${C.warmGray}`, paddingInlineStart: 12 }}>
                    <dt style={{ fontSize: 16, fontWeight: 800, color: C.textMuted, lineHeight: lh }}>
                      {t(`admin.breakGlass.module.${r.module}`) !== `admin.breakGlass.module.${r.module}` ? t(`admin.breakGlass.module.${r.module}`) : r.module}
                      {r.is_backfilled ? ` · ${t("admin.breakGlass.backfilled")}` : ""}
                    </dt>
                    <dd style={{ margin: 0, fontSize: 18, lineHeight: lh, overflowWrap: "anywhere" }}>
                      <ModuleValue row={r} names={result.names || {}} />
                      {r.voice_note_recorded && (
                        <span data-break-glass-voice style={{ display: "block", color: C.textMuted, fontStyle: "italic" }}>
                          🎙 {t("admin.breakGlass.voiceRecorded")}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function useTr() {
  const { t } = useI18n();
  return (key, fallback) => {
    const s = t(key);
    return s && s !== key ? s : fallback;
  };
}

const nameIn = (list, id) => {
  const hit = (Array.isArray(list) ? list : []).find((x) => x && x.id === id);
  return hit ? hit.name || hit.label || hit.title || null : null;
};

function Line({ children }) {
  return <span style={{ display: "block" }}>{children}</span>;
}

function Note({ text }) {
  const { t } = useI18n();
  const s = String(text || "").trim();
  if (!s) return null;
  return (
    <span style={{ display: "block", whiteSpace: "pre-wrap" }}>
      <strong>{t("admin.breakGlass.noteLabel")}:</strong> “{s}”
    </span>
  );
}

function ModuleValue({ row, names }) {
  const { t } = useI18n();
  const tr = useTr();
  const v = row.payload && typeof row.payload === "object" ? row.payload : {};
  const shown = new Set();
  const out = [];
  const take = (...keys) => keys.forEach((k) => shown.add(k));

  switch (row.module) {
    case "mood": {
      const ids = Array.isArray(v.choices) && v.choices.length ? v.choices : v.choice ? [v.choice] : [];
      take("choices", "choice", "note");
      if (ids.length) out.push(<Line key="m">{ids.map((id) => tr(`home.moods.${id}`, id)).join(" + ")}</Line>);
      if (row.mood_value) out.push(<Line key="mv">{t("admin.breakGlass.moodValue", { n: row.mood_value })}</Line>);
      out.push(<Note key="n" text={v.note} />);
      break;
    }
    case "sleep":
      take("hours", "quality");
      if (v.hours != null) out.push(<Line key="h">{t("admin.breakGlass.sleepHours", { n: v.hours })}</Line>);
      if (v.quality) out.push(<Line key="q">{tr(`home.sleepQuality.${v.quality}`, v.quality)}</Line>);
      break;
    case "medication": {
      take("taken");
      const taken = Array.isArray(v.taken) ? v.taken : [];
      out.push(
        <Line key="t">
          {taken.length
            ? `${t("admin.breakGlass.medsTaken")}: ${taken.map((id) => nameIn(names.medications, id) || t("admin.breakGlass.medGone")).join(", ")}`
            : t("admin.breakGlass.medsNone")}
        </Line>
      );
      break;
    }
    case "exercise": {
      take("activity", "type", "minutes", "note");
      const rec = v.activity && typeof v.activity === "object" ? v.activity : v.type ? { key: v.type } : null;
      const nm = rec ? (rec.key && tr(`home.exercise.${rec.key}`, null)) || rec.name || rec.key || nameIn(names.movement_options, rec.id) : null;
      if (nm) out.push(<Line key="a">{nm}</Line>);
      if (v.minutes) out.push(<Line key="min">{t("admin.breakGlass.minutes", { n: v.minutes })}</Line>);
      out.push(<Note key="n" text={v.note} />);
      break;
    }
    case "diet": {
      take("answers", "entries", "labels", "meals");
      if (v.answers && typeof v.answers === "object") {
        for (const [id, a] of Object.entries(v.answers)) {
          if (!a || typeof a.had !== "boolean") continue;
          const nm = (a.key && tr(`home.log.slots.${a.key}`, null)) || a.name || tr(`home.log.slots.${id}`, null) || nameIn(names.meal_categories, id) || id;
          out.push(<Line key={`a-${id}`}>{`${nm}: ${t(a.had ? "admin.breakGlass.yes" : "admin.breakGlass.no")}`}</Line>);
        }
      }
      if (v.entries && typeof v.entries === "object") {
        for (const [slot, ids] of Object.entries(v.entries)) {
          if (!Array.isArray(ids) || !ids.length) continue;
          const items = ids.map((id) => (v.labels && v.labels[id]) || nameIn(names.meal_items, id) || tr(`home.log.slots.${id}`, id));
          out.push(<Line key={`e-${slot}`}>{`${tr(`home.log.slots.${slot}`, slot)}: ${items.join(", ")}`}</Line>);
        }
      }
      if (Array.isArray(v.meals) && v.meals.length && !v.entries) {
        out.push(<Line key="meals">{v.meals.map((id) => (v.labels && v.labels[id]) || nameIn(names.meal_items, id) || id).join(", ")}</Line>);
      }
      break;
    }
    case "water":
      take("ml", "glasses");
      if (v.ml != null) out.push(<Line key="ml">{t("admin.breakGlass.waterMl", { n: v.ml })}</Line>);
      else if (v.glasses != null) out.push(<Line key="g">{t("admin.breakGlass.waterGlasses", { n: v.glasses })}</Line>);
      break;
    case "rest_day":
      out.push(<Line key="r">{t("admin.breakGlass.restDay")}</Line>);
      take("note");
      out.push(<Note key="n" text={v.note} />);
      break;
    case "tracker": {
      take("done", "entries");
      const entries = v.entries && typeof v.entries === "object" ? v.entries : {};
      for (const [key, e] of Object.entries(entries)) {
        const id = key.replace(/^tracker:/, "");
        const tracker = (Array.isArray(names.trackers) ? names.trackers : []).find((x) => x && x.id === id);
        const nm = (tracker && (tracker.name || tracker.label)) || t("admin.breakGlass.trackerGone");
        const bits = [];
        if (e && typeof e === "object") {
          if (typeof e.done === "boolean") bits.push(t(e.done ? "admin.breakGlass.yes" : "admin.breakGlass.no"));
          if (e.count != null) bits.push(String(e.count));
          if (e.note && String(e.note).trim()) bits.push(`“${String(e.note).trim()}”`);
        }
        out.push(<Line key={key}>{`${nm}: ${bits.join(" · ") || "—"}`}</Line>);
      }
      break;
    }
    default:
  }

  /* Whatever else the row holds, in plain words — blood pressure, sugar,
     weight, pain and anything newer have no special layout yet. */
  const rest = flatten(v).filter(([k]) => !shown.has(k.split(".")[0]));
  for (const [k, val] of rest) {
    out.push(<Line key={`x-${k}`}>{`${k.replace(/[._]/g, " ")}: ${val}`}</Line>);
  }
  if (!out.filter(Boolean).length) out.push(<Line key="empty">{t("admin.breakGlass.nothingInRow")}</Line>);
  return <>{out}</>;
}

function flatten(obj, prefix = "", depth = 0) {
  const out = [];
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      const prim = v.filter((x) => x !== null && typeof x !== "object");
      if (prim.length) out.push([key, prim.join(", ")]);
    } else if (typeof v === "object") {
      if (depth < 2) out.push(...flatten(v, key, depth + 1));
    } else out.push([key, typeof v === "boolean" ? (v ? "✓" : "✗") : String(v)]);
  }
  return out;
}
