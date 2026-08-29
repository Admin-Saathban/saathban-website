/* ════════════════════════════════════════════════
   Milestone messages — the admin hook (SPEC.md: "Admins can attach a
   personalized message to any milestone, so a human at Saathban
   congratulates the Icon by name").

   Recent awards across everyone; attaching a note goes through the
   attach_milestone_message() RPC, which writes it onto the award,
   delivers it as a 'milestone' notification, and audit-logs the
   contact. Reachable only via the admin tab; RLS keeps non-admins
   from reading other people's awards regardless.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  fetchBadgeDefinitions,
  adminFetchRecentAwards,
  adminAttachMilestoneMessage,
} from "../../lib/points.js";
import { Card, PrimaryBtn, GhostBtn, BodyText, inputStyle } from "./ui.jsx";

export default function AdminMilestones() {
  const { t, ts, meta } = useI18n();
  const k = (key) => t(`milestones.admin.${key}`);

  const [awards, setAwards] = useState(null);
  const [defs, setDefs] = useState([]);
  const [writingFor, setWritingFor] = useState(null); // earned_badge id
  const [draft, setDraft] = useState("");
  const [sentFor, setSentFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [a, d] = await Promise.all([adminFetchRecentAwards(), fetchBadgeDefinitions()]);
    setAwards(a);
    setDefs(d);
  };

  useEffect(() => {
    load().catch(() => {
      setError("milestones.loadError");
      setAwards([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defByKey = Object.fromEntries(defs.map((d) => [d.key, d]));

  const send = async (id) => {
    if (draft.trim().length < 5) return;
    setBusy(true);
    setError("");
    try {
      await adminAttachMilestoneMessage(id, draft.trim());
      setWritingFor(null);
      setDraft("");
      setSentFor(id);
      await load();
    } catch (err) {
      setError(err.message || "milestones.admin.error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1
        style={{
          fontFamily: meta.fonts.heading,
          fontSize: ts(32),
          fontWeight: 700,
          color: C.green,
          margin: "12px 0 8px",
        }}
      >
        {k("title")}
      </h1>
      <BodyText muted>{k("intro")}</BodyText>

      {error && (
        <BodyText role="alert" style={{ fontWeight: 700, color: C.brown }}>
          ⚠ {t(error)}
        </BodyText>
      )}

      {awards === null ? (
        <BodyText muted role="status">…</BodyText>
      ) : awards.length === 0 ? (
        <BodyText muted>{k("empty")}</BodyText>
      ) : (
        awards.map((a) => {
          const b = defByKey[a.badge_key];
          return (
            <Card key={a.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <span aria-hidden="true" style={{ fontSize: ts(28), lineHeight: 1 }}>
                  {b?.emoji || "🏅"}
                </span>
                <div style={{ flex: "1 1 220px" }}>
                  <BodyText style={{ fontWeight: 700, margin: 0 }}>
                    {a.profile?.full_name || "—"}
                    <span style={{ fontWeight: 400, color: C.textMuted }}>
                      {" "}· {b ? b.name_en : a.badge_key}
                    </span>
                  </BodyText>
                  <BodyText muted style={{ margin: "2px 0 0", fontSize: ts(16) }}>
                    {new Date(a.earned_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                    })}
                  </BodyText>
                  {a.message && (
                    <BodyText muted style={{ margin: "8px 0 0", fontSize: ts(18) }}>
                      💌{" "}
                      {t("milestones.admin.alreadySent", {
                        date: new Date(a.message_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                        }),
                      })}
                      : “{a.message}”
                    </BodyText>
                  )}
                  {sentFor === a.id && (
                    <BodyText role="status" style={{ margin: "8px 0 0", fontWeight: 700, color: C.green }}>
                      ✓ {k("sentNote")}
                    </BodyText>
                  )}
                </div>
                {!a.message && writingFor !== a.id && (
                  <GhostBtn onClick={() => { setWritingFor(a.id); setDraft(""); setSentFor(null); }}>
                    💌 {k("attachCta")}
                  </GhostBtn>
                )}
              </div>

              {writingFor === a.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(a.id);
                  }}
                  style={{ marginTop: 14 }}
                >
                  <label style={{ display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600 }}>
                    {k("attachCta")}
                    <textarea
                      autoFocus
                      rows={3}
                      value={draft}
                      placeholder={k("placeholder")}
                      onChange={(e) => setDraft(e.target.value)}
                      style={{ ...inputStyle(ts), resize: "vertical" }}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <PrimaryBtn type="submit" disabled={busy || draft.trim().length < 5}>
                      {k("sendCta")}
                    </PrimaryBtn>
                    <GhostBtn onClick={() => setWritingFor(null)}>{k("cancelCta")}</GhostBtn>
                  </div>
                </form>
              )}
            </Card>
          );
        })
      )}
    </>
  );
}
