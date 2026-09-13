/* ════════════════════════════════════════════════
   The streak sheets on Today's log — mock screens 2, 3 and 4.

   CreateStreakSheet  what kind (a number each day, or just yes or no),
                      then who it goes to — or kept private. Never
                      opened except by a tap on "+ streak".
   SendStreakSheet    from then on, one tap: the chosen people, all
                      pre-ticked, anyone already reached today greyed and
                      locked. If today does not count yet it says so
                      plainly and offers to log.
   PeopleSheetBody    the one people list both use, and "Change who gets
                      this".

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
  unitWord,
  tn,
  fmtNum,
  peopleOptions,
  createStreak,
  setStreakPeople,
  sendList,
  sendStreak,
  refreshStreaks,
  errorKind,
  namesLine,
  valueCounts,
} from "./streaksData.js";
import { Sheet, SheetTitle, Muted, Label, Btn, PersonRow, Stepper, Note } from "./ui.jsx";

/* ─── The people list: Family, then Friends ─── */
function PeopleList({ people, chosen, onToggle }) {
  const { t } = useI18n();
  const family = people.filter((p) => p.how === "family");
  const friends = people.filter((p) => p.how !== "family");
  const row = (p) => (
    <PersonRow key={p.id} person={p} state={chosen.has(p.id) ? "on" : "off"} onToggle={() => onToggle(p.id)} />
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

/* Who a streak goes to — at creation (streakId null) or to change it. */
function PeopleSheetBody({ streakId, noun, onDone, onBack, doneLabel, busyLabel, onSubmit }) {
  const { t } = useI18n();
  const [people, setPeople] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    peopleOptions(streakId)
      .then((rows) => {
        if (!alive) return;
        setPeople(rows);
        setChosen(new Set(rows.filter((r) => r.chosen).map((r) => r.id)));
      })
      .catch(() => alive && setPeople([]));
    return () => { alive = false; };
  }, [streakId]);

  const toggle = (id) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSubmit([...chosen]);
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
      <Btn onClick={submit} disabled={busy || people === null} style={{ marginTop: 16 }}>
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

/* ─── Mock screens 2 + 3 ─── */
export function CreateStreakSheet({ open, onClose, entry, itemName }) {
  const { t, ts } = useI18n();
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
    <Sheet open={open} onClose={onClose} label={t("streaks.create.title", { noun })}>
      {step === "kind" ? (
        <>
          <SheetTitle>{t("streaks.create.title", { noun })}</SheetTitle>
          <Muted>{t("streaks.create.sub")}</Muted>
          <div role="radiogroup" aria-label={t("streaks.create.title", { noun })}>
            {spec && option("range", t("streaks.create.numberTitle"), t("streaks.create.numberSub"), rangeControls)}
            {option("yes_no", t("streaks.create.yesNoTitle"), t("streaks.create.yesNoSub"))}
          </div>
          {failed && <Note tone="error">{t("streaks.create.failed")}</Note>}
          <Btn onClick={() => setStep("who")} disabled={busy}>{t("streaks.create.chooseWho")}</Btn>
          <Btn kind="secondary" onClick={keepPrivate} disabled={busy}>{t("streaks.create.keepPrivate")}</Btn>
        </>
      ) : (
        <PeopleSheetBody
          streakId={null}
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

/* ─── Mock screen 4: the daily send ─── */
export function SendStreakSheet({ open, onClose, streak, itemName, localValue, flushLogs, onLogNow, excludeLocked }) {
  const { t, ts } = useI18n();
  const navigate = useNavigate();
  const noun = itemNoun(t, streak?.item_key, itemName || streak?.item_name);
  const [mode, setMode] = useState("send"); // send | who
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

  return (
    <Sheet open={open} onClose={onClose} label={t("streaks.send.title", { noun })}>
      {mode === "who" ? (
        <PeopleSheetBody
          streakId={streak.id}
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
            </>
          ) : !list || list.length === 0 ? (
            <>
              <Muted>{t("streaks.send.justYou")}</Muted>
              <Btn onClick={() => setMode("who")}>{t("streaks.create.chooseWho")}</Btn>
              <Btn kind="quiet" onClick={onClose}>{t("streaks.send.close")}</Btn>
            </>
          ) : phase === "notCounted" || !counts ? (
            <>
              <Note>{reason()}</Note>
              {onLogNow && <Btn onClick={onLogNow}>{t("streaks.send.logNow", { noun })}</Btn>}
              <Btn kind="quiet" onClick={() => setMode("who")}>{t("streaks.send.change")}</Btn>
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
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
