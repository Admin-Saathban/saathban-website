/* ════════════════════════════════════════════════
   The family group, on the Fam member's home.

   PRODUCT_DECISIONS §10: "They form a family group — all the Fam plus
   the Icon, in one place. THERE IS NO HIDDEN CHANNEL. Children
   coordinating about their parent behind their back is exactly what,
   discovered later, feels like betrayal."

   So the card says who is in it, out loud, with the Icon named. Not as
   a warning — as the ordinary description of a room that has her in
   it. A family member who wanted a private channel should find out
   here, in one line, rather than after typing something.

   The rule is kept by 0072, not by this card: a trigger refuses to
   remove the Icon from their own family group whatever asks. This is
   the honest label on a lock that already holds.

   §10 also puts the group's NEWEST MESSAGE among the things a Fam
   member opens the app for — "the family group's newest message" is on
   its list of things to react to. So the card carries the message
   itself rather than a badge saying there is one.

   It is absent, not empty, until there are two Fam members: "several
   Fam around one Icon" is the situation §10 wrote it for, and with one
   it would be a second name for a conversation they already have. The
   RPC returns null then, and null renders nothing.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import supabase from "../../lib/supabase.js";
import { Card, BodyText } from "./ui.jsx";

export default function FamilyGroup({ iconId, iconName }) {
  const { t, ts } = useI18n();
  const [group, setGroup] = useState(undefined); // undefined = loading, null = none

  useEffect(() => {
    if (!iconId) return undefined;
    let dead = false;
    (async () => {
      try {
        const { data: groupId, error } = await supabase.rpc("ensure_family_group", {
          p_icon: iconId,
        });
        if (dead) return;
        if (error || !groupId) {
          setGroup(null);
          return;
        }
        const [{ data: rows }, { count }] = await Promise.all([
          supabase
            .from("group_messages")
            .select("id, body, created_at, sender_id")
            .eq("group_id", groupId)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("group_members")
            .select("member_id", { count: "exact", head: true })
            .eq("group_id", groupId),
        ]);
        const newest = (rows || [])[0] || null;
        let sender = "";
        if (newest) {
          const { data: p } = await supabase
            .from("safe_profiles")
            .select("full_name")
            .eq("id", newest.sender_id)
            .maybeSingle();
          sender = (p?.full_name || "").split(" ")[0];
        }
        if (!dead) setGroup({ id: groupId, newest, sender, members: count || 0 });
      } catch {
        /* A group that will not load must cost the home nothing. */
        if (!dead) setGroup(null);
      }
    })();
    return () => { dead = true; };
  }, [iconId]);

  if (!group) return null;

  const body = (group.newest?.body || "").trim();
  const preview = body.length > 90 ? `${body.slice(0, 90)}…` : body;

  return (
    <Card>
      <p style={{ fontSize: ts(20), fontWeight: 700, color: C.textMain, margin: "0 0 4px" }}>
        🏡 {t("fam.group.title")}
      </p>
      {/* The Icon is named as a member. This is the whole point. */}
      <BodyText muted style={{ margin: "0 0 10px", fontSize: ts(16) }}>
        {t("fam.group.whoIsIn", { name: iconName, n: group.members })}
      </BodyText>

      {group.newest ? (
        <p
          style={{
            margin: "0 0 12px",
            padding: "10px 14px",
            borderRadius: 12,
            background: C.cream,
            fontSize: ts(A11Y.minBodyPx),
            color: C.textMain,
          }}
        >
          <strong style={{ color: C.green }}>{group.sender}</strong>
          {preview ? `: ${preview}` : ` · ${t("fam.group.sharedSomething")}`}
        </p>
      ) : (
        <BodyText muted style={{ margin: "0 0 12px" }}>{t("fam.group.quiet")}</BodyText>
      )}

      <Link
        to={`/app/groups/${group.id}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: A11Y.minTapTargetPx,
          padding: "0 24px",
          borderRadius: 50,
          border: `2px solid ${C.green}`,
          color: C.green,
          background: C.white,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {t("fam.group.openCta")}
      </Link>
    </Card>
  );
}
