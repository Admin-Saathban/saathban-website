/* ════════════════════════════════════════════════
   A person's profile, seen from inside a connection: their public
   (safe_profiles) fields, when the circle connection began, and the
   permissions the membership carries — worded from whichever side the
   viewer stands on. Nothing here shows data the membership doesn't
   grant; RLS would return nothing anyway.

   The Message button opens the DM thread (0019: circle pairs are
   already trusted, so no request dance between them).
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { Card, SectionLabel, BodyText, Pill, PrimaryBtn, GhostBtn } from "../circle/ui.jsx";
import { fetchPerson, fetchMembershipsWith, openDmWith } from "./peopleStore.js";

const PERM_ROWS = [
  ["can_see_mood", "people.perms.mood"],
  ["can_see_health", "people.perms.health"],
  ["can_manage_reminders", "people.perms.reminders"],
  ["is_sos_contact", "people.perms.sos"],
];

function PermissionList({ membership }) {
  const { t, ts } = useI18n();
  return (
    <div>
      {PERM_ROWS.map(([field, labelKey]) => {
        const on = !!membership[field];
        return (
          <div
            key={field}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderTop: `1px solid ${C.warmGray}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{ fontSize: ts(18), fontWeight: 700, color: on ? C.green : C.textMuted, width: 24, textAlign: "center" }}
            >
              {on ? "✓" : "—"}
            </span>
            <BodyText style={{ margin: 0, flex: 1 }}>{t(labelKey)}</BodyText>
            <BodyText muted style={{ margin: 0, fontSize: ts(18), fontWeight: 600 }}>
              {on ? t("circle.toggle.on") : t("circle.toggle.off")}
            </BodyText>
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 0",
          borderTop: `1px solid ${C.warmGray}`,
        }}
      >
        <span aria-hidden="true" style={{ width: 24, textAlign: "center", color: C.textMuted }}>📍</span>
        <BodyText style={{ margin: 0, flex: 1 }}>{t("people.perms.location")}</BodyText>
        <BodyText muted style={{ margin: 0, fontSize: ts(18), fontWeight: 600 }}>
          {membership.location_access === "sos_only"
            ? t("circle.perms.location.sosOnly")
            : t("circle.perms.location.never")}
        </BodyText>
      </div>
    </div>
  );
}

export default function PersonPage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { t, ts, lang, meta } = useI18n();
  const { profile } = useSession();
  const myId = profile?.id;

  const [person, setPerson] = useState(undefined); // undefined = loading
  const [memberships, setMemberships] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, m] = await Promise.all([
          fetchPerson(profileId),
          fetchMembershipsWith(profileId).catch(() => []),
        ]);
        if (cancelled) return;
        setPerson(p);
        setMemberships(m);
      } catch {
        if (!cancelled) {
          setPerson(null);
          setError("people.profile.loadError");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const message = async () => {
    setBusy(true);
    setError("");
    try {
      await openDmWith(profileId);
      navigate("chat");
    } catch (err) {
      setError(err.message || "people.profile.loadError");
      setBusy(false);
    }
  };

  if (person === undefined) {
    return <BodyText muted role="status">···</BodyText>;
  }
  if (!person) {
    return (
      <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
        ⚠ {t(error || "people.profile.loadError")}
      </BodyText>
    );
  }

  const first = person.full_name.split(" ")[0];
  // The row where I'm the Icon (what they can see of my day), and the
  // row where they are (what I can see of theirs).
  const asIcon = memberships.find((m) => m.icon_id === myId && m.member_id === person.id);
  const asMember = memberships.find((m) => m.icon_id === person.id && m.member_id === myId);
  const since = (asIcon || asMember)?.created_at;
  const dateLocale = lang === "ur" ? "ur-PK" : "en-GB";

  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: C.sage,
              color: C.cream,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: ts(30),
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {person.full_name.trim().charAt(0)}
          </span>
          <div style={{ flex: "1 1 200px" }}>
            <h1
              style={{
                fontFamily: meta.fonts.heading,
                fontSize: ts(28),
                fontWeight: 700,
                color: C.green,
                margin: 0,
              }}
            >
              {person.full_name}
            </h1>
            {person.city && (
              <BodyText muted style={{ margin: "2px 0 0" }}>
                {person.city}
              </BodyText>
            )}
            {person.is_org && <Pill tone="green">🏡 Saathban</Pill>}
          </div>
        </div>

        {since && (
          <BodyText muted style={{ margin: "14px 0 0" }}>
            🤝{" "}
            {t("people.profile.connectedSince", {
              date: new Date(since).toLocaleDateString(dateLocale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </BodyText>
        )}
        {!since && (
          <BodyText muted style={{ margin: "14px 0 0" }}>
            {t("people.profile.noCircle")}
          </BodyText>
        )}

        {error && (
          <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
            ⚠ {t(error)}
          </BodyText>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
          <PrimaryBtn onClick={message} disabled={busy}>
            💬 {t("people.profile.messageCta")}
          </PrimaryBtn>
          {asIcon && (
            <Link
              to="/app/circle"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: A11Y.minTapTargetPx,
                padding: "0 20px",
                borderRadius: 50,
                border: `2px solid ${C.warmGray}`,
                color: C.textMain,
                background: C.white,
                fontSize: ts(A11Y.minBodyPx),
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {t("people.profile.manageCta")}
            </Link>
          )}
        </div>
      </Card>

      {asIcon && (
        <>
          <SectionLabel>{t("people.profile.canSeeTitleIcon", { name: first })}</SectionLabel>
          <Card>
            <PermissionList membership={asIcon} />
          </Card>
        </>
      )}

      {asMember && (
        <>
          <SectionLabel>{t("people.profile.canSeeTitleMember", { name: first })}</SectionLabel>
          <Card>
            <PermissionList membership={asMember} />
          </Card>
        </>
      )}
    </>
  );
}
