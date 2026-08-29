/* ════════════════════════════════════════════════
   Connect flow, Fam side — the two real doors migration 0005 gives a
   family account:

   1. Ask to join by email → request_to_join_circle(). The answer is
      ALWAYS "request sent" (decision #6): whether or not the email
      matched an Icon, this screen shows the same message — nobody can
      probe which emails have accounts.
   2. Enter a code an Icon read aloud → accept_circle_invite(). This
      connects immediately (the code IS the Icon's yes) and lands back
      on the dashboard, where the new card starts all-private.

   Codes are generated on the Icon's side only (/app/circle) — the
   mock's code/QR display tabs moved there with the real RPC.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { requestToJoinCircle, acceptCircleInvite } from "../../lib/circle.js";
import { FamScreen, Card, PrimaryBtn, GhostBtn, BodyText } from "./ui.jsx";
import { COPY } from "./famCopy.js";

export default function InviteFlow() {
  const { ts, meta } = useI18n();
  const navigate = useNavigate();
  const c = COPY.invite;

  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailDone, setEmailDone] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState("");

  const sendRequest = async (e) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) return;
    setEmailBusy(true);
    setEmailError("");
    try {
      await requestToJoinCircle(email.trim());
      setEmailDone(true); // the one and only outcome shown for any email
    } catch (err) {
      // Only real failures land here (e.g. the daily rate limit); the
      // RPC's own message is written for people.
      setEmailError(err.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const redeemCode = async (e) => {
    e.preventDefault();
    if (joinCode.replace(/\D/g, "").length !== 6) return;
    setJoinBusy(true);
    setJoinError("");
    try {
      await acceptCircleInvite(joinCode);
      navigate("/app/fam", { replace: true }); // the new card is there
    } catch {
      setJoinError(c.codeInvalid);
      setJoinBusy(false);
    }
  };

  return (
    <FamScreen backTo="/app/fam" backLabel={c.backToDashboard}>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: "0 0 8px",
        }}
      >
        {c.title}
      </h1>
      <BodyText muted style={{ marginBottom: 20 }}>
        {c.intro}
      </BodyText>

      {/* Door 1: ask to join by email */}
      <Card>
        <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.brown, margin: "0 0 6px" }}>
          {c.emailLabel}
        </h2>
        {emailDone ? (
          <BodyText role="status" style={{ fontWeight: 600, color: C.green, margin: 0 }}>
            ✓ {c.emailSent}
          </BodyText>
        ) : (
          <form onSubmit={sendRequest}>
            <label
              style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 6 }}
            >
              {c.emailField}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{ marginTop: 6 }}
              />
            </label>
            <BodyText muted style={{ margin: "8px 0 16px" }}>
              {c.emailHint}
            </BodyText>
            {emailError && (
              <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
                ⚠ {emailError}
              </BodyText>
            )}
            <PrimaryBtn type="submit" disabled={emailBusy}>
              {c.emailCta}
            </PrimaryBtn>
          </form>
        )}
      </Card>

      {/* Door 2: a code someone read to you */}
      <Card style={{ background: C.cream }}>
        <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.brown, margin: "0 0 6px" }}>
          {c.haveCodeLabel}
        </h2>
        <BodyText muted>{c.haveCodeHint}</BodyText>
        {joinError && (
          <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
            ⚠ {joinError}
          </BodyText>
        )}
        <form
          onSubmit={redeemCode}
          style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <label style={{ flex: "1 1 220px", fontSize: ts(A11Y.minBodyPx), fontWeight: 600 }}>
            {c.haveCodeField}
            {/* Digits stay LTR even under Urdu — it's a number read aloud. */}
            <input
              dir="ltr"
              inputMode="numeric"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="000 000"
              style={{ marginTop: 6, letterSpacing: "0.15em" }}
            />
          </label>
          <GhostBtn
            type="submit"
            disabled={joinBusy}
            style={{ borderColor: C.green, color: C.green }}
          >
            {c.haveCodeCta}
          </GhostBtn>
        </form>
      </Card>
    </FamScreen>
  );
}
