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

   GETTING IN IS THE MESSAGES TAB. It is a bar tab now, fourth from
   the left in the ruled order, so the world opens as tab content with
   the inner Chats/Requests/Menu bar below untouched.

   The header icon is gone and so is the edge swipe. The edge swipe is
   deleted in the sense that matters — nothing may implement it — but
   it is worth recording that NOTHING EVER DID. Searched before
   removing: these two lines were the only occurrence of the word in
   the whole app outside the games folder, and no pointer or touch
   handler anywhere opened this world. A gesture that existed only as a
   sentence in a comment read, to anyone who came here to find out how
   the world opened, exactly like a gesture that existed.

   A horizontal swipe now moves between TABS (components/useTabSwipe.js)
   and yields to anything inside a screen that scrolls or drags
   sideways, so the inner surfaces here keep their own gestures.

   The inside of a conversation is NOT here. §6 of PRODUCT_DECISIONS
   governs it and the people lane builds it; tapping a chat leaves the
   world for the canonical thread, which is the one place a message is
   ever written.
   ════════════════════════════════════════════════ */

import { useEffect, useState, useRef } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { APP_COLORS as C, A11Y, CHIP } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useSession } from "../../lib/session.jsx";
import { MotionStyles } from "../../lib/motion.jsx";
import { MotionStyles as FullScreenStyles, arrivalClass } from "../../components/motion.jsx";
import { touchPresence } from "./messagesData.js";
import Icon from "../../components/Icon.jsx";
import { BAR_HEIGHT } from "../../components/BottomBar.jsx";
import { hasUnsentDraft } from "./draftGuard.js";
import DiscardDialog from "../community/DiscardDialog.jsx";
import NewChat from "./NewChat.jsx";
import ThreadPage from "../people/ThreadPage.jsx";
import InvitePage from "../people/InvitePage.jsx";
import ChatsList from "./ChatsList.jsx";
import RequestsList from "./RequestsList.jsx";
import MessagesMenu from "./MessagesMenu.jsx";
import ArchivedChats from "./ArchivedChats.jsx";
import BlockedPeople from "./BlockedPeople.jsx";
import Thread from "../community/Thread.jsx";
import useShutter from "../../components/useShutter.js";

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
        /* Ink on dark chrome: white when this is where you are, the
           same white held back when it is not. Green measured 2.61:1
           and muted ink 2.95:1 against the dark bar — both under the
           4.5 floor, on the only labels that say where you are. */
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
  const rootRef = useRef(null);
  const { state } = useLocation();
  const [confirmLeave, setConfirmLeave] = useState(false);

  /* One arrow, one question. Whatever screen the world is holding
     registers whether it has unsent words; the arrow asks before it
     closes anything. See draftGuard.js. */
  const askBack = () => { if (hasUnsentDraft()) setConfirmLeave(true); else navigate(-1); };

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

    /* MOUNTED IS NOT THE SAME AS OPEN, and it stopped being the same
       when visited tabs began staying mounted. This interval used to
       clear on unmount, which was a fair proxy for "the person left
       Messages" — the world is now held aside with display:none and
       never unmounts, so the heartbeat would go on saying somebody is
       here for the rest of the session.

       That is not a wasted request, it is a false statement about a
       person: isAbout() calls anyone seen in the last three minutes
       present, and presence drives the reconnect row and the dots on
       Chats. Somebody who opened Messages once at breakfast would read
       as around all day, to everyone.

       offsetParent is null exactly when an ancestor is display:none,
       which is how the shell holds a tab aside, and document.hidden
       covers the phone going in a pocket. Presence is a claim about
       attention, so it is only made while there is attention. */
    /* A BOX, NOT offsetParent. offsetParent is null for any
       position:fixed element whatever its visibility, and this world is
       fixed — so the first version of this gate reported "not here"
       with the world open on screen and would have stopped presence
       working altogether. Caught by counting touch_presence requests:
       zero while the world was plainly visible.

       A display:none ancestor collapses the rect to 0x0, which is true
       of fixed elements too. */
    const here = () => {
      if (document.hidden) return false;
      const r = rootRef.current?.getBoundingClientRect();
      return !!r && r.width > 0 && r.height > 0;
    };
    if (here()) touchPresence();
    const t2 = setInterval(() => { if (here()) touchPresence(); }, 90_000);
    return () => clearInterval(t2);
  }, [profile?.id]);

  /* Requests carries a count (§2) — a queue you clear, unlike Chats,
     where a count would be a debt. Lifted here so the badge and the
     screen cannot disagree. */
  const [pending, setPending] = useState(0);

  /* The world scrolls inside its own <main>, not the window, so the
     shutter is given that element to watch. */
  const worldScroller = useRef(null);
  const worldNavRef = useRef(null);
  const [worldNavH, setWorldNavH] = useState(0);
  const worldShut = useShutter(worldScroller);
  useEffect(() => {
    const n = worldNavRef.current;
    if (!n) return undefined;
    const read = () => setWorldNavH(n.offsetHeight);
    read();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    ro?.observe(n, { box: "border-box" });
    return () => ro?.disconnect();
  }, []);

  return (
    <div
      dir={meta.dir}
      ref={rootRef}
      data-world="messages"
      style={{
        position: "fixed",
        /* STOPS ABOVE THE APP BAR rather than covering it. Messages is a
           tab now, so this is tab CONTENT and the five tabs below it must
           stay reachable — inset:0 covered them, and moving my own bar to
           the top only changed which of my elements was doing the
           covering. Measured: a thumb at the foot hit the chats list.

           BAR_HEIGHT comes from BottomBar.jsx rather than a number typed
           here, so the two cannot drift apart. The safe-area inset is
           added because the bar carries one too. */
        top: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        /* var(--sb-safe-bottom), NOT env() directly.

           The shell feeds that variable from env() and reserves the bar
           as calc(BAR_HEIGHT + var(--sb-safe-bottom)); the bar itself
           pads with the same variable. Reading env() here looked
           equivalent and was not — simulating a notch by setting the
           variable moved the bar and left this edge where it was, so the
           world overlapped the bar by the whole inset. One source for one
           measurement, and it is the shell's.

           (env() only started resolving at all when viewport-fit=cover
           was added, so this had never been exercised.) */
        /* var(--sb-bar-h) alone — the bar's MEASURED height, and it
           already contains the safe-area inset, because the inset is
           padding on that element.

           Adding var(--sb-safe-bottom) to it would double-count the
           inset: the same trap as before, pointing the other way, and
           visible only on a notched device. Two wrongs in one week from
           one question — is the number I am adding already in the number
           I am adding it to.

           BAR_HEIGHT is no longer used here: it is what the shell
           RESERVES, and the bar is taller than that by a label line. */
        bottom: "var(--sb-bar-h, 92px)",
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
      {confirmLeave && (
        <DiscardDialog
          onKeep={() => setConfirmLeave(false)}
          onDiscard={() => { setConfirmLeave(false); navigate(-1); }}
        />
      )}

      {/* The world's own header: out, its name, and the pencil (§3). */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          /* C.nav + C.navEdge — the chrome tones the rest of the app
             uses. This header and the bar below were the last white
             chrome left, so on a phone the Messages world read as a
             slightly different application from the screen you reached
             it from. */
          borderBottom: `1px solid ${C.navEdge}`,
          background: C.nav,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={askBack}
          aria-label={t("msg.back")}
          style={{
            minWidth: A11Y.minTapTargetPx,
            minHeight: A11Y.minTapTargetPx,
            borderRadius: 50,
            border: "none",
            background: "transparent",
            /* CHIP.activeInk. This was C.textMain, which against the new
               dark nav measures 1.00:1 — not low contrast, the SAME
               COLOUR. The only way out of the world was invisible, and
               nothing here changed: the bar went dark underneath a mark
               that had always been ink. */
            color: CHIP.activeInk,
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
            color: CHIP.activeInk,
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
            color: isActive ? C.white : CHIP.activeInk,
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

      {/* SUB-NAVIGATION AT THE TOP, because the bottom now belongs to the
          app. Messages became a bar tab, and this row was still a second
          bottom bar painting over the first — measured on the built app,
          both ended at 844 and a thumb anywhere along the bottom hit
          "Invite someone". Landing on the Messages tab left no way to
          reach the other four.

          The file used to say "the world sits on top of their bar; it does
          not ask them to hide it", and that was right while Messages was a
          world reached from a header glyph. As a tab it is wrong.

          Stacking the two was the obvious repair and costs ~158px of an
          844px screen — a fifth of the display given to navigation on an
          app built for large text. Sub-navigation belongs under its own
          title anyway; the bottom bar is now app-level and a second one
          beneath it competes rather than nests.

          NOTE THE INK CHANGES WITH THE GROUND. On the dark chrome these
          labels were CHIP.activeInk; here they sit on the world's light
          ground, where white would be invisible. Moving a mark to a new
          surface revalues it — the failure this week keeps producing. */}
      <nav
        aria-label={t("msg.title")}
        ref={worldNavRef}
        style={{
          display: "flex",
          borderBottom: `1px solid ${C.navEdge}`,
          background: C.bg,
          flexShrink: 0,
          /* SHUTTERS WITH THE HEADER, the same rule as every other bar
             (MOTION §5). It travels its own height on a negative margin
             rather than a transform, because these two are in the flex
             column above a scrolling <main>: a transform would slide the
             row up and leave the hole it came out of, while a margin
             genuinely gives the space back and the list grows into it.

             The height is measured rather than typed. Text size is a
             setting in this app and Nastaliq needs a taller line box
             than Latin at the same nominal size, so a constant here
             would be wrong in one language, at one size, silently. */
          marginTop: worldShut ? -worldNavH : 0,
          transition: "margin-top 180ms ease-out",
        }}
      >
        <WorldTab to="" end icon="messages" label={t("msg.tab.chats")} />
        <WorldTab to="requests" icon="letter" label={t("msg.tab.requests")} badge={pending} />
        <WorldTab to="invite" icon="add" label={t("people.list.inviteCta")} />
        <WorldTab to="menu" icon="settings" label={t("msg.tab.menu")} />
      </nav>

      <main ref={worldScroller} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
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

    </div>
  );
}
