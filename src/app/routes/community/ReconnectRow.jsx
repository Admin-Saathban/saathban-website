/* ════════════════════════════════════════════════
   The reconnect row — NAVIGATION_SPEC.md §4.3, on screen.

   Photo, name, city, and one sentence: she is around today. Two
   actions and an X.

   THE SENTENCE IS THE WHOLE DESIGN. §4.3 spends most of its words on
   what this row must never say — how long it has been, that either
   person has been quiet, anything implying neglect — because the
   obvious version of this feature is a guilt trip with a photo on it.
   So the only fact stated is a present-tense one about today, and the
   selection rule that got her here (quiet a fortnight) is never
   rendered. See reconnect.js.

   ONE DELIBERATE DEPARTURE FROM THE SPEC'S WORDING. §4.3 writes the
   line as "she's around today". The app does not know anybody's
   pronouns — profiles carry a name, not a gender — so shipping "she"
   would misgender people on a screen whose entire job is warmth. The
   line uses the person's name instead, which is what the spec's own
   example is reaching for and is correct for every reader.

   No presence ring on the avatar. The sentence already says she is
   around, and a ring would be the same fact told twice in colour —
   which the accessibility rule (never colour alone) would then require
   the sentence to carry anyway.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import Avatar from "../messages/Avatar.jsx";
import { Card, BodyText, PrimaryBtn, GhostBtn } from "./ui.jsx";

export default function ReconnectRow({ person, onHello, onPlay, onDismiss }) {
  const { t, meta } = useI18n();
  if (!person) return null;

  const name = (person.full_name || "").trim();
  const first = name.split(" ")[0] || name;

  return (
    <Card
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 14,
      }}
    >
      <Avatar person={person} size={52} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 17, color: C.textMain }}>{name}</div>
        {person.city ? (
          <BodyText muted style={{ fontSize: 15, margin: "2px 0 0" }}>
            {person.city}
          </BodyText>
        ) : null}

        {/* The one sentence. Present tense, no duration, no comparison. */}
        <BodyText style={{ fontSize: 16, margin: "6px 0 12px" }}>
          {t("community.feed.reconnect.around", { name: first })}
        </BodyText>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PrimaryBtn onClick={onHello} style={{ flex: "0 1 auto" }}>
            {t("community.feed.reconnect.hello")}
          </PrimaryBtn>
          {/* Rendered only when there is somewhere real to go. POSTS_SPEC
              §9.2 says tapping a game holds her seat, sends the invite
              and lands you on the board — "no menu, no confirm step" — so
              a button that opened a game list would be the opposite of
              the spec rather than a smaller version of it. Absent beats
              dead. */}
          {onPlay ? (
            <GhostBtn onClick={onPlay} style={{ flex: "0 1 auto" }}>
              {t("community.feed.reconnect.play")}
            </GhostBtn>
          ) : null}
        </div>
      </div>

      {/* The X. Removes this person for a month (§4.3) — not the row, and
          nobody is told. Sized to the tap-target minimum rather than to
          the glyph, because a dismissal a thumb keeps missing is a row
          that cannot be escaped. */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("community.feed.reconnect.dismissLabel", { name: first })}
        style={{
          flex: "0 0 auto",
          minWidth: A11Y.minTapTargetPx,
          minHeight: A11Y.minTapTargetPx,
          border: "none",
          background: "transparent",
          color: C.textMuted,
          fontSize: 20,
          lineHeight: 1,
          cursor: "pointer",
          borderRadius: 10,
          marginInlineStart: meta.dir === "rtl" ? 0 : -4,
        }}
      >
        ✕
      </button>
    </Card>
  );
}
