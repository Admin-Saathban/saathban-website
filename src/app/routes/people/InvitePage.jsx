/* ════════════════════════════════════════════════
   Invite someone — /app/people/invite

   PRODUCT_DECISIONS §7: "Personal invite links from People and the
   Friends filter: a link plus a ready message for WhatsApp."

   Two cards, because there are two honest situations and they deserve
   different answers. A link sent to one person is evidence the sender
   chose them, so their tap connects. A link dropped into a family
   group is evidence of nothing, so a tap only asks. The copy says
   which is which in plain words rather than leaving the person to
   discover it afterwards.

   The ready message is prepared for them because the hardest part of
   inviting somebody is not the link, it is writing the sentence.

   §7: "No rewards for inviting. A warm acknowledgement only." There is
   no counter on this screen, no total, nothing to grow. One thank-you
   after they share, and that is the whole of it.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Card, SectionLabel, BodyText, PrimaryBtn, GhostBtn } from "../circle/ui.jsx";
import { createInviteLink, inviteUrl, shareInvite, whatsappHref } from "../../lib/invites.js";

export default function InvitePage() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const firstName = (profile?.full_name || "").trim().split(" ")[0];

  const [busy, setBusy] = useState("");        // "" | "personal" | "group"
  const [links, setLinks] = useState({});      // { personal?: code, group?: code }
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const readyMsg = t("people.invite.readyMsg", { name: firstName });

  const make = async (kind) => {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      const code = await createInviteLink(kind);
      setLinks((prev) => ({ ...prev, [kind]: code }));
    } catch (err) {
      /* The server's own ceiling, in its own words — a full day of
         inviting is not a failure and must not read like one. */
      setError(/plenty of invitations/i.test(String(err?.message))
        ? "people.invite.tooMany"
        : "people.invite.error");
    }
    setBusy("");
  };

  const share = async (code) => {
    const how = await shareInvite({
      code,
      title: t("people.invite.title"),
      text: readyMsg,
    });
    if (how === "cancelled") return;            // dismissing a sheet is not an event
    setError("");
    setNotice(
      how === "shared" ? "people.invite.shared"
        : how === "copied" ? "people.invite.copied"
        : "people.invite.unavailable"
    );
  };

  const LinkBlock = ({ code }) => (
    <div style={{ marginTop: 14 }}>
      <SectionLabel>{t("people.invite.linkLabel")}</SectionLabel>
      {/* Selectable and wrapping: when the share sheet and the clipboard
          both fail, reading it off the screen is the last honest way
          out, so it must never be truncated. */}
      <p
        dir="ltr"
        style={{
          margin: "6px 0 0",
          padding: "10px 12px",
          borderRadius: 10,
          background: C.cream,
          border: `2px solid ${C.warmGray}`,
          fontSize: ts(16),
          color: C.textMain,
          wordBreak: "break-all",
          userSelect: "all",
          textAlign: "left",
        }}
      >
        {inviteUrl(code)}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <a
          href={whatsappHref(readyMsg, code)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: A11Y.minTapTargetPx,
            padding: "0 20px",
            borderRadius: 50,
            background: C.green,
            color: C.cream,
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          💬 {t("people.invite.whatsappCta")}
        </a>
        <GhostBtn onClick={() => share(code)}>📤 {t("people.invite.shareCta")}</GhostBtn>
      </div>

      <BodyText muted style={{ margin: "12px 0 0", fontStyle: "italic" }}>
        “{readyMsg}”
      </BodyText>
    </div>
  );

  return (
    <>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(30),
          fontWeight: 700,
          color: C.green,
          margin: "4px 0 6px",
        }}
      >
        {t("people.invite.title")}
      </h1>
      <BodyText muted style={{ marginBottom: 16 }}>{t("people.invite.intro")}</BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}
      {notice && (
        <BodyText role="status" style={{ color: C.green, fontWeight: 600 }}>
          ✓ {t(notice)}
        </BodyText>
      )}

      <Card>
        <p style={{ fontSize: ts(21), fontWeight: 700, color: C.textMain, margin: "0 0 6px" }}>
          {t("people.invite.oneTitle")}
        </p>
        <BodyText style={{ marginTop: 0 }}>{t("people.invite.oneBody")}</BodyText>
        <PrimaryBtn onClick={() => make("personal")} disabled={busy === "personal"}>
          {links.personal ? t("people.invite.newOne") : t("people.invite.oneCta")}
        </PrimaryBtn>
        {links.personal && <LinkBlock code={links.personal} />}
      </Card>

      <Card>
        <p style={{ fontSize: ts(21), fontWeight: 700, color: C.textMain, margin: "0 0 6px" }}>
          {t("people.invite.groupTitle")}
        </p>
        <BodyText style={{ marginTop: 0 }}>{t("people.invite.groupBody")}</BodyText>
        {!links.group && (
          <PrimaryBtn onClick={() => make("group")} disabled={busy === "group"}>
            {t("people.invite.groupCta")}
          </PrimaryBtn>
        )}
        {links.group && <LinkBlock code={links.group} />}
      </Card>

      {(links.personal || links.group) && (
        <BodyText muted style={{ textAlign: "center", marginTop: 18 }}>
          {t("people.invite.warm")}
        </BodyText>
      )}
    </>
  );
}
