/* ════════════════════════════════════════════════
   Starting a group — GROUPS_SPEC §1. Four screens, one question each.

   Screen 1  What kind of group?      six tiles, or "Something else"
   Screen 2  What's it called?        one field
   Screen 3  Who can join?            consequences, not labels
   Screen 4  Ask a few people in      or skip

   WHAT IS DELIBERATELY NOT HERE: cover photo and description. §1 —
   older users abandon at the photo step, and a group that doesn't
   exist is worse than one without a picture. Both become a dismissible
   "Finish setting up" row inside the group afterwards.

   THE TYPE IS NOT DECORATION (§1). Choosing one pre-fills the
   description, gives a default cover, and seeds the first post — "We
   walk on ___ at ___, meeting at ___" — so the group is not empty when
   the first person arrives. "Something else" keeps the escape: a blank
   path where they write it themselves.

   Screen 3's wording is the one that matters. Not "Public / Private",
   which people guess at — the consequence of each choice, in words:
   "Shows up in search. People join themselves." against "Hidden. You
   approve each person." A person choosing wrongly here is the §4 leak
   with a human cause instead of a technical one.

   LANDING: Make the group lands you INSIDE the group. AUDIT_11 records
   that this already navigated correctly and that the toast beside it
   was redundant — the toast is gone, the navigation stays.
   ════════════════════════════════════════════════ */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { createGroup, inviteToGroup, seedWelcome } from "./groupsStore.js";
