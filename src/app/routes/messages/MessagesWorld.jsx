/* ════════════════════════════════════════════════
   Messages — an app inside the app (MESSAGES_SPEC.md §1, §2).

   IT IS AN OVERLAY, NOT A PAGE, and that is the whole trick. §1 says
   backing out returns you exactly where you were; §2 says the app's
   five tabs do not exist in here; MOTION_SPEC §2 says a full-screen
   container "covers everything". A fixed layer at inset 0 satisfies
   all three at once — it covers the app's bottom bar rather than
   fighting it, so the world can carry its own three-item bar without
   anybody editing the shell that owns the other one.

   (That also means this file never touches AppShellBar.jsx, which
   belongs to the navigation lane. The world sits on top of their bar;
   it does not ask them to hide it.)

   Getting in is the header icon or a swipe from the right edge (§1).
   Both do the same thing, and both leave the same way — the back
   arrow, the browser's back, or a swipe back. It is a push from the
   side that was touched, 220ms, instant under prefers-reduced-motion
   (MOTION_SPEC §3).

   The inside of a conversation is NOT here. §6 of PRODUCT_DECISIONS
   governs it and the people lane builds it; tapping a chat leaves the
   world for the canonical thread, which is the one place a message is
   ever written.
   ════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import { MotionStyles as FullScreenStyles, arrivalClass } from "../../components/motion.jsx";
import { touchPresence } from "./messagesData.js";
import Icon from "../../components/Icon.jsx";
import NewChat from "./NewChat.jsx";
import ThreadPage from "../people/ThreadPage.jsx";
import InvitePage from "../people/InvitePage.jsx";
import ChatsList from "./ChatsList.jsx";
import RequestsList from "./RequestsList.jsx";
import MessagesMenu from "./MessagesMenu.jsx";
import ArchivedChats from "./ArchivedChats.jsx";
import BlockedPeople from "./BlockedPeople.jsx";
import Thread from "../community/Thread.jsx";

export const WORLD_BAR_HEIGHT = 66;

function WorldTab({ to, end, icon, label, badge }) {
  const { ts } = useI18n();
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        minHeight: WORLD_BAR_HEIGHT,
        textDecoration: "none",
        color: isActive ? C.green : C.textMuted,
        fontWeight: isActive ? 800 : 600,
        fontSize: ts(14),
        position: "relative",
      })}
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            style={{
              fontSize: ts(22),
              lineHeight: 1,
              /* The active one is a filled pill, so "where am I" is
                 answered by shape and not by colour alone. */
              background: isActive ? "#EEF3E8" : "transparent",
              borderRadius: 50,
              padding: "4px 16px",
            }}
          >
            <Icon name={icon} size={22} />
          </span>
          <span>{label}</span>
          {badge > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 2,
                insetInlineEnd: "22%",
                minWidth: 20,
                height: 20,
                borderRadius: 50,
                background: C.brown,
                color: C.cream,
                fontSize: ts(12),
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 5px",
              }}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function MessagesWorld() {
  const { t, ts, meta } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const { state } = useLocation();

  /* MOTION_SPEC §1: this world arrives from the side that was touched.
     Decided at DISPATCH — MessagesButton passes the logical "end" and
     openFullScreen resolves it against the reading direction — so
     switching language mid-session still reverses the animation that was
     actually watched, which is why this reads location state and not the
     DOM.

     This used to pass an explicit fallback for the stateless case,
     because arrivalClass defaulted to a bare sb-full-right and would
     have arrived from the wrong edge in Urdu on any refresh or pasted
     URL. That is fixed in the helper now (it mirrors to the inline-end),
     so the workaround is gone: a local patch that outlives the bug it
     was written for is how one vocabulary becomes two again. */
  const arrival = arrivalClass(state);

  /* §5.4 presence: touched while the world is open, and again on a
     slow interval. No socket, no heartbeat storm — see 0076. */
  useEffect(() => {
    if (!profile?.id) return undefined;
    touchPresence();
    const t2 = setInterval(touchPresence, 90_000);
    return () => clearInterval(t2);
  }, [profile?.id]);

  /* Requests carries a count (§2) — a queue you clear, unlike Chats,
     where a count would be a debt. Lifted here so the badge and the
     screen cannot disagree. */
  const [pending, setPending] = useState(0);

  return (
    <div
      dir={meta.dir}
      data-world="messages"
      style={{
        position: "fixed",
        inset: 0,
        /* ABOVE THE APP'S BOTTOM BAR, which is also fixed and also sat
           at 60 — same layer, and it mounts after the routes, so it won
           and drew its five tabs across the bottom of the world. §2 is
           explicit that the app's five tabs do not exist in here, and
           the text assertions all passed while a screenshot showed
           Home / Games / Friend groups / Out & about / More along the
           foot of Messages.

           65 rather than 100: the composer (70) and the sheets (80/90)
           must still open over this. If the navigation lane ever raises
           the bar, this has to rise with it — noted to them. */
        zIndex: 65,
        background: C.bg,
        color: C.textMain,
        display: "flex",
        flexDirection: "column",
        fontFamily: meta.fonts.body,
      }}
      className={arrival}
    >
      {/* Both style blocks on purpose: the full-screen arrival lives in
          components/motion.jsx, the sheets this world opens live in
          lib/motion.jsx. Two files, one vocabulary. */}
      <FullScreenStyles />
      <MotionStyles />

      {/* The world's own header: out, its name, and the pencil (§3). */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderBottom: `1px solid ${C.warmGray}`,
          background: C.white,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t("msg.back")}
          style={{
            minWidth: A11Y.minTapTargetPx,
            minHeight: A11Y.minTapTargetPx,
            borderRadius: 50,
            border: "none",
            background: "transparent",
            color: C.textMain,
            fontSize: ts(24),
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true">{meta.dir === "rtl" ? "→" : "←"}</span>
        </button>
        <h1
          style={{
            flex: 1,
            margin: 0,
            fontFamily: meta.fonts.heading,
            fontSize: ts(24),
            fontWeight: 800,
            color: C.green,
          }}
        >
          {t("msg.title")}
        </h1>
        {/* A LABELLED ACTION, AND IT STAYS IN THE WORLD.

            This was a pencil linking to /app/people. Two faults in one
            control: a glyph that means "compose" only to people who were
            taught it, and a link that dropped you out of the world onto
            an app screen with the header and bottom bar back — with
            nothing to tell you that you had left.

            The word is the control now, with the icon beside it rather
            than instead of it, and the destination is a route inside
            this world. */}
        <NavLink
          to="new"
          style={({ isActive }) => ({
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: A11Y.minTapTargetPx,
            padding: "0 12px",
            borderRadius: 50,
            textDecoration: "none",
            color: isActive ? C.white : C.green,
            background: isActive ? C.green : "transparent",
            fontSize: ts(16),
            fontWeight: 700,
            whiteSpace: "nowrap",
          })}
        >
          <Icon name="add" size={20} />
          {t("msg.newChat.cta")}
        </NavLink>
      </header>

      <main style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 14px 20px" }}>
          <Routes>
            <Route index element={<ChatsList />} />
            {/* THE THREAD LIVES HERE NOW. It used to be reached at
                /app/people/<id>/chat, which put the app header and bottom
                bar back and dropped the person out of the world without
                telling them. ThreadPage itself is unchanged inside —
                bubbles, guards and the money warning are §6's and were
                not touched. The room moved; the furniture did not. */}
            <Route path="with/:profileId" element={<ThreadPage />} />
            {/* §4: My People is retired as a destination, so Invite comes
                here — beside Requests, where the two things you do with
                people who are not yet in a conversation now live
                together. The page itself is unchanged; only where it is
                reached from. */}
            <Route path="invite" element={<InvitePage />} />
            <Route path="new" element={<NewChat />} />
            <Route path="requests" element={<RequestsList onCount={setPending} />} />
            <Route path="menu" element={<MessagesMenu />} />
            <Route path="menu/archived" element={<ArchivedChats />} />
            <Route path="menu/blocked" element={<BlockedPeople />} />
            {/* An old /app/community/messages/<requestId> link. Thread is
                itself a redirect to the canonical thread, so this only
                exists so those links keep landing somewhere real. It sits
                last: a static segment outranks a dynamic one, so requests
                and menu are never swallowed by it. */}
            <Route path=":requestId" element={<Thread />} />
          </Routes>
        </div>
      </main>

      {/* §2 — three items. The app's five tabs do not exist in here. */}
      <nav
        aria-label={t("msg.title")}
        style={{
          display: "flex",
          borderTop: `1px solid ${C.warmGray}`,
          background: C.white,
          flexShrink: 0,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <WorldTab to="" end icon="messages" label={t("msg.tab.chats")} />
        <WorldTab to="requests" icon="letter" label={t("msg.tab.requests")} badge={pending} />
        <WorldTab to="invite" icon="add" label={t("people.list.inviteCta")} />
        <WorldTab to="menu" icon="settings" label={t("msg.tab.menu")} />
      </nav>
    </div>
  );
}
