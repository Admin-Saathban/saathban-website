/* ════════════════════════════════════════════════
   Stepping away from someone else's streak (0170).

   LeaveStreakSheet   the plain question: what stops, what is put away,
                      and that the owner is not told. One "yes".
   LeftStreaks        /app/streaks/left — the streaks you stepped away
                      from, each with "Start getting it again". Nobody
                      else can see this list.

   A STREAK YOU CANNOT LEAVE IS A TRAP. Leaving is never asked twice and
   never explained to the owner; the only trace they have is that the
   streak no longer goes to you.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import Avatar from "../messages/Avatar.jsx";
import { itemNoun, leaveStreak, rejoinStreak, myStreakLeaves, refreshStreaks } from "./streaksData.js";
import { Sheet, SheetTitle, Muted, Btn, Note, StreakScreen } from "./ui.jsx";

export function LeaveStreakSheet({ open, onClose, ownerId, ownerFirstName, itemKey, itemName, onLeft }) {
  const { t, ts } = useI18n();
  const noun = itemNoun(t, itemKey, itemName);
  const name = ownerFirstName || "";
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (open) { setBusy(false); setFailed(false); }
  }, [open]);

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await leaveStreak(ownerId, itemKey);
      refreshStreaks();
      onLeft && onLeft();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const para = { fontSize: ts(A11Y.minBodyPx), color: C.textMain, lineHeight: 1.55, margin: "6px 0 10px" };
  return (
    <Sheet open={open} onClose={onClose} label={t("streaks.leave.title", { name, noun })}>
      <div data-leave-confirm="">
        <SheetTitle>{t("streaks.leave.title", { name, noun })}</SheetTitle>
        <p style={para}>{t("streaks.leave.body")}</p>
        <p style={para}>{t("streaks.leave.quiet", { name })}</p>
        <Muted>{t("streaks.leave.stillYours", { name, noun })}</Muted>
        {failed && <Note tone="error">{t("streaks.leave.failed")}</Note>}
        <Btn onClick={leave} disabled={busy} data-leave-yes="">
          {busy ? t("streaks.leave.leaving") : t("streaks.leave.yes")}
        </Btn>
        <Btn kind="quiet" onClick={onClose} disabled={busy}>{t("streaks.leave.no")}</Btn>
      </div>
    </Sheet>
  );
}

export function LeftStreaks() {
  const { t, ts, lang } = useI18n();
  const navigate = useNavigate();
  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const [rows, setRows] = useState(undefined);
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(null);

  useEffect(() => {
    let alive = true;
    myStreakLeaves().then((r) => alive && setRows(r)).catch(() => alive && setRows(null));
    return () => { alive = false; };
  }, []);

  const back = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/app/home/log");
  };

  const rejoin = async (r) => {
    const k = r.owner_id + r.item_key;
    if (busy) return;
    setBusy(k);
    setFailed(null);
    const first = (r.owner_name || "").split(" ")[0];
    const noun = itemNoun(t, r.item_key, r.item_name);
    try {
      const res = await rejoinStreak(r.owner_id, r.item_key);
      pushToast(t(res?.back_on_list ? "streaks.left.rejoined" : "streaks.left.rejoinedOpen", { name: first, noun }));
      setRows((all) => (all || []).filter((x) => x !== r));
      refreshStreaks();
    } catch {
      setFailed(k);
    } finally {
      setBusy(null);
    }
  };

  return (
    <StreakScreen title={t("streaks.left.title")} onBack={back} backLabel={t("streaks.window.back")}>
      <div data-left-streaks="">
        <Muted>{t("streaks.left.sub")}</Muted>
        {rows === undefined ? (
          <Muted>…</Muted>
        ) : rows === null ? (
          <Note tone="error">{t("streaks.left.failed")}</Note>
        ) : rows.length === 0 ? (
          <Note>{t("streaks.left.empty")}</Note>
        ) : (
          rows.map((r) => {
            const k = r.owner_id + r.item_key;
            const first = (r.owner_name || "").split(" ")[0];
            const noun = itemNoun(t, r.item_key, r.item_name);
            return (
              <div key={k} data-left-row={r.owner_id} style={{ background: C.surface, borderRadius: 16, padding: "12px 14px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar person={{ full_name: r.owner_name, avatar_url: r.avatar_url }} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: ts(18), fontWeight: 700, overflowWrap: "anywhere" }}>{t("streaks.left.line", { name: first, noun })}</p>
                    <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), color: C.textMuted }}>
                      {t("streaks.left.since", { date: new Date(r.left_at).toLocaleDateString(locale, { day: "numeric", month: "long" }) })}
                    </p>
                  </div>
                </div>
                {failed === k && <Note tone="error">{t("streaks.left.failed")}</Note>}
                <Btn kind="secondary" onClick={() => rejoin(r)} disabled={!!busy} data-rejoin={r.owner_id}>
                  {t("streaks.left.rejoin")}
                </Btn>
              </div>
            );
          })
        )}
      </div>
    </StreakScreen>
  );
}
