/* The foot of the admin panel's navigation: a way out of the account,
   under "Go to the app". The same routine and the same question as the
   app's More drawer (lib/signOut.jsx) — a desk on a shared office machine
   is exactly where leaving has to be easy to find. */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSignOut } from "../../lib/signOut.jsx";
import Icon from "../../components/Icon.jsx";

export default function AdminSignOut() {
  const { t, ts, meta } = useI18n();
  const signOut = useSignOut();
  return (
    <>
      <button
        type="button"
        onClick={signOut.begin}
        data-admin-nav="sign-out"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          minHeight: A11Y.minTapTargetPx,
          padding: "4px 14px",
          marginTop: 18,
          borderRadius: 10,
          border: `2px solid ${C.cream}`,
          background: "transparent",
          color: C.cream,
          fontFamily: "inherit",
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 700,
          lineHeight: meta.dir === "rtl" ? 1.9 : 1.3,
          textAlign: "start",
          cursor: "pointer",
        }}
      >
        <Icon name="leave" size={20} style={{ flex: "0 0 auto", transform: meta.dir === "rtl" ? "scaleX(-1)" : undefined }} />
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{t("admin.shell.signOut")}</span>
      </button>
      {signOut.element}
    </>
  );
}
