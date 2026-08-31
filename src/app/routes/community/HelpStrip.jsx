/* ════════════════════════════════════════════════
   A help post's three states — POSTS_SPEC.md §6.1, §6.4.

   Asked → Someone's coming → Done.

   THE OFFER IS A BUTTON, SEPARATE FROM THE TALK (§6.2). A comment
   thread under a request for help produces sympathy and no help, so
   offering is one green control and the conversation happens
   underneath it as ordinary comments.

   NOBODY IS BLOCKED, ONLY INFORMED (§6.1). Once somebody is coming the
   button becomes "Tariq's already coming — offer anyway?" and stays
   tappable. Two people turning up is a much smaller problem than the
   second one being told not to bother.

   THE INCOMPLETE-PROFILE LINE (§6.4) is one small grey sentence:
   "New here — hasn't finished their profile yet." Factual. No
   adjective, no red, no warning triangle, never the word "beware" —
   anything stronger makes every new member look like a threat, and new
   members are the people who most need help.

   §6.7: there is no counter of unanswered requests here, and nothing
   in this component could produce one.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Icon from "../../components/Icon.jsx";

export default function HelpStrip({ status, authorName, authorComplete, helperNames, mine, busy, onOffer, onWithdraw, onDone, onReopen, iOffered }) {
  const { t, ts } = useI18n();
  const first = (authorName || "").split(" ")[0];
  const firstHelper = (helperNames?.[0] || "").split(" ")[0];

  const box = {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 14,
    border: `2px solid ${C.warmGray}`,
    background: C.cream,
  };

  if (status.state === "done" || status.state === "closed") {
    return (
      <div style={{ ...box, background: "#EEF3E8", borderColor: C.green }}>
        <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.green }}>
          <Icon name="check" size={17} style={{ display: "inline", verticalAlign: "-3px", marginInlineEnd: 6 }} />
          {status.state === "closed"
            ? /* §6.3 — either the plain line, or their own words. */
              (status.note || t("posts.help.sortedPlain", { name: first }))
            : t("posts.help.sortedBy", { name: firstHelper || first })}
        </p>

        {/* A WAY BACK. §6.3 gave the asker a Close and no way to undo
            it, so settling a request was a one-way door.

            The case is the ordinary one, not the odd one: somebody
            offers, Fatima marks it sorted, and then they do not turn
            up. She is holding a closed post about a thing that still
            needs doing, and her only ways out were to delete it —
            which §6.3 itself calls the rude option — or to write the
            whole request again. A helper who does not arrive should
            not cost her the post.

            Only hers, and quiet: no confirmation, because reopening
            is not a destructive act and asking twice would make it
            feel like one. */}
        {mine && onReopen && (
          <button
            type="button"
            onClick={onReopen}
            disabled={busy}
            style={{
              minHeight: A11Y.minTapTargetPx,
              marginTop: 6,
              padding: 0,
              border: "none",
              background: "none",
              color: C.green,
              fontFamily: "inherit",
              fontSize: ts(15),
              fontWeight: 700,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {t("posts.help.reopen")}
          </button>
        )}
      </div>
    );
  }

  const someoneComing = status.state === "coming";

  return (
    <div style={box}>
      {someoneComing && (
        <p style={{ margin: "0 0 10px", fontSize: ts(A11Y.minBodyPx), color: C.textMain, fontWeight: 700 }}>
          🤝 {t("posts.help.coming", { name: firstHelper })}
        </p>
      )}

      {/* §6.4 — small, grey, factual, and never the headline. */}
      {!authorComplete && (
        <p style={{ margin: "0 0 8px", fontSize: ts(15), color: C.textMuted }}>
          {t("posts.help.newHere")}
        </p>
      )}

      {mine ? (
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          style={{
            minHeight: 52, padding: "0 22px", borderRadius: 50, border: "none",
            background: C.green, color: C.cream, fontFamily: "inherit",
            fontSize: ts(A11Y.minBodyPx), fontWeight: 800, cursor: "pointer",
          }}
        >
          {t("posts.help.markDone")}
        </button>
      ) : iOffered ? (
        <button
          type="button"
          onClick={onWithdraw}
          disabled={busy}
          style={{
            minHeight: 52, padding: "0 22px", borderRadius: 50,
            border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain,
            fontFamily: "inherit", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, cursor: "pointer",
          }}
        >
          {t("posts.help.youAreComing")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onOffer}
          disabled={busy}
          style={{
            minHeight: 52, padding: "0 22px", borderRadius: 50, border: "none",
            background: C.green, color: C.cream, fontFamily: "inherit",
            fontSize: ts(A11Y.minBodyPx), fontWeight: 800, cursor: "pointer",
          }}
        >
          {someoneComing
            ? t("posts.help.offerAnyway", { name: firstHelper })
            : t("posts.help.canHelp")}
        </button>
      )}
    </div>
  );
}
