/* ════════════════════════════════════════════════
   The streak sheets on Today's log — mock screens 2, 3 and 4, and the
   streak's own settings.

   CreateStreakSheet  what kind (a number each day, or just yes or no),
                      then who it goes to — or kept private. Never
                      opened except by a tap on "+ streak".
   SendStreakSheet    from then on, one tap: the chosen people, all
                      pre-ticked, anyone already reached today greyed and
                      locked. If today does not count yet it says so
                      plainly and offers to log. "Change this streak"
                      opens the settings in the same sheet.
   StreakSettings…    rename, change how a day counts (from today — past
                      days keep the rule they were lived under, 0171),
                      change who gets it, and delete it — with a plain
                      confirmation that says what goes and who will no
                      longer see it.
   PeopleSheetBody    the one people list all of them use. Someone who
                      stepped away from this streak (0170) is shown as no
                      longer receiving it and cannot be ticked again.

   AN EMPTY LIST IS NOT A GAP. Somebody with nobody connected can still
   make a streak and keep it; the sheet says that is fine and moves on.
   ════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import {
  rangeSpecFor,
  itemNoun,
  itemTitle,
  isUsualName,
  MODULE_KEYS,
  unitWord,
  tn,
  fmtNum,
  peopleOptions,
  createStreak,
  setStreakPeople,
  sendList,
  sendStreak,
  refreshStreaks,
  renameStreak,
  updateStreak,
  deleteStreak,
  errorKind,
  namesLine,
  valueCounts,
} from "./streaksData.js";
import { Sheet, SheetTitle, Muted, Label, Btn, PersonRow, Stepper, Note, TAP } from "./ui.jsx";

/* ─── The people list: Family, then Friends ─── */
function PeopleList({ people, chosen, onToggle }) {
  const { t } = useI18n();
  const family = people.filter((p) => p.how === "family");
  const friends = people.filter((p) => p.how !== "family");
  const row = (p) => (
    <PersonRow
      key={p.id}
      person={p}
      state={p.stepped_away ? "away" : chosen.has(p.id) ? "on" : "off"}
      sub={p.stepped_away ? t("streaks.settings.steppedAway") : null}
      onToggle={() => onToggle(p.id)}
    />
  );
  return (
    <div>
      {family.length > 0 && (
        <>
          <Label style={{ marginTop: 4 }}>{t("streaks.create.family")}</Label>
          {family.map(row)}
        </>
      )}
      {friends.length > 0 && (
        <>
          <Label>{t("streaks.create.friends")}</Label>
          {friends.map(row)}
        </>
      )}
    </div>
  );
}

/* Who a streak goes to — at creation (streakId null, itemKey given) or to change it. */
function PeopleSheetBody({ streakId, itemKey, noun, onDone, onBack, doneLabel, busyLabel, onSubmit }) {
  const { t } = useI18n();
  const [people, setPeople] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    peopleOptions(streakId, itemKey)
      .then((rows) => {
        if (!alive) return;
        setPeople(rows);
        setChosen(new Set(rows.filter((r) => r.chosen && !r.stepped_away).map((r) => r.id)));
      })
      .catch(() => alive && setPeople([]));
    return () => { alive = false; };
  }, [streakId, itemKey]);

  const away = useMemo(() => new Set((people || []).filter((p) => p.stepped_away).map((p) => p.id)), [people]);
  const toggle = (id) => {
    if (away.has(id)) return;
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSubmit([...chosen].filter((id) => !away.has(id)));
      onDone && onDone();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SheetTitle>{t("streaks.create.whoTitle", { noun })}</SheetTitle>
      <Muted>{t("streaks.create.whoSub")}</Muted>
      {people === null ? (
        <Muted>{t("streaks.create.loading")}</Muted>
      ) : people.length === 0 ? (
        <Muted style={{ color: C.textMain }}>{t("streaks.create.nobody")}</Muted>
      ) : (
        <PeopleList people={people} chosen={chosen} onToggle={toggle} />
      )}
      {failed && <Note tone="error">{t("streaks.create.failed")}</Note>}
      <Btn onClick={submit} disabled={busy || people === null} style={{ marginTop: 16 }} data-save-who="">
        {busy ? busyLabel : doneLabel}
      </Btn>
      {onBack && (
        <Btn kind="quiet" onClick={onBack}>
          {t("streaks.create.back")}
        </Btn>
      )}
    </>
  );
}

