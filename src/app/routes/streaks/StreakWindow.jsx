/* ════════════════════════════════════════════════
   The focused window — /app/streak/:sendId (mock screen 6).

   ONE THING ONLY. A received streak opens onto that one item: whose run
   it is, the recipient's own counter for that item and nothing else, and
   a button that records it and sends it back to the one person who sent
   it. There is no link into the log card, no other module, no route out
   to the rest of the log — the editor is rendered for a single key and
   told to draw no links of its own.

   The value is saved through the ordinary log store (offline-first, the
   person's local date), and flushed before reply_streak is asked, so the
   server counts what is on the screen.

   Notification links for kind 'streak' land here.

   STEPPING AWAY (0170). "Stop getting {name}'s streak" is always on this
   screen. After it, the window says so plainly and offers to undo; what
   it sent is put away and the owner is not told. If the sender stepped
   away from YOUR streak for this item, nothing can go back to them and
   the screen says so instead of offering a button that would fail.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { useSession } from "../../lib/session.jsx";
import { useIconPrefs } from "../../lib/iconPrefs.js";
import { useDailyLogs } from "../home/logStore.js";
import { isoDate } from "../home/homeMock.js";
import { SingleItemEditor, entryForKey } from "../home/DailyLogCard.jsx";
import {
  streakWindow,
  replyStreak,
  refreshStreaks,
  useMyStreaks,
  streakFor,
  itemTitle,
  itemNoun,
  unitWord,
  itemValueFromLog,
  valueCounts,
  errorKind,
  fmtNum,
  tn,
  rejoinStreak,
} from "./streaksData.js";
import { StreakScreen, Focus, Label, Card, Btn, Muted, Note } from "./ui.jsx";
import { SendStreakSheet } from "./StreakSheets.jsx";
import { LeaveStreakSheet } from "./StreakLeave.jsx";

export default function StreakWindow() {
  const { sendId } = useParams();
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const me = profile?.id;
  const prefs = useIconPrefs(me);
  const { logsByDate, writeEntry, flushNow } = useDailyLogs(me);
  const { rows } = useMyStreaks(me);
  const [win, setWin] = useState(undefined); // undefined loading · null gone
  const [state, setState] = useState({ status: "idle", note: null });
  const [moreOpen, setMoreOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [left, setLeft] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);

  const load = useCallback(
    () => streakWindow(sendId).then((w) => setWin(w || null)).catch(() => setWin(null)),
    [sendId]
  );
  useEffect(() => {
    load();
  }, [load]);

  const back = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/app/community/messages");
  };

  if (win === undefined) {
    return (
      <StreakScreen title="" onBack={back} backLabel={t("streaks.window.back")}>
        <Muted>…</Muted>
      </StreakScreen>
    );
  }
  if (win && left) {
    const n = itemNoun(t, win.item_key, win.item_name);
    const who = win.sender_first_name || "";
    const undo = async () => {
      if (undoBusy) return;
      setUndoBusy(true);
      try {
        const res = await rejoinStreak(win.sender_id, win.item_key);
        pushToast(t(res?.back_on_list ? "streaks.left.rejoined" : "streaks.left.rejoinedOpen", { name: who, noun: n }));
        setLeft(false);
        refreshStreaks();
        load();
      } catch {
        pushToast(t("streaks.left.failed"), { tone: "error" });
      } finally {
        setUndoBusy(false);
      }
    };
    return (
      <StreakScreen title={t("streaks.window.title", { item: itemTitle(t, win.item_key, win.item_name), name: who })} onBack={back} backLabel={t("streaks.window.back")}>
        <div data-left-done="">
          <Note tone="done">{t("streaks.leave.done", { name: who, noun: n })}</Note>
          <Muted style={{ marginTop: 10 }}>{t("streaks.leave.doneSub")}</Muted>
          <Btn kind="secondary" onClick={undo} disabled={undoBusy} data-undo-leave="">{t("streaks.leave.undo")}</Btn>
          <Btn kind="quiet" onClick={() => navigate("/app/streaks/left")}>{t("streaks.leave.seeLeft")}</Btn>
        </div>
      </StreakScreen>
    );
  }
  if (win === null) {
    return (
      <StreakScreen title="" onBack={back} backLabel={t("streaks.window.back")}>
        <Note>{t("streaks.window.gone")}</Note>
      </StreakScreen>
    );
  }

  const key = win.item_key;
  const title = itemTitle(t, key, win.item_name);
  const noun = itemNoun(t, key, win.item_name);
  const name = win.sender_first_name || "";
  const today = isoDate(new Date());
  const log = logsByDate[today] || {};
  const mine = win.mine;
  const rule = {
    kind: mine ? mine.kind : win.sender_kind,
    range_min: mine ? mine.range_min : win.sender_range_min,
    range_max: mine ? mine.range_max : win.sender_range_max,
    unit: mine ? mine.unit : win.sender_unit,
  };
  const value = itemValueFromLog(key, log);
  const counts = valueCounts(rule, value);
  const sentBack = !!win.already_sent_back || state.status === "sent";
  const notMine = String(key).startsWith("tracker:") && !entryForKey(prefs, key);
  const myStreak = streakFor(rows, key);
  const cannotSendBack = !!win.cannot_send_back;

  const refusal = () =>
    rule.kind === "range" && value != null
      ? t("streaks.window.outOfRange", {
          noun,
          name,
          value: fmtNum(value),
          unit: unitWord(t, rule.unit),
          min: fmtNum(rule.range_min),
          max: fmtNum(rule.range_max),
        })
      : t("streaks.window.notLogged", { noun, name });

  const record = async () => {
    if (state.status === "sending" || sentBack) return;
    setState({ status: "sending", note: null });
    try {
      await flushNow();
      await replyStreak(sendId);
      setState({ status: "sent", note: null });
      await Promise.all([refreshStreaks(), load()]);
    } catch (e) {
      const kind = errorKind(e);
      setState({
        status: "refused",
        note:
          kind === "not_counted_today"
            ? refusal()
            : kind === "streak_left"
            ? t("streaks.leave.cannotSendBack", { name, noun })
            : t("streaks.window.failed"),
      });
    }
  };

  return (
    <StreakScreen title={t("streaks.window.title", { item: title, name })} onBack={back} backLabel={t("streaks.window.back")}>
      <div data-streak-window="">
        <Focus
          above={t("streaks.window.isOn", { name, noun })}
          big={`🔥 ${win.sender_run}`}
          below={tn(t, "streaks.window.daysOf", win.sender_run, { noun })}
        />

        <Label>{t("streaks.window.yours", { noun })}</Label>
        {notMine ? (
          <Note>{t("streaks.window.trackerNotYours", { name })}</Note>
        ) : (
          <Card>
            <div data-window-editor={key}>
              <SingleItemEditor iconId={me} itemKey={key} dateIso={today} value={log[key]} onChange={(v) => writeEntry(today, key, v)} />
            </div>
            {rule.kind === "range" && (
              <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "12px 0 0" }}>
                {t("streaks.window.range", { min: fmtNum(rule.range_min), max: fmtNum(rule.range_max), unit: unitWord(t, rule.unit) })}
              </p>
            )}
            {value != null && (
              <p role="status" style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, margin: "6px 0 0", color: counts ? C.green : C.textMain }}>
                {counts ? t("streaks.window.counts") : t("streaks.window.notYet")}
              </p>
            )}
          </Card>
        )}

        {state.note && <Note tone="error">{state.note}</Note>}

        {!notMine && cannotSendBack && <Note>{t("streaks.leave.cannotSendBack", { name, noun })}</Note>}
        {!notMine && !cannotSendBack && (
          <Btn onClick={record} disabled={sentBack || state.status === "sending"} data-reply="">
            {sentBack
              ? t("streaks.window.sentBack", { name })
              : state.status === "sending"
              ? t("streaks.window.sending")
              : t("streaks.window.recordSend", { name })}
          </Btn>
        )}
        {sentBack && myStreak && (
          <Btn kind="quiet" onClick={() => setMoreOpen(true)} data-more="">
            {t("streaks.window.more", { noun })}
          </Btn>
        )}

        <Muted style={{ marginTop: 14, textAlign: "center" }}>{t("streaks.window.onlyThis", { name, noun })}</Muted>

        <button
          type="button"
          data-leave-open=""
          onClick={() => setLeaveOpen(true)}
          style={{ display: "block", margin: "4px auto 0", minHeight: 48, padding: "0 8px", background: "none", border: "none", color: C.textMuted, fontSize: ts(A11Y.minBodyPx), fontWeight: 600, textDecoration: "underline", fontFamily: "inherit", cursor: "pointer" }}
        >
          {t("streaks.leave.open", { name, noun })}
        </button>
      </div>

      <LeaveStreakSheet
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        ownerId={win.sender_id}
        ownerFirstName={name}
        itemKey={key}
        itemName={win.item_name}
        onLeft={() => {
          setLeaveOpen(false);
          setMoreOpen(false);
          setLeft(true);
        }}
      />

      {myStreak && (
        <SendStreakSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          streak={myStreak}
          itemName={win.item_name}
          localValue={value}
          flushLogs={flushNow}
          tracker={entryForKey(prefs, key)?.tracker}
        />
      )}
    </StreakScreen>
  );
}
