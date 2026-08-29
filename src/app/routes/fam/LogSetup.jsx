/* ════════════════════════════════════════════════
   /app/fam/icon/:iconId/log-setup — "Help set up {name}'s daily log".

   Reachable only where the Icon granted can_configure_daily_log
   (migration 0033). The same LogSetupPanel the Icon sees in Settings,
   writing the same daily_log_prefs row; the database stamps every
   change "set up by {name}" and tells the Icon. Without the grant the
   reads return nothing and the writes fail — the page says so plainly
   and points home.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { fetchMembershipsAsMember } from "../../lib/circle.js";
import { FamScreen, Card, BodyText } from "./ui.jsx";
import LogSetupPanel from "../home/LogSetupPanel.jsx";

export default function LogSetup() {
  const { iconId } = useParams();
  const { t, ts, meta } = useI18n();
  const [membership, setMembership] = useState(undefined); // undefined loading, null none

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchMembershipsAsMember();
        if (cancelled) return;
        setMembership(rows.find((m) => m.icon_id === iconId) || null);
      } catch {
        if (!cancelled) setMembership(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [iconId]);

  const first = (membership?.icon_profile?.full_name || "").split(" ")[0];

  const back = (
    <Link
      to="/app/fam"
      style={{ display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx, fontSize: ts(A11Y.minBodyPx), color: C.brown, textDecoration: "none", fontWeight: 600, marginBottom: 8 }}
    >
      <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>{meta.dir === "rtl" ? "→" : "←"}</span>
      {t("fam.setup.backCta")}
    </Link>
  );

  if (membership === undefined) {
    return (
      <FamScreen>
        {back}
        <BodyText muted role="status">…</BodyText>
      </FamScreen>
    );
  }

  if (!membership || !membership.can_configure_daily_log) {
    return (
      <FamScreen>
        {back}
        <Card>
          <BodyText>{t("fam.setup.noPermission", { name: first || t("fam.setup.someone") })}</BodyText>
        </Card>
      </FamScreen>
    );
  }

  return (
    <FamScreen>
      {back}
      <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(30), fontWeight: 700, color: C.green, margin: "0 0 6px" }}>
        {t("fam.setup.title", { name: first })}
      </h1>
      <BodyText muted style={{ marginBottom: 14 }}>{t("fam.setup.intro", { name: first })}</BodyText>
      <LogSetupPanel iconId={iconId} isOwn={false} personName={first} />
      <BodyText muted style={{ fontSize: ts(16) }}>{t("fam.setup.notifyNote", { name: first })}</BodyText>
    </FamScreen>
  );
}