/* ─── A number each day, or just yes or no — at creation and in settings ─── */
function KindOptions({ spec, kind, setKind, min, setMin, max, setMax, label }) {
  const { t, ts } = useI18n();
  const unit = spec ? unitWord(t, spec.unit) : "";

  const option = (value, title, sub, extra) => {
    const on = kind === value;
    return (
      <div
        style={{
          border: `2px solid ${on ? C.green : C.warmGray}`,
          background: on ? C.selected : C.surface,
          borderRadius: 14,
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={on}
          data-kind={value}
          onClick={() => setKind(value)}
          style={{ width: "100%", minHeight: 56, background: "transparent", border: "none", padding: "12px 14px", textAlign: "start", fontFamily: "inherit", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <span aria-hidden="true" style={{ fontSize: ts(18), color: C.green, fontWeight: 800, width: 20 }}>{on ? "✓" : ""}</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: ts(18), fontWeight: 700, color: C.textMain }}>{title}</span>
            <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, lineHeight: 1.45, marginTop: 3 }}>{sub}</span>
          </span>
        </button>
        {on && extra && <div style={{ padding: "0 14px 12px" }}>{extra}</div>}
      </div>
    );
  };

  const rangeControls = spec && (
    <>
      <Stepper
        label={t("streaks.create.from")}
        value={fmtNum(min)}
        unitLine={t("streaks.create.perDay", { unit })}
        downLabel={t("streaks.create.lower", { which: t("streaks.create.from") })}
        upLabel={t("streaks.create.raise", { which: t("streaks.create.from") })}
        downOff={min - spec.step < spec.lo}
        upOff={min + spec.step > max}
        onDown={() => setMin((v) => Math.max(spec.lo, v - spec.step))}
        onUp={() => setMin((v) => Math.min(max, v + spec.step))}
      />
      <Stepper
        label={t("streaks.create.to")}
        value={fmtNum(max)}
        unitLine={t("streaks.create.perDay", { unit })}
        downLabel={t("streaks.create.lower", { which: t("streaks.create.to") })}
        upLabel={t("streaks.create.raise", { which: t("streaks.create.to") })}
        downOff={max - spec.step < min}
        upOff={max + spec.step > spec.hi}
        onDown={() => setMax((v) => Math.max(min, v - spec.step))}
        onUp={() => setMax((v) => Math.min(spec.hi, v + spec.step))}
      />
    </>
  );

  return (
    <div role="radiogroup" aria-label={label}>
      {spec && option("range", t("streaks.create.numberTitle"), t("streaks.create.numberSub"), rangeControls)}
      {option("yes_no", t("streaks.create.yesNoTitle"), t("streaks.create.yesNoSub"))}
    </div>
  );
}

/* ─── Mock screens 2 + 3 ─── */
export function CreateStreakSheet({ open, onClose, entry, itemName }) {
  const { t } = useI18n();
  const spec = rangeSpecFor(entry?.key, entry?.tracker);
  const noun = itemNoun(t, entry?.key, itemName);
  const [step, setStep] = useState("kind");
  const [kind, setKind] = useState(spec ? "range" : "yes_no");
  const [min, setMin] = useState(spec ? spec.min : 0);
  const [max, setMax] = useState(spec ? spec.max : 0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("kind");
    setKind(spec ? "range" : "yes_no");
    setMin(spec ? spec.min : 0);
    setMax(spec ? spec.max : 0);
    setFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.key]);

  if (!entry) return null;

  const make = async ({ isPrivate, people }) => {
    const id = await createStreak({
      itemKey: entry.key,
      itemName,
      kind,
      min,
      max,
      unit: spec ? spec.unit : null,
      isPrivate,
      people,
    }).catch((e) => {
      if (errorKind(e) === "streak_exists") return "exists";
      throw e;
    });
    await refreshStreaks();
    const privately = isPrivate || !people || people.length === 0;
    if (id !== "exists") pushToast(t(privately ? "streaks.create.madePrivate" : "streaks.create.made", { noun }));
    onClose();
  };

  const keepPrivate = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await make({ isPrivate: true, people: [] });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label={t("streaks.create.title", { noun })}>
      {step === "kind" ? (
        <>
          <SheetTitle>{t("streaks.create.title", { noun })}</SheetTitle>
          <Muted>{t("streaks.create.sub")}</Muted>
          <KindOptions spec={spec} kind={kind} setKind={setKind} min={min} setMin={setMin} max={max} setMax={setMax} label={t("streaks.create.title", { noun })} />
          {failed && <Note tone="error">{t("streaks.create.failed")}</Note>}
          <Btn onClick={() => setStep("who")} disabled={busy}>{t("streaks.create.chooseWho")}</Btn>
          <Btn kind="secondary" onClick={keepPrivate} disabled={busy}>{t("streaks.create.keepPrivate")}</Btn>
        </>
      ) : (
        <PeopleSheetBody
          streakId={null}
          itemKey={entry.key}
          noun={noun}
          doneLabel={t("streaks.create.create")}
          busyLabel={t("streaks.send.checking")}
          onBack={() => setStep("kind")}
          onSubmit={(people) => make({ isPrivate: people.length === 0, people })}
        />
      )}
    </Sheet>
  );
}

