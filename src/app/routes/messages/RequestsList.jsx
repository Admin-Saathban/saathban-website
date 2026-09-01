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
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { MONEY_PATTERN } from "../community/communityCopy.js";
import {
  fetchMessageRequests,
  decideDmRequest,
  fileReport,
  blockOrMute,
} from "../community/communityData.js";
import { friendsInCommon, WORLD } from "./messagesData.js";
import Avatar from "./Avatar.jsx";

export default function RequestsList({ onCount }) {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const myId = profile?.id;

  const [rows, setRows] = useState(null);
  const [common, setCommon] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    try {
      const list = await fetchMessageRequests(myId);
      setRows(list);
      onCount?.(list.length);
      /* Friends in common, one lookup each, failures silent — it is a
         helpful detail, never a reason the screen does not load. */
      const pairs = await Promise.all(
        list.map(async (r) => [r.id, await friendsInCommon(myId, r.senderId).catch(() => 0)])
      );
      setCommon(Object.fromEntries(pairs));
    } catch {
      setRows([]);
      setError("msg.req.error");
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
        return next;
      });
      /* §4 — accepting lands you IN THE CHAT (MOTION_SPEC §7). No
         toast: the conversation opening is the confirmation, and the
         first message is already in it (0073). */
      if (outcome === "accepted") navigate(`/app/people/${r.senderId}/chat`);
    } catch {
      setError("msg.req.error");
    }
    setBusy("");
  };

  const report = async (r) => {
    setBusy(r.id);
    setError("");
    try {
      await fileReport(myId, "dm_request", r.id, r.senderId, r.firstMessage, "message request");
      await blockOrMute(myId, r.senderId, "block").catch(() => {});
      await decideDmRequest(r.id, false).catch(() => {});
      setRows((cur) => {
        const next = (cur || []).filter((x) => x.id !== r.id);
        onCount?.(next.length);
        return next;
      });
    } catch {
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
        <p style={{ fontSize: ts(A11Y.minBodyPx), color: C.textMuted, margin: "0 0 16px" }}>
          {t("msg.req.emptyBody")}
        </p>
        <Link
          to={`${WORLD}/invite`}
          style={{
            display: "inline-flex", alignItems: "center", minHeight: A11Y.minTapTargetPx,
            padding: "0 24px", borderRadius: 50, background: C.green, color: C.cream,
            fontSize: ts(A11Y.minBodyPx), fontWeight: 700, textDecoration: "none",
          }}
        >
          {t("msg.emptyCta")}
        </Link>
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

            {/* Quieter, and deliberately not one of the two. */}
            <button
              type="button"
              onClick={() => report(r)}
              disabled={busy === r.id}
              style={{
                marginTop: 10, minHeight: A11Y.minTapTargetPx, padding: "0 16px",
                borderRadius: 50, border: "none", background: "transparent",
                color: C.brown, fontFamily: "inherit", fontSize: ts(16),
                fontWeight: 600, textDecoration: "underline", cursor: "pointer",
              }}
            >
              {t("msg.req.report")}
            </button>

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
    </>
  );
}
