/* ════════════════════════════════════════════════
   Requests — MESSAGES_SPEC.md §4, holding PRODUCT_DECISIONS §6's guards.

   SHOW THE MESSAGE (§4). Facebook hides it until you tap; we show it,
   because "a request with no visible content asks a 68-year-old to
   decide blind", and reading "we met at the Model Town walk" makes the
   decision obvious. City and friends in common sit beside it — the
   neighbourhood logic already in the app, doing visible work.

   TWO SPECS MEET HERE, AND THEY DISAGREE ON ONE WORD.
   MESSAGES_SPEC §4: "Two actions: Accept and Not now. Never 'Decline',
   never 'Delete'." PRODUCT_DECISIONS §6: "three large buttons —
   Accept, Decline, Report."

   Resolved by taking the newer file's WORDING and the older file's
   SAFETY: the two large actions are Accept and Not now, exactly as §4
   requires, and Report survives as a quieter third control beneath
   them. Dropping Report would have removed the only route into the
   moderation queue from the one screen where strangers arrive, which
   §4 plainly does not intend — it is ruling on cruelty in wording, not
   on whether reporting exists. Flagged in the report rather than
   decided in silence.

   Everything one-shot, permanent-decline, money-pattern and
   sparse-profile is 0073's and §6's, unchanged.

   DRAWN FROM WHAT IS HELD (heldData.js). It mounted with null and waited
   for the server on every visit — about a second on a phone, each time.
   It now draws the last requests it saw on the first frame and replaces
   them when the refresh lands. A change made here (accept, not now,
   block) is written back at once, so a return never shows a card that
   was already dealt with.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pushToast } from "../../lib/feedback.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { MONEY_PATTERN } from "../community/communityCopy.js";
import {
  decideDmRequest,
  fileReport,
  blockOrMute,
} from "../community/communityData.js";
import { WORLD } from "./messagesData.js";
import { heldFor, holdFor, loadRequests } from "./heldData.js";
import Avatar from "./Avatar.jsx";

export default function RequestsList({ onCount }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const myId = profile?.id;

  const [rows, setRows] = useState(() => heldFor("requests", myId)?.rows ?? null);
  const [common, setCommon] = useState(() => heldFor("requests", myId)?.common ?? {});
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const commonRef = useRef(common);
  commonRef.current = common;
  /* What is left after a card goes, written back to the held copy so
     the next visit does not bring it back for a moment. */
  const keep = (next) => holdFor("requests", myId, { rows: next, common: commonRef.current });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reported, setReported] = useState({});   // request id -> true once sent
  const [blockAsk, setBlockAsk] = useState(null); // the request whose sender may be blocked

  const load = useCallback(async () => {
    if (!myId) return;
    try {
      /* Friends in common come with the rows (heldData.loadRequests), one
         lookup each, failures silent — a helpful detail, never a reason
         the screen does not load. */
      const { rows: list, common: counts } = await loadRequests(myId);
      setRows(list);
      setCommon(counts);
      onCount?.(list.length);
    } catch {
      /* A failed refresh leaves held cards where they are. Only with
         nothing to show does it say so. */
      if (rowsRef.current === null) {
        setRows([]);
        setError("msg.req.error");
      }
    }
  }, [myId, onCount]);

  useEffect(() => { load(); }, [load]);

  const decide = async (r, accept) => {
    setBusy(r.id);
    setError("");
    try {
      const outcome = await decideDmRequest(r.id, accept);
      setRows((cur) => {
        const next = (cur || []).filter((x) => x.id !== r.id);
        onCount?.(next.length);
        keep(next);
        return next;
      });
      /* §4 — accepting lands you IN THE CHAT (MOTION_SPEC §7). No
         toast: the conversation opening is the confirmation, and the
         first message is already in it (0073). */
      if (outcome === "accepted") navigate(`${WORLD}/with/${r.senderId}`);
    } catch {
      setError("msg.req.error");
    }
    setBusy("");
  };

  /* REPORT ONLY REPORTS. It used to file a report, block the sender and
     decline the request in one unconfirmed tap, with nothing on screen to
     say any of it had happened — and the report half never landed,
     because 'dm_request' was not an allowed report kind until 0135.
     Now it sends the report and says so on the card; Block and Not now
     are separate choices the person makes for themselves. */
  const report = async (r) => {
    setBusy(r.id);
    setError("");
    try {
      await fileReport(myId, "dm_request", r.id, r.senderId, r.firstMessage, "message request");
      setReported((cur) => ({ ...cur, [r.id]: true }));
    } catch {
      setError("msg.req.error");
    }
    setBusy("");
  };

  const block = async () => {
    const r = blockAsk;
    if (!r) return;
    setBusy(r.id);
    setError("");
    try {
      await blockOrMute(myId, r.senderId, "block");
      setBlockAsk(null);
      /* A blocked sender's request is hidden from me at the database
         (caller_blocked, 0143), so the card goes; the request is not
         declined. A MUTED sender's request stays: a mute is not a block. */
      setRows((cur) => {
        const next = (cur || []).filter((x) => x.id !== r.id);
        onCount?.(next.length);
        keep(next);
        return next;
      });
      pushToast(t("msg.thread.blockedToast", { name: (r.name || "").split(" ")[0] }));
    } catch {
      setBlockAsk(null);
      setError("msg.req.error");
    }
    setBusy("");
  };

  if (rows === null) {
    return <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>;
  }

  if (rows.length === 0) {
    /* A door, not a scoreboard (§4). */
    return (
      <div style={{ padding: "28px 8px", textAlign: "center" }}>
        <p style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "0 0 8px" }}>
          {t("msg.req.emptyTitle")}
        </p>
        {/* No button. It read "Write to someone you know" and went to the
            invite page — the wrong words for the wrong door. Requests are
            what arrives; writing and inviting are New chat's. */}
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: 0 }}>
          {t("msg.req.emptyBody")}
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(A11Y.minBodyPx) }}>
          ⚠ {t(error)}
        </p>
      )}

      {rows.map((r) => {
        const money = r.firstMessage && MONEY_PATTERN.test(r.firstMessage);
        const n = common[r.id] || 0;
        const first = (r.name || "").split(" ")[0];
        return (
          <section
            key={r.id}
            style={{
              background: C.white,
              border: `2px solid ${C.warmGray}`,
              borderRadius: 18,
              padding: "16px 16px 18px",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <Avatar person={{ full_name: r.name }} size={48} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>
                  {r.name}
                </span>
                <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>
                  {[r.city, n > 0 ? t(n === 1 ? "msg.req.commonOne" : "msg.req.common", { n }) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {/* §6's "how they found you" — a DIFFERENT fact from
                    friends in common, and both earn their place: one
                    says where your lives already overlap, the other
                    who else knows them. Kept when the world took this
                    screen over, rather than lost in the move. */}
                <span style={{ display: "block", fontSize: ts(16), color: C.textMuted }}>
                  {!r.met || r.met.length === 0
                    ? t("community.dm.metNothing")
                    : t("community.dm.metVia", {
                        where: r.met
                          .map((w) => t(`community.dm.met_${w}`))
                          .join(t("community.dm.metJoin")),
                      })}
                </span>
              </span>
            </div>

            {/* The message itself — §4's central ruling. */}
            {r.firstMessage && (
              <blockquote
                style={{
                  margin: "0 0 12px",
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: C.cream,
                  borderInlineStart: `4px solid ${C.warmGray}`,
                  fontSize: ts(A11Y.minBodyPx),
                  color: C.textMain,
                  whiteSpace: "pre-wrap",
                }}
              >
                {r.firstMessage}
              </blockquote>
            )}

            {money && (
              <p
                role="note"
                style={{
                  margin: "0 0 12px", padding: "12px 14px", borderRadius: 12,
                  background: "#FBF0E6", border: `2px solid ${C.brown}`,
                  color: C.textMain, fontSize: ts(17), fontWeight: 600,
                }}
              >
                ⚠ {t("community.dm.moneyWarning")}
              </p>
            )}

            <p style={{ margin: "0 0 12px", fontSize: ts(A11Y.minBodyPx), color: C.textMain, fontWeight: 600 }}>
              {t("community.dm.strangerLine")}
            </p>

            {/* Two actions, in §4's words. */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => decide(r, true)}
                disabled={busy === r.id}
                style={{
                  flex: "1 1 140px", minHeight: 56, borderRadius: 50, border: "none",
                  background: C.green, color: C.cream, fontFamily: "inherit",
                  fontSize: ts(A11Y.minBodyPx), fontWeight: 800, cursor: "pointer",
                }}
              >
                {t("msg.req.accept")}
              </button>
              <button
                type="button"
                onClick={() => decide(r, false)}
                disabled={busy === r.id}
                style={{
                  flex: "1 1 140px", minHeight: 56, borderRadius: 50,
                  border: `2px solid ${C.warmGray}`, background: C.white, color: C.textMain,
                  fontFamily: "inherit", fontSize: ts(A11Y.minBodyPx), fontWeight: 700, cursor: "pointer",
                }}
              >
                {t("msg.req.notNow")}
              </button>
            </div>

            {/* Quieter, and deliberately not one of the two: Report and
                Block, each doing only what it says. */}
            {reported[r.id] && (
              <p
                role="status"
                style={{
                  margin: "10px 0 0", padding: "10px 12px", borderRadius: 12,
                  background: C.cream, fontSize: ts(16), color: C.textMain, lineHeight: 1.45,
                }}
              >
                ✓ {t("msg.req.reportedNote", { name: first })}
              </p>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {!reported[r.id] && (
                <button
                  type="button"
                  onClick={() => report(r)}
                  disabled={busy === r.id}
                  style={{
                    minHeight: A11Y.minTapTargetPx, padding: "0 14px",
                    borderRadius: 50, border: "none", background: "transparent",
                    color: C.brown, fontFamily: "inherit", fontSize: ts(16),
                    fontWeight: 600, textDecoration: "underline", cursor: "pointer",
                  }}
                >
                  {t("msg.req.report")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setBlockAsk(r)}
                disabled={busy === r.id}
                style={{
                  minHeight: A11Y.minTapTargetPx, padding: "0 14px",
                  borderRadius: 50, border: "none", background: "transparent",
                  color: C.brown, fontFamily: "inherit", fontSize: ts(16),
                  fontWeight: 600, textDecoration: "underline", cursor: "pointer",
                }}
              >
                {t("msg.req.block", { name: first })}
              </button>
            </div>

            {/* §6 — a small grey detail, never the headline. */}
            {!r.senderProfileComplete && (
              <p style={{ margin: "8px 0 0", fontSize: ts(15), color: C.textMuted }}>
                {t("community.dm.sparseProfile")}
              </p>
            )}
            {/* §4 said "Not now", so the finality is said in words
                rather than hidden behind a gentler label. */}
            <p style={{ margin: "6px 0 0", fontSize: ts(15), color: C.textMuted }}>
              {t("msg.req.notNowMeans", { name: first })}
            </p>
          </section>
        );
      })}

      {blockAsk && (() => {
        const bf = (blockAsk.name || "").split(" ")[0];
        return (
          <ConfirmDialog
            danger
            title={t("msg.thread.blockTitle", { name: bf })}
            body={t("msg.thread.blockBody", { name: bf })}
            confirmLabel={t("msg.thread.blockConfirm", { name: bf })}
            cancelLabel={t("msg.thread.back")}
            busy={busy === blockAsk.id}
            onConfirm={block}
            onCancel={() => setBlockAsk(null)}
          />
        );
      })()}
    </>
  );
}