/* ─── The streak's own settings ───
   `tracker` is the log's tracker for a tracker item (so a counted tracker
   can carry a range); without it a tracker streak that already has a range
   is known to be a counted one. */
export function StreakSettingsBody({ streak, tracker, onBack, onDeleted, onClose }) {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const key = streak.item_key;
  const noun = itemNoun(t, key, streak.item_name);
  const usual = MODULE_KEYS.includes(key) ? t(`settings.dailyLog.modules.${key}`) : null;
  const spec = rangeSpecFor(key, tracker || (streak.kind === "range" ? { type: "count" } : null));

  const [step, setStep] = useState("main"); // main | who | delete
  const [name, setName] = useState(itemTitle(t, key, streak.item_name));
  const [nameBusy, setNameBusy] = useState(false);
  const [nameNote, setNameNote] = useState(null);

  const startKind = streak.kind === "range" && spec ? "range" : "yes_no";
  const [kind, setKind] = useState(startKind);
  const [min, setMin] = useState(streak.kind === "range" ? Number(streak.range_min) : spec ? spec.min : 0);
  const [max, setMax] = useState(streak.kind === "range" ? Number(streak.range_max) : spec ? spec.max : 0);
  const [kindBusy, setKindBusy] = useState(false);
  const [kindNote, setKindNote] = useState(null);

  const [people, setPeople] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delFailed, setDelFailed] = useState(false);

  useEffect(() => {
    setName(itemTitle(t, key, streak.item_name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak.id, streak.item_name]);

  const currentName = itemTitle(t, key, streak.item_name);
  const nameChanged = name.trim() !== currentName.trim();

  const saveName = async (value) => {
    const v = String(value).trim();
    if (nameBusy) return;
    if (!v) return setNameNote({ tone: "error", text: t("streaks.settings.nameEmpty") });
    setNameBusy(true);
    setNameNote(null);
    try {
      await renameStreak(streak.id, v);
      await refreshStreaks();
      setName(v);
      setNameNote({ tone: "done", text: t("streaks.settings.nameSaved") });
    } catch (e) {
      setNameNote({ tone: "error", text: errorKind(e) === "name_length" ? t("streaks.settings.nameEmpty") : t("streaks.settings.failed") });
    } finally {
      setNameBusy(false);
    }
  };

  const kindChanged =
    kind !== streak.kind ||
    (kind === "range" && (Number(min) !== Number(streak.range_min) || Number(max) !== Number(streak.range_max)));

  const saveKind = async () => {
    if (kindBusy || !kindChanged) return;
    setKindBusy(true);
    setKindNote(null);
    try {
      await updateStreak(streak.id, { kind, min, max, unit: spec ? spec.unit : null });
      await refreshStreaks();
      setKindNote({ tone: "done", text: t("streaks.settings.kindSaved") });
    } catch {
      setKindNote({ tone: "error", text: t("streaks.settings.failed") });
    } finally {
      setKindBusy(false);
    }
  };

  const openDelete = () => {
    setStep("delete");
    setDelFailed(false);
    setPeople(null);
    sendList(streak.id).then(setPeople).catch(() => setPeople([]));
  };

  const doDelete = async () => {
    if (delBusy) return;
    setDelBusy(true);
    setDelFailed(false);
    try {
      await deleteStreak(streak.id);
      pushToast(t("streaks.delete.done", { noun }));
      await refreshStreaks();
      onDeleted && onDeleted();
    } catch {
      setDelFailed(true);
      setDelBusy(false);
    }
  };

  if (step === "who") {
    return (
      <PeopleSheetBody
        streakId={streak.id}
        itemKey={key}
        noun={noun}
        doneLabel={t("streaks.send.saveWho")}
        busyLabel={t("streaks.settings.saving")}
        onBack={() => setStep("main")}
        onSubmit={async (chosen) => {
          await setStreakPeople(streak.id, chosen);
          await refreshStreaks();
        }}
        onDone={() => {
          pushToast(t("streaks.send.savedWho"));
          setStep("main");
        }}
      />
    );
  }

  if (step === "delete") {
    const names = (people || []).map((p) => p.full_name);
    return (
      <div data-delete-confirm="">
        <SheetTitle>{t("streaks.delete.title", { noun })}</SheetTitle>
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.55, margin: "6px 0 10px" }}>{t("streaks.delete.body")}</p>
        {names.length > 0 && (
          <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.55, margin: "0 0 10px", fontWeight: 700 }}>
            {t("streaks.delete.bodyPeople", { names: namesLine(t, names) })}
          </p>
        )}
        <Muted>{t("streaks.delete.keeps")}</Muted>
        {delFailed && <Note tone="error">{t("streaks.delete.failed")}</Note>}
        <Btn onClick={doDelete} disabled={delBusy || people === null} style={{ background: C.error, color: C.white }} data-delete-yes="">
          {delBusy ? t("streaks.delete.deleting") : t("streaks.delete.yes")}
        </Btn>
        <Btn kind="quiet" onClick={() => setStep("main")} disabled={delBusy}>{t("streaks.delete.no")}</Btn>
      </div>
    );
  }

  const field = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    minHeight: TAP,
    marginTop: 6,
    padding: "10px 14px",
    borderRadius: 12,
    border: `2px solid ${C.warmGray}`,
    background: C.surface,
    color: C.textMain,
    fontFamily: "inherit",
    fontSize: ts(18),
  };

  return (
    <div data-streak-settings="">
      <SheetTitle>{t("streaks.settings.title", { noun })}</SheetTitle>

      <Label style={{ marginTop: 10 }}>{t("streaks.settings.nameLabel")}</Label>
      <label style={{ display: "block" }}>
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t("streaks.settings.nameLabel")}</span>
        <input
          value={name}
          maxLength={80}
          data-streak-name=""
          onChange={(e) => { setName(e.target.value); setNameNote(null); }}
          style={field}
        />
      </label>
      <Muted style={{ margin: "6px 0 0" }}>{t("streaks.settings.nameHint")}</Muted>
      {nameNote && <Note tone={nameNote.tone}>{nameNote.text}</Note>}
      <Btn kind="secondary" onClick={() => saveName(name)} disabled={nameBusy || !nameChanged} data-save-name="">
        {nameBusy ? t("streaks.settings.saving") : t("streaks.settings.saveName")}
      </Btn>
      {usual && !isUsualName(key, streak.item_name) && (
        <Btn kind="quiet" onClick={() => saveName(usual)} disabled={nameBusy}>{t("streaks.settings.usualName")}</Btn>
      )}

      <Label>{t("streaks.settings.kindLabel")}</Label>
      <KindOptions spec={spec} kind={kind} setKind={(v) => { setKind(v); setKindNote(null); }} min={min} setMin={(f) => { setMin(f); setKindNote(null); }} max={max} setMax={(f) => { setMax(f); setKindNote(null); }} label={t("streaks.settings.kindLabel")} />
      <Note>{t("streaks.settings.fromToday")}</Note>
      {kindNote && <Note tone={kindNote.tone}>{kindNote.text}</Note>}
      <Btn kind="secondary" onClick={saveKind} disabled={kindBusy || !kindChanged} data-save-kind="">
        {kindBusy ? t("streaks.settings.saving") : t("streaks.settings.saveKind")}
      </Btn>

      <Label>{t("streaks.settings.whoLabel")}</Label>
      {(streak.people_count ?? 0) === 0 && <Muted style={{ marginBottom: 0 }}>{t("streaks.settings.whoNobody")}</Muted>}
      <Btn kind="secondary" onClick={() => setStep("who")} data-settings-who="">{t("streaks.settings.whoChange")}</Btn>
      <button
        type="button"
        onClick={() => { onClose && onClose(); navigate("/app/streaks/left"); }}
        style={{ display: "block", margin: "8px auto 0", minHeight: TAP, background: "none", border: "none", color: C.green, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, textDecoration: "underline", fontFamily: "inherit", cursor: "pointer" }}
      >
        {t("streaks.settings.leftList")}
      </button>

      <div style={{ borderTop: `1px solid ${C.warmGray}`, marginTop: 14, paddingTop: 6 }}>
        <Btn kind="secondary" onClick={openDelete} style={{ color: C.error, borderColor: C.error }} data-delete-open="">
          {t("streaks.settings.deleteOpen")}
        </Btn>
      </div>
      {onBack && <Btn kind="quiet" onClick={onBack}>{t("streaks.settings.back")}</Btn>}
    </div>
  );
}

