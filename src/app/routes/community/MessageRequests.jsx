/* ════════════════════════════════════════════════
   Message requests — /app/community/messages/requests

   PRODUCT_DECISIONS §6: "Strangers never enter the list." A first
   message from someone unconnected waits here, and this screen is the
   whole of what §6 asks for:

     their name, their city, HOW THEY FOUND YOU (a shared group, an
     event, a park board — or that you have nothing in common), the
     FIRST MESSAGE ONLY, and three large buttons: Accept, Decline,
     Report. Above them, one plain line about money.

   Everything on it is a guard, and each one is somewhere different:

   - ONE SHOT ONLY is the shape of the database (0073): the first
     message lives in a single nullable slot on the request, so there
     is nowhere for a follow-up to go. This screen shows one message
     because one is all there can be.
   - DECLINE IS PERMANENT — send_dm_request refuses forever once a
     declined row exists. The button says so before it is pressed,
     because a permanent decision offered as a plain "Decline" is not
     really offered at all.
   - MONEY-PATTERN DETECTION runs on the message here, with the same
     over-broad advisory pattern the threads use. A match adds a
     caution the reader can see; nothing is blocked and nothing is
     logged, because the person who should decide is the one reading.
   - AN INCOMPLETE PROFILE IS A SMALL DETAIL, one grey line at the
     bottom — §6 is explicit that it is "never the headline warning".
     The person most likely to have a sparse profile is the isolated
     senior this whole app is for.

   The safety line sits ABOVE the buttons, always, whether or not
   anything matched. It is not a verdict on this person; it is the
   house rule, and a rule that only appears when we already suspect
   somebody is not a rule.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { MONEY_PATTERN } from "./communityCopy.js";
import {
  fetchMessageRequests,
  decideDmRequest,
  fileReport,
  blockOrMute,
} from "./communityData.js";

function Btn({ tone, onClick, disabled, children }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 56,
    flex: "1 1 150px",
    padding: "0 20px",
    borderRadius: 50,
    fontFamily: "inherit",
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
  const skin =
    tone === "accept"
      ? { background: C.green, color: C.cream, border: "none" }
      : tone === "report"
      ? { background: C.white, color: C.brown, border: `2px solid ${C.brown}` }
      : { background: C.white, color: C.textMain, border: `2px solid ${C.warmGray}` };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...skin }}>
      {children}
    </button>
  );
}

export default function MessageRequests() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const myId = profile?.id;

  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmDecline, setConfirmDecline] = useState("");

  const load = useCallback(async () => {
    if (!myId) return;
    try {
      setRows(await fetchMessageRequests(myId));
    } catch {
      setError("community.dm.requestsError");
      setRows([]);
    }
  }, [myId]);

  useEffect(() => { load(); }, [load]);

  const decide = async (r, accept) => {
    setBusy(r.id);
    setError("");
    try {
      const outcome = await decideDmRequest(r.id, accept);
      if (outcome === "accepted") {
        navigate(`/app/people/${r.senderId}/chat`);
        return;
      }
      setNotice("community.dm.declined");
      setRows((cur) => (cur || []).filter((x) => x.id !== r.id));
    } catch {
      setError("community.dm.requestsError");
    }
    setBusy("");
    setConfirmDecline("");
  };

  /* Report is also a decline — nobody who reports a stranger wants the
     request left sitting there afterwards — and it blocks them, which
     is what stops the message arriving again by another route. */
  const report = async (r) => {
    setBusy(r.id);
    setError("");
    try {
      await fileReport(myId, "dm_request", r.id, r.senderId, r.firstMessage, "message request");
      await blockOrMute(myId, r.senderId, "block").catch(() => {});
      await decideDmRequest(r.id, false).catch(() => {});
      setNotice("community.dm.reported");
      setRows((cur) => (cur || []).filter((x) => x.id !== r.id));
    } catch {
      setError("community.dm.requestsError");
    }
    setBusy("");
  };

  const metLine = (met) => {
    if (!met || met.length === 0) return t("community.dm.metNothing");
    const words = met.map((m) => t(`community.dm.met_${m}`));
    return t("community.dm.metVia", { where: words.join(t("community.dm.metJoin")) });
  };

  return (
    <>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(28),
          fontWeight: 700,
          color: C.green,
          margin: "4px 0 6px",
        }}
      >
        {t("community.dm.requestsTitle")}
      </h1>
      <Link
        to="/app/community/messages"
        style={{ color: C.green, fontWeight: 600, fontSize: ts(A11Y.minBodyPx) }}
      >
        ← {t("community.dm.backToMessages")}
      </Link>

      {error && (
        <p role="alert" style={{ color: C.brown, fontWeight: 700, fontSize: ts(A11Y.minBodyPx) }}>
          ⚠ {t(error)}
        </p>
      )}
      {notice && (
        <p role="status" style={{ color: C.green, fontWeight: 600, fontSize: ts(A11Y.minBodyPx) }}>
          ✓ {t(notice)}
        </p>
      )}

      {rows === null ? (
        <p role="status" style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx) }}>···</p>
      ) : rows.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: ts(A11Y.minBodyPx), marginTop: 20 }}>
          {t("community.dm.requestsEmpty")}
        </p>
      ) : (
        rows.map((r) => {
          const money = r.firstMessage && MONEY_PATTERN.test(r.firstMessage);
          const first = (r.name || "").split(" ")[0];
          return (
            <section
              key={r.id}
              style={{
                background: C.white,
                border: `2px solid ${C.warmGray}`,
                borderRadius: 18,
                padding: "18px 18px 20px",
                margin: "16px 0",
              }}
            >
              <p style={{ fontSize: ts(23), fontWeight: 700, color: C.textMain, margin: 0 }}>
                {r.name}
              </p>
              {r.city && (
                <p style={{ fontSize: ts(17), color: C.textMuted, margin: "2px 0 0" }}>{r.city}</p>
              )}
              {/* §6 — how they found you, said either way round. */}
              <p style={{ fontSize: ts(17), color: C.textMuted, margin: "6px 0 0" }}>
                {metLine(r.met)}
              </p>

              {/* The first message, and the only one there can be. */}
              {r.firstMessage && (
                <blockquote
                  style={{
                    margin: "14px 0 0",
                    padding: "14px 16px",
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
                    margin: "12px 0 0",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "#FBF0E6",
                    border: `2px solid ${C.brown}`,
                    color: C.textMain,
                    fontSize: ts(17),
                    fontWeight: 600,
                  }}
                >
                  ⚠ {t("community.dm.moneyWarning")}
                </p>
              )}

              {/* The house rule, above the buttons, every time. */}
              <p style={{ margin: "14px 0 12px", fontSize: ts(A11Y.minBodyPx), color: C.textMain, fontWeight: 600 }}>
                {t("community.dm.strangerLine")}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Btn tone="accept" onClick={() => decide(r, true)} disabled={busy === r.id}>
                  ✓ {t("community.dm.acceptCta")}
                </Btn>
                <Btn
                  tone="decline"
                  onClick={() => (confirmDecline === r.id ? decide(r, false) : setConfirmDecline(r.id))}
                  disabled={busy === r.id}
                >
                  {confirmDecline === r.id ? t("community.dm.declineSure") : t("community.dm.declineCta")}
                </Btn>
                <Btn tone="report" onClick={() => report(r)} disabled={busy === r.id}>
                  ⚑ {t("community.dm.reportCta")}
                </Btn>
              </div>
              {/* Said before the tap, because it cannot be undone after. */}
              <p style={{ margin: "8px 0 0", fontSize: ts(16), color: C.textMuted }}>
                {t("community.dm.declineForever", { name: first })}
              </p>

              {/* §6: a SMALL detail, never the headline. */}
              {!r.senderProfileComplete && (
                <p style={{ margin: "10px 0 0", fontSize: ts(15), color: C.textMuted }}>
                  {t("community.dm.sparseProfile")}
                </p>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