import { STRINGS } from "./groupsCopy.js";
import PeoplePicker from "../games/PeoplePicker.jsx";
import { Screen, Card, H1, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";

/* The six types. `seed` is the first post's shape — a group whose
   pinned post says who we are and when we meet is the difference
   between one that survives and one that dies in a week (§8). */
export const GROUP_TYPES = ["walking", "chai", "books", "family", "gardening", "other"];

export default function CreateGroup() {
  const { t, ts, lang, meta } = useI18n();
  const s = STRINGS[lang] || STRINGS.en;
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [type, setType] = useState(null);
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState(null);
  const [invitees, setInvitees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = 4;

  const make = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const id = await createGroup(name, type && type !== "other" ? t(`groups.type.${type}.desc`) : null, privacy);
      /* One refusal must not strand the group: it exists, and anyone
         who could not be asked can be asked from inside it. */
      for (const p of invitees) {
        try { await inviteToGroup(id, p.id); } catch { /* they simply were not asked */ }
      }
      /* §1/§8 — seed the first post and pin it. "A group with a
         pinned who-we-are-and-when-we-meet is the difference between
         one that survives and one that dies in a week." The type
         chosen on screen 1 is what makes this writable without asking
         another question: a walking group gets a walking welcome.

         Best effort on purpose. If it fails the group still exists and
         the owner can write their own — a missing welcome post is a
         smaller loss than a creation flow that errors at the end. */
      try {
        const body = type && type !== "other" ? t(`groups.welcome.${type}`, { name }) : null;
        if (body) await seedWelcome(id, body);
      } catch { /* the group is made; the welcome is a bonus */ }

      /* No toast. AUDIT_11: redundant beside a navigation that already
         lands you on the result. */
      navigate(`/app/groups/${id}`, { replace: true });
    } catch (e) {
      setBusy(false);
      setError(/Saath-Icon/.test(String(e?.message)) ? s.errIconOnly || s.errGeneric : s.errGeneric);
    }
  };

  const tile = (active) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
    minHeight: 96,
    padding: "14px 16px",
    borderRadius: 18,
    border: active ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
    background: active ? "#EEF3E8" : C.white,
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
  });

  const choice = (active) => ({
    display: "block",
    width: "100%",
    padding: "16px 18px",
    marginBottom: 12,
    borderRadius: 18,
    border: active ? `3px solid ${C.green}` : `2px solid ${C.warmGray}`,
    background: active ? "#EEF3E8" : C.white,
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
  });

  const back = () => (step > 1 ? setStep(step - 1) : navigate("/app/groups"));

  return (
    <Screen backTo="/app/groups" backLabel={s.cancel}>
      {/* §1: back at each step. Screen's own back leaves the flow;
          this one steps back through it, and only appears once there
          is a step to go back to. */}
      {step > 1 && (
        <button
          type="button"
          onClick={back}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: A11Y.minTapTargetPx,
            background: "none",
            border: "none",
            padding: 0,
            marginBottom: 6,
            color: C.brown,
            fontFamily: "inherit",
            fontSize: ts(A11Y.minBodyPx),
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {meta.dir === "rtl" ? "→" : "←"} {t("groups.new.back")}
        </button>
      )}
      {/* A thin progress line, not a step counter shouting 2/4. */}
      <div aria-hidden="true" style={{ height: 4, background: C.warmGray, borderRadius: 4, marginBottom: 18 }}>
        <div style={{ height: 4, width: `${(step / total) * 100}%`, background: C.green, borderRadius: 4, transition: "width .2s" }} />
      </div>

      {error && (
        <BodyText role="alert" style={{ color: C.error, fontWeight: 700 }}>{error}</BodyText>
      )}

      {step === 1 && (
        <section data-step="type">
          <H1>{t("groups.new.typeTitle")}</H1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            {GROUP_TYPES.map((k) => (
              <button
                key={k}
                type="button"
                data-type={k}
                onClick={() => { setType(k); setStep(2); }}
                style={tile(type === k)}
              >
                <span aria-hidden="true" style={{ fontSize: 28 }}>{t(`groups.type.${k}.emoji`)}</span>
                <span style={{ fontSize: ts(A11Y.minBodyPx), fontWeight: 700, color: C.textMain }}>
                  {t(`groups.type.${k}.name`)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section data-step="name">
          <H1>{t("groups.new.nameTitle")}</H1>
          <BodyText muted>{t("groups.new.nameSub")}</BodyText>
          <Card>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("groups.new.namePh")}
              maxLength={80}
              autoFocus
              dir={meta.dir}
              style={{ width: "100%", minHeight: A11Y.minTapTargetPx, fontSize: ts(A11Y.minBodyPx) }}
            />
          </Card>
          <PrimaryBtn disabled={!name.trim()} onClick={() => setStep(3)} style={{ width: "100%" }}>
            {t("groups.new.next")}
          </PrimaryBtn>
        </section>
      )}

      {step === 3 && (
        <section data-step="privacy">
          <H1>{t("groups.new.privacyTitle")}</H1>
          {/* Consequences, not labels (§1 screen 3). */}
          {[
            ["anyone", "groups.new.anyoneName", "groups.new.anyoneWhat"],
            ["invite_only", "groups.new.inviteName", "groups.new.inviteWhat"],
          ].map(([key, nameKey, whatKey]) => (
            <button
              key={key}
              type="button"
              data-privacy={key}
              onClick={() => { setPrivacy(key); setStep(4); }}
              style={choice(privacy === key)}
            >
              <span style={{ display: "block", fontSize: ts(20), fontWeight: 700, color: C.textMain }}>
                {t(nameKey)}
              </span>
              <span style={{ display: "block", fontSize: ts(A11Y.minBodyPx), color: C.textMuted, marginTop: 4 }}>
                {t(whatKey)}
              </span>
            </button>
          ))}
        </section>
      )}

      {step === 4 && (
        <section data-step="invite">
          <H1>{t("groups.new.inviteTitle")}</H1>
          <BodyText muted>{t("groups.new.inviteSub")}</BodyText>
          <PeoplePicker
            searchable
            pickedCount={invitees.length}
            states={Object.fromEntries(invitees.map((p) => [p.id, "picked"]))}
            onToggle={(person) =>
              setInvitees((cur) =>
                cur.some((x) => x.id === person.id)
                  ? cur.filter((x) => x.id !== person.id)
                  : [...cur, person]
              )
            }
          />
          <PrimaryBtn onClick={make} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
            {busy ? t("groups.new.making") : t("groups.new.make")}
          </PrimaryBtn>
          {/* A group with one person is fine. A group nobody finished
              making is not. (§1 screen 4) */}
          <GhostBtn onClick={make} disabled={busy} style={{ width: "100%", marginTop: 10 }}>
            {t("groups.new.skip")}
          </GhostBtn>
        </section>
      )}
    </Screen>
  );
}
