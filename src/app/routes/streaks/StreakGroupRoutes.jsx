/* ════════════════════════════════════════════════
   /app/streaks/:streakId          a streak group (mock screen 7)
   /app/streaks/:streakId/missed   a missed day   (mock screen 8)

   THE GROUP IS NEVER RANKED. Members come in the order the server
   returns them — you first, then the order they were added — and the
   month's bars keep that order whatever the counts say. Nobody is placed
   last. The bars count days sent, not days in a row.

   A NUDGE IS A PERSON'S WORDS. It opens editable, prefilled in the
   language being used, and goes only when Send is pressed. Never
   automatic, never on anyone's behalf.

   A MISSED DAY IS NEVER DECIDED FOR YOU. The rest day is offered only
   when one is available; either way the days with Saathban are
   untouched and nobody is told which was chosen.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import supabase from "../../lib/supabase.js";
import Avatar from "../messages/Avatar.jsx";
import { useDailyLogs } from "../home/logStore.js";
import {
  streakGroup,
  nudgeStreak,
  takeRestDay,
  restartStreak,
  refreshStreaks,
  useMyStreaks,
  itemTitle,
  itemNoun,
  itemValueFromLog,
  errorKind,
  tn,
} from "./streaksData.js";
import { StreakScreen, Focus, Label, Card, Btn, Muted, Note, Sheet, SheetTitle, ItemIcon, AMBER, TAP } from "./ui.jsx";

const goBack = (navigate, fallback) => {
  if (window.history.state && window.history.state.idx > 0) navigate(-1);
  else navigate(fallback);
};

function dateOf(iso, locale, opts) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, opts);
}

/* ─── The nudge: editable, both languages, sent only on the press ─── */
function NudgeSheet({ open, onClose, group, member, onSent }) {
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const first = (member?.name || "").split(" ")[0];
  const meFirst = (profile?.full_name || "").split(" ")[0];
  const noun = itemNoun(t, group.item_key, group.item_name);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTitle(meFirst ? t("streaks.nudge.defaultTitle", { me: meFirst }) : t("streaks.nudge.defaultTitleAnon"));
    setBody(t("streaks.nudge.defaultBody", { noun }));
    setNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id]);

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
    fontSize: ts(A11Y.minBodyPx),
    lineHeight: 1.5,
  };

  const send = async () => {
    if (busy || !body.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      await nudgeStreak(group.streak_id, member.id, title.trim(), body.trim());
      pushToast(t("streaks.nudge.sent", { name: first }));
      onSent();
    } catch (e) {
      const k = errorKind(e);
      setNote(
        k === "already_sent"
          ? t("streaks.nudge.alreadySent", { name: first })
          : k === "already_nudged"
          ? t("streaks.nudge.alreadyNudged", { name: first })
          : t("streaks.nudge.failed")
      );
    } finally {
      setBusy(false);
    }
  };

  if (!member) return null;
  return (
    <Sheet open={open} onClose={onClose} label={t("streaks.nudge.title", { name: first })}>
      <SheetTitle>{t("streaks.nudge.title", { name: first })}</SheetTitle>
      <Muted>{t("streaks.nudge.sub")}</Muted>
      <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 10 }}>
        {t("streaks.nudge.titleLabel")}
        <input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} style={field} />
      </label>
      <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600 }}>
        {t("streaks.nudge.bodyLabel")}
        <textarea value={body} rows={3} maxLength={280} onChange={(e) => setBody(e.target.value)} style={{ ...field, resize: "vertical" }} />
      </label>
      {note && <Note tone="error">{note}</Note>}
      <Btn onClick={send} disabled={busy || !body.trim()} style={{ marginTop: 14 }}>
        {busy ? t("streaks.window.sending") : t("streaks.nudge.send")}
      </Btn>
      <Btn kind="quiet" onClick={onClose}>{t("streaks.nudge.notNow")}</Btn>
    </Sheet>
  );
}