export function StreakSettingsSheet({ open, onClose, streak, tracker, onDeleted }) {
  const { t } = useI18n();
  if (!streak) return null;
  const noun = itemNoun(t, streak.item_key, streak.item_name);
  return (
    <Sheet open={open} onClose={onClose} label={t("streaks.settings.title", { noun })}>
      {open && (
        <StreakSettingsBody
          key={streak.id}
          streak={streak}
          tracker={tracker}
          onClose={onClose}
          onBack={onClose}
          onDeleted={() => { onClose(); onDeleted && onDeleted(); }}
        />
      )}
    </Sheet>
  );
}

/* ─── Mock screen 4: the daily send ─── */
export function SendStreakSheet({ open, onClose, streak, itemName, localValue, flushLogs, onLogNow, excludeLocked, tracker }) {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const noun = itemNoun(t, streak?.item_key, streak?.item_name || itemName);
  const [mode, setMode] = useState("send"); // send | who | settings
  const [phase, setPhase] = useState("checking"); // checking | ready | notCounted | failed
  const [fresh, setFresh] = useState(null); // the streak row after the log reached the server
  const [list, setList] = useState(null);
  const [out, setOut] = useState(new Set()); // left out today
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setPhase("checking");
    try {
      if (flushLogs) await flushLogs();
      const [rows, people] = await Promise.all([
        refreshStreaks().then(() => null),
        sendList(streak.id),
      ]);
      void rows;
      setList(people);
      setOut(new Set());
      setPhase("ready");
    } catch {
      setPhase("failed");
    }
  };

  useEffect(() => {
    if (!open || !streak) return;
    setMode("send");
    setFresh(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, streak?.id]);

  /* The store's row is refreshed by load(); read it through props on the
     next render. `fresh` holds the server's answer after a refused send. */
  const row = fresh || streak;
  const counts = row ? row.today_ok || (row.today_ok == null && valueCounts(row, localValue)) : false;

  const reason = () => {
    const value = row?.today_value ?? localValue;
    if (row?.kind === "range" && value != null) {
      return t("streaks.send.outOfRange", {
        noun,
        value: fmtNum(value),
        unit: unitWord(t, row.unit),
        min: fmtNum(row.range_min),
        max: fmtNum(row.range_max),
      });
    }
    return t("streaks.send.notLogged", { noun });
  };

  const locked = useMemo(() => new Set((list || []).filter((p) => p.already_sent).map((p) => p.id)), [list]);
  const sendable = (list || []).filter((p) => !p.already_sent && !out.has(p.id));

  const send = async () => {
    if (busy || !sendable.length) return;
    setBusy(true);
    try {
      const res = await sendStreak(streak.id, sendable.map((p) => p.id));
      const sentIds = new Set(res?.sent || []);
      const names = sendable.filter((p) => sentIds.has(p.id)).map((p) => p.full_name);
      await refreshStreaks();
      if (names.length) pushToast(t("streaks.send.sentTo", { names: namesLine(t, names) }));
      onClose();
    } catch (e) {
      if (errorKind(e) === "not_counted_today") {
        setFresh({ ...row, today_ok: false });
        setPhase("notCounted");
      } else {
        pushToast(t("streaks.send.failed"), { tone: "error" });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!streak) return null;
  const run = row?.run ?? 0;
  const title = (
    <>
      {t("streaks.send.title", { noun })} <span style={{ color: C.green, whiteSpace: "nowrap" }}>🔥 {run}</span>
    </>
  );

  const settingsLink = (
    <button
      type="button"
      data-open-settings=""
      onClick={() => setMode("settings")}
      style={{ display: "block", margin: "8px auto 0", minHeight: 48, background: "none", border: "none", color: C.green, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, textDecoration: "underline", fontFamily: "inherit", cursor: "pointer" }}
    >
      {t("streaks.settings.open")}
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} label={t("streaks.send.title", { noun })}>
      {mode === "settings" ? (
        <StreakSettingsBody
          key={streak.id}
          streak={streak}
          tracker={tracker}
          onClose={onClose}
          onBack={() => { setMode("send"); setFresh(null); load(); }}
          onDeleted={onClose}
        />
      ) : mode === "who" ? (
        <PeopleSheetBody
          streakId={streak.id}
          itemKey={streak.item_key}
          noun={noun}
          doneLabel={t("streaks.send.saveWho")}
          busyLabel={t("streaks.send.checking")}
          onBack={() => setMode("send")}
          onSubmit={async (people) => {
            await setStreakPeople(streak.id, people);
            await refreshStreaks();
          }}
          onDone={() => {
            pushToast(t("streaks.send.savedWho"));
            setMode("send");
            load();
          }}
        />
      ) : (
        <>
          <SheetTitle>{title}</SheetTitle>
          {phase === "checking" ? (
            <Muted>{t("streaks.send.checking")}</Muted>
          ) : phase === "failed" ? (
            <>
              <Note tone="error">{t("streaks.send.failed")}</Note>
              <Btn onClick={load}>{t("feedback.retry")}</Btn>
              {settingsLink}
            </>
          ) : !list || list.length === 0 ? (
            <>
              <Muted>{t("streaks.send.justYou")}</Muted>
              <Btn onClick={() => setMode("who")}>{t("streaks.create.chooseWho")}</Btn>
              <Btn kind="quiet" onClick={onClose}>{t("streaks.send.close")}</Btn>
              {settingsLink}
            </>
          ) : phase === "notCounted" || !counts ? (
            <>
              <Note>{reason()}</Note>
              {onLogNow && <Btn onClick={onLogNow}>{t("streaks.send.logNow", { noun })}</Btn>}
              <Btn kind="quiet" onClick={() => setMode("who")}>{t("streaks.send.change")}</Btn>
              {settingsLink}
            </>
          ) : (
            <>
              <Muted>{t("streaks.send.sub")}</Muted>
              {list.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  state={locked.has(p.id) || (excludeLocked && excludeLocked.has(p.id)) ? "lock" : out.has(p.id) ? "off" : "on"}
                  sub={locked.has(p.id) ? t("streaks.send.already") : out.has(p.id) ? t("streaks.send.leftOut") : null}
                  onToggle={() =>
                    setOut((s) => {
                      const n = new Set(s);
                      if (n.has(p.id)) n.delete(p.id);
                      else n.add(p.id);
                      return n;
                    })
                  }
                />
              ))}
              {/* Everyone already reached today: say so, and offer no button
                  that could only ever send to nobody. */}
              {locked.size === list.length ? (
                <Note tone="done">{t("streaks.send.allHaveIt")}</Note>
              ) : (
                <Btn onClick={send} disabled={busy || sendable.length === 0} style={{ marginTop: 16 }}>
                  {busy ? t("streaks.window.sending") : tn(t, "streaks.send.sendMany", sendable.length)}
                </Btn>
              )}
              <Btn kind="quiet" onClick={() => setMode("who")}>{t("streaks.send.change")}</Btn>
              <button
                type="button"
                onClick={() => { onClose(); navigate(`/app/streaks/${streak.id}`); }}
                style={{ display: "block", margin: "8px auto 0", minHeight: 48, background: "none", border: "none", color: C.green, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, textDecoration: "underline", fontFamily: "inherit", cursor: "pointer" }}
              >
                {t("streaks.send.seeGroup")}
              </button>
              {settingsLink}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
