/* ════════════════════════════════════════════════
   Invite flow — three faces of ONE underlying token (SPEC.md, My
   Circle): send by email, read a 6-digit code aloud, or show a QR
   when you're in the same room. Single-use, 48-hour expiry, said in
   words on every face.

   Both directions live here: inviting someone, and — because a Fam
   member can sign up first — entering a code you were given to ask
   to join an Icon's circle (they approve with one tap).

   UI only; "sending" flips local state. The QR is a drawn placeholder,
   labeled as such — no QR library until the real token exists.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { FamScreen, Card, Pill, PrimaryBtn, GhostBtn, BodyText } from "./ui.jsx";
import { MOCK_INVITE, COPY } from "./famMock.js";

/* Deterministic decorative grid standing in for a real QR code. */
function QrPlaceholder() {
  const size = 13;
  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const corner =
        (x < 4 && y < 4) || (x >= size - 4 && y < 4) || (x < 4 && y >= size - 4);
      const on = corner
        ? x === 0 || y === 0 || x === 3 || y === 3 || (x % 4 < 3 && y % 4 < 3 && x % 2 === y % 2)
        : (x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0;
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={0.92} height={0.92} />);
    }
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR code placeholder"
      style={{ width: 180, height: 180, fill: C.dark, background: C.white, padding: 12, borderRadius: 12, border: `2px solid ${C.warmGray}` }}
    >
      {cells}
    </svg>
  );
}

function TabBtn({ active, onClick, children }) {
  const { ts } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: A11Y.minTapTargetPx,
        padding: "0 20px",
        borderRadius: 50,
        border: active ? `3px solid ${C.green}` : `1.5px solid ${C.warmGray}`,
        background: active ? C.white : "transparent",
        color: C.textMain,
        fontSize: ts(A11Y.minBodyPx),
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span aria-hidden="true" style={{ color: C.green, visibility: active ? "visible" : "hidden" }}>✓</span>
      {children}
    </button>
  );
}

export default function InviteFlow() {
  const { ts, meta } = useI18n();
  const c = COPY.invite;

  const [tab, setTab] = useState("email"); // email | code | qr
  const [email, setEmail] = useState("");
  const [emailSentTo, setEmailSentTo] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinSent, setJoinSent] = useState(false);

  const sendEmail = (e) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) return;
    setEmailSentTo(email); // mock — no request leaves the page
  };
  const sendJoin = (e) => {
    e.preventDefault();
    if (joinCode.replace(/\D/g, "").length !== 6) return;
    setJoinSent(true); // mock
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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <TabBtn active={tab === "email"} onClick={() => setTab("email")}>{c.tabEmail}</TabBtn>
        <TabBtn active={tab === "code"} onClick={() => setTab("code")}>{c.tabCode}</TabBtn>
        <TabBtn active={tab === "qr"} onClick={() => setTab("qr")}>{c.tabQr}</TabBtn>
      </div>

      {tab === "email" && (
        <Card>
          {emailSentTo ? (
            <BodyText role="status" style={{ fontWeight: 600, color: C.green, margin: 0 }}>
              ✓ {c.emailSent(emailSentTo)}
            </BodyText>
          ) : (
            <form onSubmit={sendEmail}>
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
              <PrimaryBtn type="submit">{c.emailCta}</PrimaryBtn>
            </form>
          )}
        </Card>
      )}

      {tab === "code" && (
        <Card style={{ textAlign: "center" }}>
          <BodyText muted>{c.codeHint}</BodyText>
          {/* Digits stay LTR even under Urdu — it's a number read aloud. */}
          <p
            dir="ltr"
            style={{
              fontFamily: meta.fonts.heading,
              fontSize: ts(52),
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: C.green,
              margin: "12px 0",
            }}
          >
            {MOCK_INVITE.code}
          </p>
          <Pill>⏳ {c.codeExpiry}</Pill>
        </Card>
      )}

      {tab === "qr" && (
        <Card style={{ textAlign: "center" }}>
          <BodyText muted>{c.qrHint}</BodyText>
          <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
            <QrPlaceholder />
          </div>
          <Pill>🚧 {c.qrPlaceholderNote}</Pill>
          <div style={{ marginTop: 12 }}>
            <Pill>⏳ {c.codeExpiry}</Pill>
          </div>
        </Card>
      )}

      {/* The other direction: a code someone read to you */}
      <Card style={{ background: C.cream }}>
        <h2 style={{ fontSize: ts(22), fontWeight: 700, color: C.brown, margin: "0 0 6px" }}>
          {c.haveCodeLabel}
        </h2>
        <BodyText muted>{c.haveCodeHint}</BodyText>
        {joinSent ? (
          <BodyText role="status" style={{ fontWeight: 600, color: C.green, margin: 0 }}>
            ✓ {c.haveCodeSent}
          </BodyText>
        ) : (
          <form onSubmit={sendJoin} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ flex: "1 1 220px", fontSize: ts(A11Y.minBodyPx), fontWeight: 600 }}>
              {c.haveCodeField}
              <input
                dir="ltr"
                inputMode="numeric"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="000 000"
                style={{ marginTop: 6, letterSpacing: "0.15em" }}
              />
            </label>
            <GhostBtn type="submit" style={{ borderColor: C.green, color: C.green }}>
              {c.haveCodeCta}
            </GhostBtn>
          </form>
        )}
      </Card>
    </FamScreen>
  );
}