function StreakGroup() {
  const { streakId } = useParams();
  const { t, ts, lang } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const [g, setG] = useState(undefined);
  const [nudging, setNudging] = useState(null);

  const load = useCallback(() => streakGroup(streakId).then((d) => setG(d || null)).catch(() => setG(null)), [streakId]);
  useEffect(() => {
    load();
  }, [load]);

  const back = () => goBack(navigate, "/app/community/messages");
  if (g === undefined) {
    return <StreakScreen title="" onBack={back} backLabel={t("streaks.window.back")}><Muted>…</Muted></StreakScreen>;
  }
  if (g === null) {
    return <StreakScreen title="" onBack={back} backLabel={t("streaks.window.back")}><Note>{t("streaks.group.gone")}</Note></StreakScreen>;
  }

  const members = g.members || [];
  const item = itemTitle(t, g.item_key, g.item_name);
  const [my, mm] = String(g.month || g.today).split("-").map(Number);
  const daysInMonth = new Date(my, mm, 0).getDate();

  const statusOf = (m) => {
    if (m.sent_today) {
      if (m.is_me) return t("streaks.group.youSent", { n: m.run ?? 0 });
      const h = m.sent_at ? new Date(m.sent_at).getHours() : 9;
      const k = h < 12 ? "sentMorning" : h < 17 ? "sentAfternoon" : "sentEvening";
      return t(`streaks.group.${k}`, { n: m.run ?? 0 });
    }
    return m.is_me ? t("streaks.group.youNotYet", { n: m.run ?? 0 }) : t("streaks.group.notSent");
  };

  return (
    <StreakScreen title={t("streaks.group.title", { item, n: members.length })} onBack={back} backLabel={t("streaks.window.back")}>
      <div data-streak-group="">
        <Muted style={{ marginTop: -6 }}>{dateOf(g.today, locale, { weekday: "long", day: "numeric", month: "long" })}</Muted>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => {
            const person = m.is_me ? { full_name: profile?.full_name, avatar_url: null } : { full_name: m.name, avatar_url: m.avatar_url };
            return (
              <div key={m.id} data-member={m.is_me ? "me" : m.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, borderRadius: 14, padding: "10px 12px" }}>
                <Avatar person={person} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: ts(18), fontWeight: 700, overflowWrap: "anywhere" }}>{m.is_me ? t("streaks.group.you") : m.name}</p>
                  <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: m.sent_today ? C.green : C.textMuted }}>{statusOf(m)}</p>
                </div>
                {!m.is_me && !m.sent_today &&
                  (m.nudged_today ? (
                    <span style={{ fontSize: ts(15), color: C.textMuted, border: `1px solid ${C.warmGray}`, borderRadius: 50, padding: "4px 10px", whiteSpace: "nowrap" }}>
                      {t("streaks.group.nudged")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-nudge={m.id}
                      onClick={() => setNudging(m)}
                      style={{ minHeight: TAP, background: AMBER, color: C.textMain, border: "none", borderRadius: 12, padding: "0 14px", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {t("streaks.group.nudge")}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>

        <Label>{t("streaks.group.month")}</Label>
        <Card>
          <p style={{ margin: 0, fontSize: ts(18), fontWeight: 700 }}>{t("streaks.group.daysSent")}</p>
          <p style={{ margin: "2px 0 6px", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>{t("streaks.group.daysSentSub")}</p>
          <div data-bars="">
            {/* In the server's order. Deliberately not sorted by count. */}
            {members.map((m) => {
              const n = m.days_sent_month || 0;
              const name = m.is_me ? t("streaks.group.you") : (m.name || "").split(" ")[0];
              return (
                <div key={m.id} data-bar={n} role="img" aria-label={tn(t, "streaks.group.barAria", n, { name })} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <span style={{ width: 84, fontSize: ts(A11Y.minBodyPx), color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  <span style={{ flex: 1, height: 10, background: C.comment, borderRadius: 5, overflow: "hidden" }}>
                    <span style={{ display: "block", width: `${Math.min(100, (n / daysInMonth) * 100)}%`, height: "100%", background: C.green }} />
                  </span>
                  <span style={{ width: 28, textAlign: "end", fontSize: ts(A11Y.minBodyPx), fontWeight: 700 }}>{n}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <NudgeSheet
        open={!!nudging}
        onClose={() => setNudging(null)}
        group={g}
        member={nudging}
        onSent={() => {
          setNudging(null);
          load();
        }}
      />
    </StreakScreen>
  );
}

function MissedDay() {
  const { streakId } = useParams();
  const { t, ts } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const { rows, days } = useMyStreaks(profile?.id);
  const { logsByDate } = useDailyLogs(profile?.id);
  const [before, setBefore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const s = (rows || []).find((r) => r.id === streakId) || null;
  const missed = s ? s.missed_day : null;

  useEffect(() => {
    if (!missed) return;
    let alive = true;
    supabase.rpc("streak_run_before_missed", { p_streak: streakId }).then(({ data }) => {
      if (alive) setBefore(data);
    });
    return () => { alive = false; };
  }, [streakId, missed]);

  const back = () => goBack(navigate, "/app/home/log");
  const done = (msg) => {
    pushToast(msg);
    navigate("/app/home/log", { replace: true });
  };

  if (rows === null) {
    return <StreakScreen title="" onBack={back} backLabel={t("streaks.window.back")}><Muted>…</Muted></StreakScreen>;
  }
  if (!s || !missed) {
    return (
      <StreakScreen title={s ? itemTitle(t, s.item_key, s.item_name) : ""} onBack={back} backLabel={t("streaks.window.back")}>
        <Note>{t("streaks.missed.nothing")}</Note>
      </StreakScreen>
    );
  }

  const noun = itemNoun(t, s.item_key, s.item_name);
  const yesterdayValue = itemValueFromLog(s.item_key, logsByDate[missed] || {});
  const n = days ? days.days : 0;

  const act = async (fn, okMsg) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      await fn(streakId);
      await refreshStreaks();
      done(okMsg);
    } catch (e) {
      const k = errorKind(e);
      setNote(k === "no_rest_day_left" ? t("streaks.missed.noneLeft") : k === "Nothing to rest" ? t("streaks.missed.nothing") : t("streaks.window.failed"));
      refreshStreaks();
    } finally {
      setBusy(false);
    }
  };

  return (
    <StreakScreen title={itemTitle(t, s.item_key, s.item_name)} onBack={back} backLabel={t("streaks.window.back")}>
      <div data-missed-day="">
        <Focus
          above={yesterdayValue != null ? t("streaks.missed.outOfRange", { noun }) : t("streaks.missed.noLog", { noun })}
          big={`🔥 ${before ?? "…"}`}
          bigSize={38}
          below={t("streaks.missed.stillHere")}
        />

        {s.rest_day_available && (
          <Card style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ItemIcon name="rest" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: ts(18), fontWeight: 700 }}>{t("streaks.missed.restTitle")}</p>
                <p style={{ margin: "2px 0 0", fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>{t("streaks.missed.restOne")}</p>
              </div>
            </div>
            <Btn onClick={() => act(takeRestDay, t("streaks.missed.rested"))} disabled={busy} style={{ marginTop: 12 }} data-rest="">
              {t("streaks.missed.useRest")}
            </Btn>
          </Card>
        )}

        {note && <Note tone="error">{note}</Note>}

        <Btn kind="secondary" onClick={() => act(restartStreak, t("streaks.missed.restarted"))} disabled={busy} style={{ marginTop: 12 }} data-restart="">
          {t("streaks.missed.restart")}
        </Btn>

        <Muted style={{ marginTop: 14, textAlign: "center" }}>{tn(t, "streaks.missed.either", n)}</Muted>
      </div>
    </StreakScreen>
  );
}

export default function StreakGroupRoutes() {
  return (
    <Routes>
      <Route path=":streakId" element={<StreakGroup />} />
      <Route path=":streakId/missed" element={<MissedDay />} />
    </Routes>
  );
}
