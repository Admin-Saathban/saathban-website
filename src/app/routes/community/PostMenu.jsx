/* ════════════════════════════════════════════════
   Post menus — POSTS_SPEC.md §10.

   Both grow out of the three dots (MOTION_SPEC §7). A sheet is one
   decision then gone, which is exactly what a post menu is.

   TWO WORDINGS THAT MATTER, and both are the spec's:

   "SHOW LESS FROM {NAME}", with the sub-line "He won't know." Not
   "Mute", not "Unfollow". The fear that the other person will find out
   is what stops people using these controls at all, so the menu
   answers it in the row rather than leaving it to be guessed. It is
   reversible from Settings, which is what makes it safe to offer.

   NO BLOCK IN THIS MENU. Blocking a neighbour is a serious act and
   belongs on their profile, after a moment's thought — not one tap
   from a feed. Report is here; Block is not, and that is deliberate.

   DELETE IS THE ONLY RED ITEM and sits alone under a divider, so the
   destructive one cannot be hit while reaching for the one above it.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { MotionStyles } from "../../lib/motion.jsx";

function Item({ label, sub, onClick, danger, disabled }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block",
        width: "100%",
        minHeight: 58,
        padding: "12px 16px",
        border: "none",
        background: "transparent",
        color: danger ? C.error || C.brown : C.textMain,
        fontFamily: "inherit",
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: danger ? 800 : 600,
        textAlign: "start",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
      {sub && (
        <span style={{ display: "block", fontSize: ts(15), color: C.textMuted, fontWeight: 400, marginTop: 2 }}>
          {sub}
        </span>
      )}
    </button>
  );
}

export default function PostMenu({ post, mine, authorName, saved, following, onClose, actions }) {
  const { t, ts, meta } = useI18n();
  const [note, setNote] = useState("");

  const divider = <div style={{ height: 1, background: C.warmGray, margin: "6px 0" }} />;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("posts.menu.title")}
      onClick={onClose}
      className="sb-dim"
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(45,36,24,0.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <MotionStyles />
      <div
        onClick={(e) => e.stopPropagation()}
        className="sb-sheet"
        dir={meta.dir}
        style={{
          width: "100%", maxWidth: 640, background: C.bg,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "10px 0 calc(10px + env(safe-area-inset-bottom))",
          maxHeight: "80vh", overflowY: "auto",
        }}
      >
        {mine ? (
          <>
            <Item
              label={t(post.pinned_at ? "posts.menu.unpin" : "posts.menu.pin")}
              onClick={() => actions.pin(!post.pinned_at)}
            />
            <Item
              label={t("posts.menu.changeVisibility")}
              sub={t(`posts.vis.${post.visibility || "public"}`)}
              onClick={() => actions.changeVisibility()}
            />
            <Item label={t("posts.menu.edit")} onClick={() => actions.edit()} />
            <Item
              label={t(post.replies_off ? "posts.menu.repliesOn" : "posts.menu.repliesOff")}
              onClick={() => actions.setReplies(!post.replies_off)}
            />
            <Item label={t("posts.menu.copyLink")} onClick={() => actions.copyLink()} />

            {/* §6.3 — closing a help post without naming a helper. */}
            {post.style_tag === "help" && post.help_state !== "closed" && post.help_state !== "done" && (
              <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.warmGray}` }}>
                <p style={{ margin: "0 0 8px", fontSize: ts(16), color: C.textMain, fontWeight: 700 }}>
                  {t("posts.help.closeTitle")}
                </p>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("posts.help.closePh")}
                  maxLength={140}
                  dir={meta.dir}
                  style={{
                    width: "100%", boxSizing: "border-box", minHeight: A11Y.minTapTargetPx,
                    fontFamily: "inherit", fontSize: ts(16), color: C.textMain,
                    background: C.white, border: `2px solid ${C.warmGray}`,
                    borderRadius: 12, padding: "8px 12px", textAlign: "start",
                  }}
                />
                <button
                  type="button"
                  onClick={() => actions.closeHelp(note)}
                  style={{
                    marginTop: 8, minHeight: A11Y.minTapTargetPx, padding: "0 20px",
                    borderRadius: 50, border: "none", background: C.green, color: C.cream,
                    fontFamily: "inherit", fontSize: ts(16), fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {t("posts.help.closeCta")}
                </button>
              </div>
            )}

            {divider}
            {/* The only red item, alone. */}
            <Item label={t("posts.menu.delete")} danger onClick={() => actions.remove()} />
          </>
        ) : (
          <>
            <Item
              label={t(saved ? "posts.menu.unsave" : "posts.menu.save")}
              onClick={() => actions.save(!saved)}
            />
            <Item
              label={t(following ? "posts.menu.unfollow" : "posts.menu.follow")}
              onClick={() => actions.follow(!following)}
            />
            <Item label={t("posts.menu.copyLink")} onClick={() => actions.copyLink()} />
            {divider}
            <Item label={t("posts.menu.hide")} onClick={() => actions.hide()} />
            <Item
              label={t("posts.menu.showLess", { name: authorName })}
              sub={t("posts.menu.showLessSub")}
              onClick={() => actions.showLess()}
            />
            <Item label={t("posts.menu.report")} onClick={() => actions.report()} />
            {/* No Block here, deliberately — it lives on their profile. */}
          </>
        )}
      </div>
    </div>
  );
}
