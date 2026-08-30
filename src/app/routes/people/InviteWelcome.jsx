/* ════════════════════════════════════════════════
   The banner an invited person meets on the inviter's profile.

   PRODUCT_DECISIONS §7: "The recipient taps it, signs up, and lands on
   the inviter's profile, where they choose to connect. NEVER
   AUTO-CONNECTED."

   So this is the screen where the choosing happens, and everything
   about it is built to make the choice real:

   - it names who invited them, because a button called "Connect" over
     a stranger's face is not a choice, it is a reflex;
   - it says plainly that nothing has happened yet;
   - it says "and you don't have to", because an invitation from
     someone you know is exactly the situation where a person feels
     they must;
   - the button says which of the two things it will do — connect, or
     ask — so the difference between a personal and a group link is
     visible before the tap, not discovered after it.

   It re-reads the invitation from the server rather than trusting the
   query string: a code typed into the URL bar can claim to be personal
   and the label must not lie. The RPC decides the outcome regardless,
   so the worst a tampered URL earns is a button that says the wrong
   word — but saying the right word is the entire job of this banner.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Card, BodyText, PrimaryBtn } from "../circle/ui.jsx";
import { openInvite, acceptInvite } from "../../lib/invites.js";

export default function InviteWelcome({ code, personId, personName, onConnected }) {
  const { t, ts } = useI18n();
  const [invite, setInvite] = useState(undefined); // undefined = loading, null = not shown
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await openInvite(code);
        if (dead) return;
        /* An invitation that is spent, expired, or points at somebody
           else is simply not this screen's business: the profile below
           is a perfectly good page on its own. */
        setInvite(r.result === "ok" && r.inviter_id === personId ? r : null);
      } catch {
        if (!dead) setInvite(null);
      }
    })();
    return () => { dead = true; };
  }, [code, personId]);

  if (invite === undefined || invite === null) return null;

  const first = (invite.inviter_name || personName || "").trim().split(" ")[0];
  const personal = invite.kind === "personal";

  const act = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await acceptInvite(code);
      if (r === "connected") {
        setOutcome("people.invited.connected");
        onConnected?.();
      } else if (r === "requested") {
        setOutcome("people.invited.requested");
      } else {
        setError("people.invited.gone");
      }
    } catch {
      setError("people.invited.error");
    }
    setBusy(false);
  };

  return (
    <Card style={{ borderColor: C.green, borderWidth: 3 }}>
      <p style={{ fontSize: ts(22), fontWeight: 700, color: C.green, margin: "0 0 8px" }}>
        🌸 {t("people.invited.heading", { name: first })}
      </p>

      {outcome ? (
        <BodyText role="status" style={{ margin: 0, fontWeight: 600, color: C.green }}>
          ✓ {t(outcome, { name: first })}
        </BodyText>
      ) : invite.connected ? (
        <BodyText muted style={{ margin: 0 }}>{t("people.invited.already")}</BodyText>
      ) : (
        <>
          <BodyText style={{ marginTop: 0 }}>
            {t(personal ? "people.invited.personalBody" : "people.invited.groupBody", {
              name: first,
            })}
          </BodyText>
          {error && (
            <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
              ⚠ {t(error)}
            </BodyText>
          )}
          <PrimaryBtn onClick={act} disabled={busy}>
            {personal
              ? `🤝 ${t("people.invited.connectCta", { name: first })}`
              : `✉️ ${t("people.invited.askCta")}`}
          </PrimaryBtn>
        </>
      )}
    </Card>
  );
}
