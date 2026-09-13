/* ════════════════════════════════════════════════
   /app/admin/activity — plain numbers, no charts.

   admin_activity (0152), support or super. Signup weeks and months are
   Pakistan time, weeks from Monday. Logging is counted by each person's
   own local day. Active = seen in the app or signed in, whichever is
   later. Test accounts are left out unless the toggle says otherwise.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { ROLE_DISPLAY } from "../../constants/roles.js";
import { Card, fmtDateTime } from "./ui.jsx";
import { PageTitle, NumberRow, Notice, fmtDay } from "./adminBits.jsx";
import * as api from "./accountsApi.js";

export default function ActivityPage() {
  const { t } = useI18n();
  const [includeTest, setIncludeTest] = useState(false);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let live = true;
    setData(null);
    api
      .activity(includeTest)
      .then((d) => live && setData(d))
      .catch((e) => live && setMsg({ kind: "err", text: t(api.refusalKey(e) || "admin.activity.loadFailed") }));
    return () => {
      live = false;
    };
  }, [includeTest]);

  const s = data?.signups || {};
  const l = data?.logged || {};
  const act = data?.active || {};
  const r = data?.by_role || {};
  const st = data?.status || {};

  return (
    <div style={{ maxWidth: 1600 }}>
      <PageTitle title={t("admin.activity.title")} intro={t("admin.activity.intro")} />
      <Notice msg={msg} />

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          minHeight: A11Y.minTapTargetPx,
          marginBottom: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={includeTest}
          onChange={(e) => setIncludeTest(e.target.checked)}
          style={{ width: 24, height: 24 }}
        />
        {t("admin.activity.includeTest", { n: st.test_accounts ?? "…" })}
      </label>
      {data && (
        <p style={{ color: C.textMuted, fontSize: 15, margin: "0 0 16px" }}>
          {t("admin.activity.asOf", { when: fmtDateTime(data.as_of) })}
        </p>
      )}

      {data === null && !msg ? (
        <p role="status">{t("admin.activity.loading")}</p>
      ) : data ? (
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <Card title={t("admin.activity.signups")}>
            <NumberRow label={t("admin.activity.thisWeek")} value={s.this_week} strong />
            <NumberRow label={t("admin.activity.lastWeek")} value={s.last_week} />
            <NumberRow label={t("admin.activity.thisMonth")} value={s.this_month} />
            <NumberRow label={t("admin.activity.allTime")} value={s.all_time} />
          </Card>

          <Card title={t("admin.activity.byWeek")}>
            {(s.by_week || []).map((w) => (
              <NumberRow key={w.week_start} label={t("admin.activity.weekOf", { when: fmtDay(w.week_start) })} value={w.count} />
            ))}
          </Card>

          <Card title={t("admin.activity.logged")}>
            <NumberRow label={t("admin.activity.today")} value={l.today} strong />
            <NumberRow label={t("admin.activity.thisWeek")} value={l.this_week} />
            <NumberRow label={t("admin.activity.thisMonth")} value={l.this_month} />
            <p style={{ color: C.textMuted, fontSize: 15, marginBottom: 0 }}>{t("admin.activity.loggedNote")}</p>
          </Card>

          <Card title={t("admin.activity.active")}>
            <NumberRow label={t("admin.activity.last7")} value={act.last_7_days} strong />
            <NumberRow label={t("admin.activity.last30")} value={act.last_30_days} />
            <NumberRow label={t("admin.activity.never")} value={act.never_signed_in} />
          </Card>

          <Card title={t("admin.activity.byRole")}>
            <NumberRow label={ROLE_DISPLAY.saath_icon} value={r.saath_icon} />
            <NumberRow label={ROLE_DISPLAY.saath_buddy} value={r.saath_buddy} />
            <NumberRow label={ROLE_DISPLAY.family_member} value={r.family_member} />
            <NumberRow label={`${ROLE_DISPLAY.admin} · ${t("admin.levelSuper")}`} value={r.admin_super} />
            <NumberRow label={`${ROLE_DISPLAY.admin} · ${t("admin.levelSupport")}`} value={r.admin_support} />
            <NumberRow label={`${ROLE_DISPLAY.admin} · ${t("admin.levelModerator")}`} value={r.admin_moderator} />
            <NumberRow label={t("admin.activity.noProfile")} value={r.no_profile} />
          </Card>

          <Card title={t("admin.activity.status")}>
            <NumberRow label={t("admin.activity.paused")} value={st.paused} />
            <NumberRow label={t("admin.activity.blocked")} value={st.blocked} />
            <NumberRow label={t("admin.activity.testAccounts")} value={st.test_accounts} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
