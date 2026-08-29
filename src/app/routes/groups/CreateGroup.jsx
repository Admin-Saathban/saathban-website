/* ════════════════════════════════════════════════
   Start a group — name + optional description. No admin approval; the
   creator becomes the first member (create_group RPC, Icon-only).
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { pushToast } from "../../lib/feedback.jsx";
import { Screen, H1, Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";
import { STRINGS } from "./groupsCopy.js";
import { createGroup } from "./groupsStore.js";

export default function CreateGroup() {
  const { lang, ts } = useI18n();
  const s = (STRINGS[lang] || STRINGS.en).create;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return; // no double-created groups
    if (!name.trim()) return setError(s.errName);
    setBusy(true);
    setError("");
    try {
      const id = await createGroup(name, desc);
      pushToast(s.createdToast || "✓", { tone: "success" });
      navigate(`/app/groups/${id}`, { replace: true });
    } catch {
      setBusy(false);
      setError(s.errGeneric);
      pushToast(s.errGeneric, { tone: "error" });
    }
  };

  const label = { display: "block", fontSize: ts(A11Y.minBodyPx), fontWeight: 600, marginBottom: 16 };

  return (
    <Screen backTo="/app/groups" backLabel={s.cancel}>
      <H1>{s.title}</H1>
      <BodyText muted>{s.intro}</BodyText>
      {error && <BodyText role="alert" style={{ color: C.error, fontWeight: 600 }}>{error}</BodyText>}
      <Card>
        <form onSubmit={submit}>
          <label style={label}>
            {s.nameLabel}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={s.namePh} maxLength={80} autoFocus style={{ marginTop: 6 }} />
          </label>
          <label style={label}>
            {s.descLabel}
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={s.descPh} rows={3} maxLength={500} style={{ marginTop: 6, resize: "vertical" }} />
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <PrimaryBtn type="submit" disabled={busy}>{busy ? s.creating : s.createCta}</PrimaryBtn>
            <GhostBtn onClick={() => navigate("/app/groups")}>{s.cancel}</GhostBtn>
          </div>
        </form>
      </Card>
    </Screen>
  );
}
