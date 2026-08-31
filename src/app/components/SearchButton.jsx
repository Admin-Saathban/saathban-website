/* Search opens FULL SCREEN from the right — NAVIGATION_SPEC §5.

   Deliberately not a drawer: a drawer is for choosing between things,
   and search is a place you work. It needs the keyboard and the whole
   screen. */

import { useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "../lib/i18n.jsx";
import Icon from "./Icon.jsx";
import { openFullScreen } from "./motion.jsx";

export default function SearchButton() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => openFullScreen(navigate, "/app/search", "end")}
      aria-label={t("search.open")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: A11Y.minTapTargetPx,
        minWidth: A11Y.minTapTargetPx,
        border: "none",
        background: "none",
        color: C.textMain,
        fontSize: 20,
        cursor: "pointer",
      }}
    >
      <Icon name="search" size={22} />
    </button>
  );
}
