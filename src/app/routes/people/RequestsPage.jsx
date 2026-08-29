/* ════════════════════════════════════════════════
   Requests — the ONE inbox for connection requests (friend_requests,
   0027), replacing the community Connect surface (which now redirects
   here). Incoming/outgoing tabs; one-tap accept/decline. Declines are
   silent to the other side (the RPC's rule — the requester's view
   never distinguishes declined from pending). Accepting a request
   from someone who blocked you meanwhile fails safely server-side:
   nothing here pre-checks what the database already refuses.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Card, BodyText, Pill, PrimaryBtn, GhostBtn } from "../circle/ui.jsx";
import { fetchRequests, respondRequest } from "./myPeopleStore.js";

export default function RequestsPage() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState("in"); // in | out
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try { setRows(await fetchRequests(myId)); }
    catch { setError("people.requests.loadError"); setRows([]); }
  };
  useEffect(() => { if (myId) load(); /* eslint-disable-next-line */ }, [myId]);

  const answer = async (r, accept) => {
    setBusy(r.id);
    setError("");
    try {
      await respondRequest(r.id, accept);
      await load();
    } catch {
      // e.g. blocked-in-the-meantime: the server refuses; reload truth.
      setError("people.requests.actionError");
      await load();
    } finally { setBusy(null); }
  };

  const incoming = (rows || []).filter((r) => r.incoming && r.status === "pending");
  // Outgoing shows pending AND declined identically ("waiting") — a
  // decline is never announced to the requester (0027 convention).
  const outgoing = (rows || []).filter((r) => !r.incoming && r.status !== "accepted");

  const TabBtn = ({ k, label, n }) => {
    const active = tab === k;
    return (
      <button type="button" aria-pressed={active} onClick={() => setTab(k)} style={{
        display: "inline-flex", alignItems: "center", gap: 8, minHeight: A11Y.minTapTargetPx,
        padding: "0 18px", borderRadius: 50,
        border: active ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: active ? C.white : "transparent", color: C.textMain,
        fontSize: ts(A11Y.minBodyPx), fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
      }}>
        <span aria-hidden="true" style={{ color: C.green, visibility: active ? "visible" : "hidden" }}>✓</span>
        {label}{n > 0 ? ` (${n})` : ""}
      </button>
    );
  };

  return (
    <>
      <h1 style={{ fontFamily: meta.fonts.heading, fontSize: ts(30), fontWeight: 700, color: C.green, margin: "4px 0 6px" }}>
        {t("people.requests.title")}
      </h1>
      <BodyText muted style={{ marginBottom: 14 }}>{t("people.requests.intro")}</BodyText>

      {error && <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>⚠ {t(error)}</BodyText>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <TabBtn k="in" label={t("people.requests.incoming")} n={incoming.length} />
        <TabBtn k="out" label={t("people.requests.outgoing")} n={outgoing.length} />
      </div>

      {rows === null ? (
        <BodyText muted role="status">···</BodyText>
      ) : tab === "in" ? (
        incoming.length === 0 ? (
          <Card><BodyText muted style={{ margin: 0 }}>{t("people.requests.emptyIn")}</BodyText></Card>
        ) : (
          incoming.map((r) => (
            <Card key={r.id}>
              <BodyText style={{ fontWeight: 600 }}>
                {t("people.requests.incomingLine", { name: r.person?.full_name || t("people.someone") })}
              </BodyText>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PrimaryBtn disabled={busy === r.id} onClick={() => answer(r, true)}>
                  {t("people.requests.accept")}
                </PrimaryBtn>
                <GhostBtn disabled={busy === r.id} onClick={() => answer(r, false)}>
                  {t("people.requests.decline")}
                </GhostBtn>
              </div>
            </Card>
          ))
        )
      ) : outgoing.length === 0 ? (
        <Card><BodyText muted style={{ margin: 0 }}>{t("people.requests.emptyOut")}</BodyText></Card>
      ) : (
        outgoing.map((r) => (
          <Card key={r.id} style={{ background: C.cream }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <BodyText style={{ margin: 0, flex: "1 1 160px", fontWeight: 600 }}>
                {r.person?.full_name || t("people.someone")}
              </BodyText>
              <Pill>⏳ {t("people.requests.waiting")}</Pill>
            </div>
          </Card>
        ))
      )}

      <div style={{ marginTop: 18 }}>
        <Link to="/app/people" style={{ color: C.brown, fontWeight: 600, fontSize: ts(A11Y.minBodyPx) }}>
          {t("people.requests.backToPeople")}
        </Link>
      </div>
    </>
  );
}
